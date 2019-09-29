'use strict'

require('./dapad.css')
const {crdtType} = require('../crdt')

const Renderer = require('./renderer')
const SyncController = require('./sync')

/*
@deltaIn:
  - new delta comes in
  - calculate current delta
  - apply current
  - apply diff tree via new
  - apply new
*/

module.exports = async ({authorId, padId}, _renderer, _sync, storage) => {
  const crdt = crdtType(padId)

  const renderer = Renderer(_renderer, authorId, {
    onDelta: (delta) => {
      sync.send.delta(delta)
    },
    onCursorChange: (newPos) => {
      sync.send.cursor(newPos)
    }
  })

  const sync = await SyncController(_sync, storage, crdtType, padId, {
    onDelta: (delta) => { // NOTE: this is main()! this will yield the initial deltas as well.
      crdt.apply(delta)
      renderer.onChange(delta)
    },
    onCursor: (data) => {
      renderer.onCursor(data)
    },
    onConnectionStatusChange: (state, safeToEdit) => {
      renderer.onConnectionStatusChange(state, safeToEdit)
    }
  })

  await sync.task
}

function localStorageWithPrefix (prefix) {
  const ls = window.localStorage

  return {
    get: (key, def) => {
      const val = ls.getItem(`${prefix}.${key}`)

      if (val == null || val === 'undefined') {
        return def
      } else {
        return JSON.parse(val)
      }
    },
    set: (key, val) => {
      return ls.setItem(`${prefix}.${key}`, JSON.stringify(val))
    }
  }
}

module.exports.localStorage = localStorageWithPrefix
