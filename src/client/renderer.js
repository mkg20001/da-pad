'use strict'

const { mergeDeltas } = require('../crdt')

const crypto = require('crypto')
const genNodeId = () => crypto.randomBytes(8).toString('hex')

const $ = require('jquery')
require('./onchange-plugin')($)

const shadowId = Symbol('CRDT_SHADOW_ID')

const KEEP_CURSORS = 10 * 1000 // keep un-updated cursor for 10s

const RGBA_CACHE = {}

function authorToRGBA (author) {
  if (!RGBA_CACHE[author]) {
    let hash = crypto.createHash('sha1').update(author).digest('hex')
    return (RGBA_CACHE[author] = `rgba(${parseInt(hash.substr(0, 2), 16)}, ${parseInt(hash.substr(2, 4), 16)}, ${parseInt(hash.substr(4, 6), 16)}, 0.16)`)
  } else {
    return RGBA_CACHE[author]
  }
}

function Renderer ({htmlField}, crdt, authorId, {onDelta, onCursorChange}) {
  const field = $(htmlField)
  const cursors = {}

  field.toggleClass('da-pad')
  field.attr('contenteditable', true)
  field.wysiwygEvt()

  const shadowMap = {}

  window.crdt = crdt

  function outgoingCrdt () {
    let indexMap = {}
    let lineListMap = {}
    let lineList = []

    let delta = []

    let val
    let len

    const off = () => {
      val = crdt.value()
      len = val.length
      val.forEach((el, i) => {
        const shadow = el[shadowId]

        indexMap[shadow] = i
        if (el.content === '\n') {
          lineListMap[shadow] = lineList.push(shadow) - 1
        }
      })
    }

    off()

    let leftLine
    field.children().toArray().map(e => {
      let ee = $(e)

      if (e.nodeName === 'DIV') {
        let leftNode

        if (!ee.data('nodeid')) {
          let id = genNodeId()
          let insertAt = lineList[lineListMap[leftLine] + 1]
          if (insertAt == null) {
            insertAt = len // at the end (TODO: use pushRight()?)
          } else {
            insertAt-- // so we add just _after_ the linebreak
          }
          delta.push(crdt.insertAt(insertAt, {author: authorId, content: '\n', [shadowId]: id}))
          off()
          ee.data('nodeid', id)
        }

        const line = ee.contents().toArray().map(t => {
          let node
          let te = $(t)

          if (t.nodeType === 3) {
            const id = genNodeId()
            node = {author: 'selfFIXME', content: t.data, nodeId: id}

            const obj = $(renderNode(node))
            obj.insertBefore(t)

            te.remove()

            let insertAt = indexMap[leftNode] || indexMap[leftLine]
            delta.push(crdt.insertAt(insertAt, {author: authorId, content: t.data, [shadowId]: id}))
            shadowMap[id] = obj
          } else if (t.nodeName === 'SPAN') {
            node = {author: te.data('author'), content: te.text(), nodeId: te.data('nodeid')}
            // TODO: check if value equal and update if not
          }

          if (node) {
            leftNode = node.nodeId
          }

          return node
        }).filter(Boolean)

        leftLine = ee.data('nodeid')

        return line
      }
    }).filter(Boolean)

    return delta.length ? mergeDeltas(delta) : null
  }

  function incomingCrdt () {
    // for all nodes that we don't have a shadowmapping: they need to be added to the DOM and shadowmapped
    // for all nodes that we do have a shadowmapping but that is not present in the crdt: they need to be removed from the DOM

    let leftLine
    let leftNode

    let shadowsThatExist = {}

    // sync
    crdt.value().forEach(node => {
      let shadow = node[shadowId]

      if (node.content === '\n') {
        if (!shadow) {
          shadow = node[shadowId] = genNodeId()
          const obj = $(`<div data-nodeid="${shadow}"></div>`)
          if (leftLine) {
            obj.appendAfter(leftLine)
          } else {
            field.append(obj)
          }
          shadowMap[shadow] = obj
          leftLine = obj
        } else {
          leftLine = $(`*[data-nodeid="${shadow}"]`)
        }
        leftNode = null
        shadowsThatExist[shadow] = node
      } else {
        if (!shadow) {
          shadow = node[shadowId] = genNodeId()
          const obj = $(renderNode(node))
          if (leftNode) {
            obj.appendAfter(leftNode)
          } else {
            leftLine.append(obj)
          }
          shadowMap[shadow] = obj
          leftNode = obj
        }
      }
    })

    // del old
    for (const shadowId in shadowMap) {
      if (!shadowsThatExist[shadowId]) {
        shadowMap[shadowId].delete()
        delete shadowMap[shadowId]
      }
    }
  }

  function renderNode (node) {
    return `<span data-nodeid="${escape(node.nodeId)}" data-author="${escape(node.author)}" style="background: ${authorToRGBA(node.author)}">${escape(node.content)}</span>`
  }

  field.on('change', () => {
    const out = outgoingCrdt()
    if (out) {
      onDelta(out)
    }
  })

  // TODO: input from user handle
  // TODO: delta-update HTML as well

  /* function renderState (lines, cursors) { // TODO: add cursor support
    return lines.map(line =>
      `<div>
        ${line.map(renderNode)}
        </div>`
    ).join('')
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

    const lines = crdt
      .state()
      .reduce((lines, node) => {
        if (node.content === '\n') {
          lines.push([])
        } else {
          lines[lines.length - 1].push(node)
        }

        return lines
      }, [[]])

    return renderState(lines, _cursors)
  }

  function reRender () {
    field.html(prepareRenderState())
  } */

  return {
    onCursor: ({author, pos}) => {
      cursors[author] = {time: Date.now(), pos}
      incomingCrdt()
    },
    onChange: () => {
      incomingCrdt()
    }
  }
}

module.exports = Renderer
