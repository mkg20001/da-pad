'use strict'

const Nes = require('@hapi/nes')
const CRDT = require('../crdt')
const $ = require('jquery')

const KEEP_CURSORS = 10 * 1000 // keep un-updated cursor for 10s

module.exports = async ({authorId, padId}, _renderer, _sync, storage) => {
  const crdt = CRDT(authorId, padId)

  const renderer = Renderer(_renderer, crdt, {
    onContentChange: (oldContentTree, newContentTree) => {
      const delta = calculateDelta(oldContentTree, newContentTree)
      crdt.apply(delta)
      sync.send.delta(delta)
      renderer.onChange()
    },
    onCursorChange: (newPos) => {
      sync.send.cursorPosition(newPos)
    }
  })
  const sync = SyncController(_sync, storage, padId, {
    onDelta: (delta) => { // this will yield the initial deltas as well
      crdt.apply(delta)
    },
    onCursor: (data) => {
      renderer.onCursorChange(data)
    },
    onConnectionStatusChange: (isOnline) => {
      // TODO: add
    }
  })

  // apply everything
  crdt.apply(lastSyncState)
  unsyncedState.forEach(delta => crdt.apply(delta))
}

function Renderer ({htmlField}, {onContentChange, onCursorChange}) {
  const field = $(htmlField)

  // TODO: input from user handle

  function renderState (state, cursors) { // TODO: add cursor support
    return `<div class="da-pad">
    ${state.lines.map(line =>
    `<div class="line">
        ${line.map(change => `<div class="change" style="background: ${authorToRGBA(change.author)}">${escape(change.text)}</div>`)}
        </div>`
  ).join('')}
    </div>`
  }

  function prepareRenderState (state, cursors) {
    let _cursors = {}
    for (const author in cursors) {
      if (Date.now() - cursors[author].time > KEEP_CURSORS) {
        delete cursors[author]
      } else {
        _cursors[cursors[author].pos] = author
      }
    }
  }
}

async function SyncController ({padServer, serverAuth}, {get, set}, padId, {onDelta, onCursor, onConnectionStatusChange}) {
  // get stuff from storage
  const lastSyncDeltaId = await get('lastSyncedDeltaId', 0)
  const lastSyncState = await get('lastSyncedState', crdt.initial())
  const unsyncedState = await get('unsyncedState', [])

  const client = new Nes.Client(`ws://${padServer}`)

  const padUrl = `_da-pad/sub/${padId}`

  /* const initialState = await client.request(`${padUrl}/fetch-delta-changes/${deltaId}`)

  crdt.apply(initialState) */

  client.subscribe(`${padUrl}/delta`, (delta) => {
    crdt.apply(delta)
    prepareRenderState()
  })

  client.subscribe(`${padUrl}/cursor`, (author, pos) => {
    cursors[author] = {time: Date.now(), pos}
    prepareRenderState()
  })

  if (!lastSyncDeltaId) {
    await doSyncup()
  }
}

/*

const crdt = CRDT(authorId, padId)

let cursors = {} // author => {time, pos}

const field = $(htmlField)

function escape (str) {
  return str // TODO: SECURITY!!!11
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
*/
