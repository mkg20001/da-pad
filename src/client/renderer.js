'use strict'

const {join, makeDelta} = require('./join')

const $ = require('jquery')
require('./onchange-plugin')($)

const KEEP_CURSORS = 10 * 1000 // keep un-updated cursor for 10s

const RGBA_CACHE = {}

function authorToRGBA (author, alpha) {
  if (!RGBA_CACHE[author]) {
    let hash = crypto.createHash('sha1').update(author).digest('hex')
    RGBA_CACHE[author] = `${parseInt(hash.substr(0, 2), 16)}, ${parseInt(hash.substr(2, 2), 16)}, ${parseInt(hash.substr(4, 2), 16)}`
  }

  return `rgba(${RGBA_CACHE[author]}, ${alpha})`
}

function Renderer ({htmlField}, crdt, authorId, {onDelta, onCursorChange}) {
  const field = $(htmlField)
  const cursors = {}

  field.toggleClass('da-pad')
  field.attr('contenteditable', true)
  field.wysiwygEvt()

  function renderNode (node) {
    return `<span data-nodeid="${escape(node.nodeId)}" data-author="${escape(node.a)}" style="background: ${authorToRGBA(node.a, 0.16)}">${escape(node.c)}</span>`
  }

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
