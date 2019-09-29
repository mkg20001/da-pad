'use strict'

const {join, makeDelta} = require('./crdtDom')

const {authorToRGBA} = require('./rendererUtils')

const $ = require('jquery')
require('./onchange-plugin')($)

const KEEP_CURSORS = 10 * 1000 // keep un-updated cursor for 10s

function Renderer ({htmlField}, crdt, authorId, {onDelta, onCursorChange}) {
  const field = $(htmlField)
  const cursors = {}

  field.toggleClass('da-pad')
  field.attr('contenteditable', true)
  field.wysiwygEvt()

  field.on('change', () => {
    const delta = makeDelta()
    if (delta) {
      join(field, delta)
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
    onCursor: ({author, pos}) => {
      cursors[author] = {time: Date.now(), pos}
      renderCursors()
    },
    onChange: (delta) => {
      join(field, delta)
    }
  }
}

module.exports = Renderer
