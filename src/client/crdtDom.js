'use strict'

const { mergeDeltas } = require('../crdt')
const crypto = require('crypto')
const genNodeId = () => crypto.randomBytes(8).toString('hex')

const assert = require('assert')
const { encode, decode } = require('delta-crdts-msgpack-codec')

const { renderLine, renderText } = require('./rendererUtils')

const SHADOW = Symbol('CRDT_SHADOW_ID')
const STORAGE = Symbol('CRDT_STORAGE')

const dummyLine = ($) => renderLine($, 'dummy', {a: 'system', c: '\n'})

// Replicable Growable Array (RGA)
// State is represented by 4 sets:
//   * Added Vertices (VA)
//   * Removed Vertices (VR)
//   * Edges (E)
//   * Unmerged Edges (UE)
//
// As defined in http://hal.upmc.fr/inria-00555588/document

// from RGA src, adapated to directly work on dom
function join ($, field, delta, options = {}) { // eslint-disable-line complexity
  const _s = field[0] ? field[0] : field
  const storage = _s[STORAGE] = _s[STORAGE] || {
    c: [
      new Map([[null, null]]), // VA
      new Set(), // VR
      new Map([[null, null]]), // E
      new Set() // UE
    ],
    shadowMap: {}
  }

  // TODO: read some values directly from dom?

  const added = new Map([...storage.c[0], ...delta[0]])
  const removed = new Set([...storage.c[1], ...delta[1]])

  const s1Edges = storage.c[2]
  const s2Edges = delta[2]
  const resultEdges = new Map(s1Edges)

  const unmergedEdges = new Set([...(storage.c[3] || new Set()), ...(delta[3] || new Set())])

  const edgesToAdd = new Map(s2Edges)

  if (!resultEdges.size) {
    resultEdges.set(null, null)
  }

  while (edgesToAdd.size > 0) {
    for (const edge of edgesToAdd) {
      const [key, newValue] = edge

      if (resultEdges.has(newValue)) {
        // bypass this edge, already inserted
      } else if (resultEdges.has(key)) {
        if (!added.has(newValue)) {
          unmergedEdges.add(edge)
        } else {
          insertEdge(edge)
        }
      } else {
        unmergedEdges.add(edge)
      }
      edgesToAdd.delete(key)
    }
  }

  if (unmergedEdges.size) {
    let progress = false
    do {
      const countBefore = unmergedEdges.size
      for (const edge of unmergedEdges) {
        const [key, newValue] = edge
        if (resultEdges.has(newValue)) {
          // bypass this edge, already inserted
          unmergedEdges.delete(edge)
        } else if (resultEdges.has(key) && added.has(key)) {
          insertEdge(edge)
          unmergedEdges.delete(edge)
        }
      }

      progress = unmergedEdges.size < countBefore
    } while (progress)
  }

  // added

  // remove DOM nodes of removed verticles
  delta[1].forEach(verticle => {
    const value = added.get(verticle)
    const node = storage.shadowMap[verticle]

    if (node) {
      if (value.c === '\n') {
        // it's a line

        if (node.children().length) {
          // move children to previous line, remove line
          const leftLine = node.prev()

          if (leftLine) {
            // if we have a left line, move our children there
            node.children().toArray().forEach(e => $(e).appendTo(leftLine))
          } else {
            // if we don't have a left line, create one and move our children there
            const newLine = dummyLine($)
            newLine.prependTo(field)

            node.children().toArray().forEach(e => $(e).appendTo(newLine))
          }

          node.remove()
        } else {
          // just remove line
          node.remove()
        }
      } else {
        // it's a text node

        // since they aren't dependent on by anything, we can just toss 'em
        node.remove()
      }
    }
  })

  // /added

  storage.c = [added, removed, resultEdges, unmergedEdges]

  function insertEdge (edge) { // here we render dom nodes
    let [leftEdge, newKey] = edge

    let right = resultEdges.get(leftEdge) || null

    if (!newKey || right === newKey) {
      return
    }

    while (right && (compareIds(right, newKey) > 0)) {
      leftEdge = right
      right = resultEdges.get(right) || null
    }

    // added

    let leftNode
    if (leftEdge) {
      leftNode = storage.shadowMap[leftEdge]
    }

    const leftValue = added.get(leftEdge)
    const value = added.get(newKey)

    if (value.c === '\n') {
      // line
      const line = renderLine($, newKey, value)
      line[SHADOW] = newKey
      storage.shadowMap[newKey] = line

      // TODO: handle re-arrange (all nodes following this line until the next must be moved to this line instead or whereever they are)

      if (!leftEdge) {
        // insert after field
        field.append(line)
      } else if (leftValue.c === '\n') {
        // insert after left line
        line.insertAfter(leftNode)
      } else if (leftValue) {
        // insert after line of left node
        line.insertAfter(leftNode.parent())
      }
    } else {
      // text
      const text = renderText($, newKey, value)
      text[SHADOW] = newKey
      storage.shadowMap[newKey] = text

      if (!leftEdge) {
        // get the first line, insert into that
        const firstLine = field.children()[0]
        if (!firstLine) {
          const firstLine = dummyLine($)
          field.append(firstLine)
          firstLine.append(text)
        } else {
          firstLine.append(text)
        }
      } else if (leftValue.c === '\n') {
        // insert at beginning of line
        leftNode.append(text)
      } else if (leftValue) {
        // insert after left node
        text.insertAfter(leftNode)
      }
    }

    // /added

    resultEdges.set(leftEdge, newKey)
    resultEdges.set(newKey, right)
  }
}

// from RGA, modified to not resolve pos, instead uses left parameter directly
function insertAllAt (id, state, left, values) {
  const [, removed] = state

  const newAdded = new Map()
  const newRemoved = new Set()
  if (removed.has(left)) {
    newRemoved.add(left)
  }

  const newEdges = new Map()

  values.forEach((value, index) => {
    const newId = createUniqueId(state, id, index)
    newAdded.set(newId, value)
    newEdges.set(left, newId)
    left = newId
  })

  return [newAdded, newRemoved, newEdges, new Set()]
}

// own
function makeDelta ($, field, padId, authorId) {
  const _s = field[0] ? field[0] : field
  const storage = _s[STORAGE]

  let state = storage.c

  let deltas = []
  const delta = (d) => {
    state = mergeDeltas([state, d])
    deltas.push(d)
  }

  // addition
  field.children().toArray().forEach(t => {
    const leftNode = $(t).prev()
    let leftEdge = null

    if (t.nodeType === 3) {
      // we have a lonely text

      let append = []
      // get the left node
      if (!leftNode) {
        // if we don't have one, make a line and add to delta
        // also set leftEdge then, line is inserted after null
        append.push({a: authorId, c: '\n'})
      } else {
        leftEdge = leftNode.data('nodeid')
      }

      // append the text node to crdt after leftEdge and add delta
      append.push({a: authorId, c: t.data})

      delta(insertAllAt(padId, state, leftEdge, append))

      $(t).remove() // remove from DOM
    } else if (t.nodeName === 'DIV') {
      const nodeId = $(t).data('nodeid')
      if (!nodeId) { // lonely line
        leftEdge = leftNode ? leftNode.data('nodeid') : null
        const append = [{a: authorId, c: '\n'}, {a: authorId, c: $(t).text()}]

        delta(insertAllAt(padId, state, leftEdge, append))

        $(t).remove() // remove from DOM
      } else {
        const leftLine = $(t).data('nodeid')

        $(t).children().toArray().forEach(t => {
          if (t.nodeType === 3) { // lonely text in line
            // check if we have a left node, otherwise use line
            // then append
            let leftNode = $(t).prev()

            let leftEdge = null
            if (!leftNode) {
              // if we don't have a left node use line
              leftEdge = leftLine
            } else {
              // otherwise use prev nodeid
              leftEdge = leftNode.data('nodeid')
            }

            delta(insertAllAt(padId, state, leftEdge, [{a: authorId, c: t.data}]))

            $(t).remove() // remove from DOM
          } else if (t.nodeName === 'SPAN') { // line
            // check if content is same. if changed, create new node and remove old. but keep in dom since CRDT will sync
          }
        })
      }
    }
  })

  return deltas.length ? mergeDeltas(deltas) : null
}

// from RGA src
function createUniqueId (state, nodeId, index = 0) {
  const [, , edges] = state
  const pos = edges.size + index
  return encode([pos, nodeId]).toString('base64')
}

// from RGA src
function compareIds (_id1, _id2) {
  const id1 = decode(Buffer.from(_id1, 'base64'))
  const id2 = decode(Buffer.from(_id2, 'base64'))
  const [pos1] = id1
  const [pos2] = id2
  let comparison = 0

  if (pos1 < pos2) {
    comparison = -1
  } else if (pos1 > pos2) {
    comparison = 1
  } else {
    const [, nodeId1] = id1
    const [, nodeId2] = id2
    if (typeof nodeId1 === 'object' || typeof nodeId2 === 'object') {
      // Buffer has a .compare() method
      assert(nodeId1.compare, 'object comparison needs compare method')
      comparison = nodeId1.compare(nodeId2)
    } else {
      if (nodeId1 < nodeId2) {
        comparison = -1
      } else if (nodeId1 > nodeId2) {
        comparison = 1
      }
    }
  }

  return comparison
}

module.exports = { join, makeDelta }
