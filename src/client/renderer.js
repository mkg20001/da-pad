'use strict'

const { mergeDeltas } = require('../crdt')

const crypto = require('crypto')
const genNodeId = () => crypto.randomBytes(8).toString('hex')

const $ = require('jquery')
require('./onchange-plugin')($)

const shadowId = Symbol('CRDT_SHADOW_ID')

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
        if (el.c === '\n') {
          lineListMap[shadow] = lineList.push(i) - 1
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
          if (insertAt == null) { // we didn't any line after the current, append at end
            delta.push(crdt.push({a: authorId, c: '\n', [shadowId]: id}))
          } else {
            insertAt-- // so we add just _after_ the linebreak
            delta.push(crdt.insertAt(insertAt, {a: authorId, c: '\n', [shadowId]: id}))
          }
          off()
          ee.data('nodeid', id)
        }

        // TODO: handle line removals

        const line = ee.contents().toArray().map(t => {
          let node
          let te = $(t)

          // TODO: handle node removals

          if (t.nodeType === 3) {
            const id = genNodeId()
            node = {a: authorId, c: t.data, nodeId: id}

            const obj = $(renderNode(node))
            obj.insertBefore(t)

            te.remove()

            let insertAt = indexMap[leftNode] || indexMap[leftLine]
            delta.push(crdt.insertAt(insertAt, {a: authorId, c: t.data, [shadowId]: id}))
            shadowMap[id] = obj
          } else if (t.nodeName === 'SPAN') {
            node = {a: te.data('author'), c: te.text(), nodeId: te.data('nodeid')}
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

      if (node.c === '\n') {
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
    for (const shadow in shadowMap) {
      if (!shadowsThatExist[shadow]) {
        shadowMap[shadow].remove()
        delete shadowMap[shadow]
      }
    }

    renderCursors()
  }

  function renderNode (node) {
    return `<span data-nodeid="${escape(node.nodeId)}" data-author="${escape(node.a)}" style="background: ${authorToRGBA(node.a, 0.16)}">${escape(node.c)}</span>`
  }

  field.on('change', () => {
    const out = outgoingCrdt()
    if (out) {
      onDelta(out)
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
    onChange: () => {
      incomingCrdt()
    }
  }
}

module.exports = Renderer
