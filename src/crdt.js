'use strict'

const CRDT = require('delta-crdts')
const rga = require('delta-crdts/src/rga')

const crypto = require('crypto')
const genLineId = () => crypto.randomBytes(10).toString('hex')

module.exports = () => {
  /*

  Document#RGA {
    Line#RGA {
      Text {
        author "authorId"
        content "someString"
      }
    }
  }

  */

  function merge2rga (s1, s2) {
    if (s1 && s2) {
      return rga.join(s1, s2)
    } else {
      return s1 || s2 || rga.initial()
    }
  }

  const Document = {
    initial: () => {
      return {
        lines: rga.initial(),
        lineIds: {},
        delLineIds: []
      }
    },
    join: (s1, s2) => {
      let sn = {
        lines: merge2rga(s1.lines, s2.lines),
        lineIds: {},
        delLineIds: []
      }

      const del = s1.delLineIds.concat(s2.delLineIds)

      for (const id in s1.lineIds) { // eslint-disable-line guard-for-in
        sn.lineIds[id] = merge2rga(s1.lineIds[id], s2.lineIds[id])
      }

      del.forEach(id => {
        delete sn.lineIds[id]
      })

      return sn
    },
    value: (state) => {
      return rga.value(state.lines).map(lineId => {
        return rga.value(state.lineIds[lineId])
      })
    },
    mutators: {
      createLineAfter (id, state, after) {
        const lid = genLineId()
        return {
          lines: rga.addRight(id, state.lines, after, lid),
          lineIds: {
            [lid]: rga.initial()
          },
          delLineIds: []
        }
      },
      deleteLineAt (id, state, at) {
        const lid = rga.value(state.lines)[at]

        return {
          lines: rga.deleteAt(id, state.lines, at),
          lineIds: {},
          delLineIds: [lid]
        }
      },
      appendTextAfterText (id, state, lineId, afterTextId, content) {
        const lid = rga.value(state.lines)[lineId]

        return {
          lines: rga.initial(),
          lineIds: {
            [lid]: rga.pushRight(id, state.lineIds[lineId], afterTextId, content)
          },
          delLineIds: []
        }
      },
      deleteTextAt (id, state, lineId, textId) {
        const lid = rga.value(state.lines)[lineId]

        return {
          lines: rga.initial(),
          lineIds: {
            [lid]: rga.deleteAt(id, state.lineIds[lineId], textId)
          },
          delLineIds: []
        }
      }
    }
  }

  CRDT.Define('Document', Document)

  return CRDT('Document')
}
