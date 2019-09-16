'use strict'

require('./dapad.css')
const Nes = require('@hapi/nes/lib/client')
const {crdtType, mergeDeltas, Cencode, Cdecode} = require('../crdt')
const $ = require('jquery')
require('./onchange-plugin')($)
// const diff = require('deep-diff')

const crypto = require('crypto')
const genNodeId = () => crypto.randomBytes(8).toString('hex')

/*
@deltaIn:
  - new delta comes in
  - calculate current delta
  - apply current
  - apply diff tree via new
  - apply new
*/

// TODO: split into files

module.exports = async ({authorId, padId}, _renderer, _sync, storage) => {
  const crdt = crdtType(padId)

  function calculateDelta (oldContentTree, newContentTree) {

  }

  const renderer = Renderer(_renderer, crdt, {
    /* onContentChange: (oldContentTree, newContentTree) => {
      const delta = calculateDelta(oldContentTree, newContentTree)
      crdt.apply(delta)
      sync.send.delta(delta)
      renderer.onChange()
    }, */
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
    },
    onCursor: (data) => {
      renderer.onCursorChange(data)
    },
    onConnectionStatusChange: (state, safeToEdit) => {
      // TODO: add
      // state: 0=offline, 1=syncing, 2=online/up-to-date
      // safeToEdit: when loading a pad for the first time, it's not safe to edit until the first change comes in
      renderer.onConnectionStatus(state, safeToEdit)
    }
  })
}

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

function Renderer ({htmlField}, crdt, {onContentChange, onCursorChange}) {
  const field = $(htmlField)
  const cursors = {}

  field.toggleClass('da-pad')
  field.attr('contenteditable', true)
  field.wysiwygEvt()

  function contentTreeify (field) { // div's a line, span's a change. direct text nodes of diff need to be converted to a span.
    return field.children().toArray().map(e => $(e)).map(e => {
      return e.contents().toArray().map(t => {
        let node
        let te = $(t)

        if (t.nodeType === 3) {
          node = {author: 'selfFIXME', content: t.data, nodeId: genNodeId()}
          $(renderNode(node)).insertBefore(t)
          te.remove()
        } else if (t.nodeName === 'SPAN') {
          node = {author: te.data('author'), content: te.text(), nodeId: te.data('nodeid')}
        }

        return node
      }).filter(Boolean)
    })
  }

  function calculateTreeDiff (oldTree, newTree) {
    // console.log(diff(oldTree, newTree))

  }

  function calculateTreeDelta (oldTree, newTree) {
    /* diff(oldTree, newTree).forEach(d => {
      switch (d.type) {
        case 'E': { // we need to rip off some nodes then re-add them without the removed content
          break
        }
        case 'D': { // we need to remove stuff from the crdt at the right point
          break
        }
        case 'A': { // we need to add stuff at the crdt at the right point
          break
        }
        default: {
          throw new TypeError('diff invalid, report')
        }
      }
    }) */

  }

  function applyTreeDiff (diff) {

  }

  function renderNode (node) {
    return `<span data-nodeid="${escape(node.nodeId)}" data-author="${escape(node.author)}" style="background: ${authorToRGBA(node.author)}">${escape(node.content)}</span>`
  }

  let oldTree = []

  field.on('change', () => {
    let newTree = contentTreeify(field)
    console.log(oldTree, newTree)
    const diff = calculateTreeDiff(oldTree, newTree)
    console.log('out', diff)
    oldTree = newTree
  })

  // TODO: input from user handle
  // TODO: delta-update HTML as well

  function renderState (lines, cursors) { // TODO: add cursor support
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
  }

  return {
    onCursor: ({author, pos}) => {
      cursors[author] = {time: Date.now(), pos}
      reRender()
    },
    onChange: () => {
      reRender()
    }
  }
}

async function SyncController ({padServer, serverAuth}, {get, set}, crdtType, padId, {onDelta, onCursor, onConnectionStatusChange}) {
  // get stuff from storage
  let lastSyncDeltaId = await get('lastSyncedDeltaId', 0)
  let lastSyncState = await get('lastSyncedState')
  let unsyncedState = await get('unsyncedState', [])
  unsyncedState = unsyncedState.map(s => {
    return {
      cursor: s.cursor,
      delta: s.delta ? Cdecode(s.delta) : null
    }
  })

  async function save () {
    await set('lastSyncedDeltaId', lastSyncDeltaId)
    await set('lastSyncState', lastSyncState)
    await set('unsyncedState', unsyncedState.map(s => {
      return {
        cursor: s.cursor,
        delta: s.delta ? Cencode(s.delta) : null
      }
    }))
  }

  const client = new Nes.Client(`ws://${padServer}`)
  // await client.connect({ auth: { headers: { authorization: 'Basic am9objpzZWNyZXQ=' } } })
  await client.connect({ })

  const padUrl = `/_da-pad/${padId}`

  async function doSyncQueue () {
    await reduceQueue()

    try {
      // TODO: add POST `${padUrl}/sync` unsyncedState[0]
    } catch (err) {
      console.error(err)
      return doSyncQueue()
    }
  }

  async function reduceQueue () {
    // reduce: cursor(s1, s2) => s2, delta(s1, s2) => mergeDeltas(s1, s2) where s2 is newer
    unsyncedState = unsyncedState.reduce((s1, s2) => {
      return {
        cursor: (s2.cursor || s1.cursor),
        delta: s1.delta && s2.delta ? mergeDeltas([s1.delta, s2.delta]) : (s2.delta || s1.delta)
      }
    }, {})
    await save()
  }

  let currentSyncLock

  async function syncQueue (todo) {
    // something that processes the entire queue as batch to server
    unsyncedState.push(todo) // this does not need to be .save()'d, since we're doing that over in reduceQueue()
    if (!currentSyncLock) {
      currentSyncLock = doSyncQueue()
    }

    return currentSyncLock
  }

  // TODO: locks for crdt sync incoming

  async function doCompleteSync () {
    const res = await client.request(`${padUrl}/fetch-delta-changes/${lastSyncDeltaId}`)
    let {delta, lastId} = res.payload
    delta = Cdecode(delta)
    lastSyncDeltaId = lastId
    lastSyncState = mergeDeltas([lastSyncState, delta])
    await save()
    onDelta(delta)
  }

  client.subscribe(`${padUrl}/sub/delta`, async (delta) => {
    if (delta.deltaId !== lastSyncDeltaId + 1) {
      await doCompleteSync()
    } else {
      lastSyncDeltaId++
      delta = Cdecode(delta.delta)
      lastSyncState = mergeDeltas([lastSyncState, delta])
      await save()
      await onDelta(delta.delta)
    }
  })

  client.subscribe(`${padUrl}/sub/cursor`, (data) => {
    onCursor(data)
  })

  if (!lastSyncDeltaId || !lastSyncState) {
    await doCompleteSync()
  } else {
    onDelta(mergeDeltas([lastSyncState].concat(unsyncedState.map(s => s.delta).filter(Boolean))))
  }

  return {
    send: {
      cursor: async (cursor) => {
        return syncQueue({cursor})
      },
      delta: async (delta) => {
        return syncQueue({delta})
      }
    }
  }
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
