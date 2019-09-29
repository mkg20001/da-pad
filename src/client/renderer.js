'use strict'

const {join, makeDelta} = require('./crdtDom')

const {authorToRGBA} = require('./rendererUtils')

const $ = require('jquery')
require('./onchange-plugin')($)

const KEEP_CURSORS = 10 * 1000 // keep un-updated cursor for 10s

const STATE = [
  ['grey', 'Offline'],
  ['yellow', 'Syncing...'],
  ['green', 'Online']
]

function Renderer ({htmlField: id}, {padId, authorId}, {onDelta, onCursorChange}) {
  const main = $(id)
  const cursors = {}

  main.toggleClass('da-pad')

  const state = $('<div class="da-state da-s-grey"><div class="da-bulb"></div></div>')
  state.appendTo(main)
  const stateText = $('<span>Loading...</span>')
  stateText.appendTo(state)

  const field = $('<div class="da-contents"></div>')
  field.appendTo(main)

  field.wysiwygEvt()
  field.on('change', () => {
    const delta = makeDelta($, field, padId, authorId)
    if (delta) {
      join($, field, delta)
      onDelta(delta)
    }
  })

  // TODO: input from user handle
  // TODO: delta-update HTML as well

  function renderCursors () {
    field.find('.cursor').remove()

    let lines = field.contents().filter(e => e.nodeName === 'DIV')

    for (const author in cursors) {
      if (Date.now() - cursors[author].time > KEEP_CURSORS) {
        delete cursors[author]
      } else {
        const {line, char} = cursors[author].pos.split(':')
        const lineEl = lines[line]

        const obj = $(`<div class="cursor" style="background: ${authorToRGBA(author, 0.4)}"></div>`) // TODO: insert this somewhere

        let nodes = $(lineEl).contents().filter(e => e.nodeName === 'SPAN')
        nodes.forEach(node => {

        })
      }
    }
  }

  return {
    onCursor: ({a: author, c: pos}) => {
      cursors[author] = {time: Date.now(), pos}
      renderCursors()
    },
    onChange: (delta) => {
      join($, field, delta)
    },
    onConnectionStatusChange: (_state, safeToEdit) => {
      // state: 0=offline, 1=syncing, 2=online/up-to-date
      // safeToEdit: when loading a pad for the first time, it's not safe to edit until the first change comes in

      const [color, text] = STATE[_state]

      // TODO: make smarter
      state.removeClass('da-s-grey')
      state.removeClass('da-s-yellow')
      state.removeClass('da-s-green')
      state.addClass('da-s-' + color)

      stateText.text(text)

      field.attr('contenteditable', safeToEdit)
    }
  }
}

module.exports = Renderer
