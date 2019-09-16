'use strict'

const CRDT = require('delta-crdts')

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

  const rga = require('delta-crdts/src/rga')

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
        lineIds: {}
      }
    },
    join: (s1, s2) => {
      let sn = {
        lines: merge2rga(s1.lines, s2.lines),
        lineIds: {}
      }

      for (const id in s1.lineIds) { // eslint-disable-line guard-for-in
        sn.lineIds[id] = merge2rga(s1.lineIds[id], s2.lineIds[id])
      }
    },
    value: (state) => {
      return rga.value(state.lines).map(lineId => {
        return rga.value(state.lineIds[lineId])
      })
    },
    mutators: {
      createLineAfter (prevLine) {

      },
      deleteLineAt (id) {

      },
      appendLine (lineId, textId, state) {

      }
    }
  }

  CRDT.Define('Document', Document)

  return CRDT('Document')
}
