'use strict'

const Nes = require('@hapi/nes')
const CRDT = require('../crdt')
const $ = require('jquery')

const KEEP_CURSORS = 10 * 1000 // keep un-updated cursor for 10s

module.exports = async (padServer, authorId, padId, htmlField) => {
  const client = new Nes.Client(`ws://${padServer}`)
  const crdt = CRDT(authorId, padId)

  let cursors = {} // author => {time, pos}

  const field = $(htmlField)

  function escape (str) {
    return str // TODO: SECURITY!!!11
  }

  function renderState (state, cursors) { // TODO: add cursor support
    return `<div class="da-pad">
    ${state.lines.map(line =>
    `<div class="line">
        ${line.map(change => `<div class="change" style="background: ${authorToRGBA(change.author)}">${escape(change.text)}</div>`)}
        </div>`
  ).join('')}
    </div>`
  }

  function prepareRenderState () {
    let _cursors = {}
    for (const author in cursors) {
      if (Date.now() - cursors[author].time > KEEP_CURSORS) {
        delete cursors[author]
      } else {
        _cursors[cursors[author].pos] = author
      }
    }
  }

  const padUrl = `_da-pad/sub/${padId}`

  const initialState = await client.request(`${padUrl}/fetch-delta-changes/${deltaId}`)

  crdt.apply(initialState)

  client.subscribe(`${padUrl}/delta`, (delta) => {
    crdt.apply(delta)
    prepareRenderState()
  })

  client.subscribe(`${padUrl}/cursor`, (author, pos) => {
    cursors[author] = {time: Date.now(), pos}
    prepareRenderState()
  })
}
