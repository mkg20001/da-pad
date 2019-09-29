'use strict'

const { mergeDeltas } = require('../crdt')
const crypto = require('crypto')
const genNodeId = () => crypto.randomBytes(8).toString('hex')

const assert = require('assert')
const { encode, decode } = require('delta-crdts-msgpack-codec')

const SHADOW = Symbol('CRDT_SHADOW_ID')
const STORAGE = Symbol('CRDT_STORAGE')

// Replicable Growable Array (RGA)
// State is represented by 4 sets:
//   * Added Vertices (VA)
//   * Removed Vertices (VR)
//   * Edges (E)
//   * Unmerged Edges (UE)
//
// As defined in http://hal.upmc.fr/inria-00555588/document

// from RGA src, adapated to directly work on dom
function join (field, delta, options = {}) {
  const storage = field[STORAGE] = field[STORAGE] || {
    c: [
      new Map([[null, null]]), // VA
      new Set(), // VR
      new Map([[null, null]]), // E
      new Set() // UE
    ],
    shoadowMap: {}
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

    let leftNode = field

    if (leftEdge) {
      leftNode = storage.shadowMap[leftEdge]
    }

    resultEdges.set(leftEdge, newKey)
    resultEdges.set(newKey, right)
  }
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

module.exports = {join}
