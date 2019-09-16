'use strict'

const Nes = require('@hapi/nes/lib/client')
const {crdtType, mergeDeltas} = require('../crdt')
const $ = require('jquery')

// TODO: split into files

module.exports = ({authorId, padId}, _renderer, _sync, storage) => {
  const crdt = crdtType(padId)

  function calculateDelta (oldContentTree, newContentTree) {

  }

  const renderer = Renderer(_renderer, crdt, {
    onContentChange: (oldContentTree, newContentTree) => {
      const delta = calculateDelta(oldContentTree, newContentTree)
      crdt.apply(delta)
      sync.send.delta(delta)
      renderer.onChange()
    },
    onCursorChange: (newPos) => {
      sync.send.cursor(newPos)
    }
  })

  const sync = SyncController(_sync, storage, crdtType, padId, {
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

function authorToRGBA (author) {
  return `rgba(0, 0, 0, .6)` // TODO: make colors random
}

function Renderer ({htmlField}, crdt, {onContentChange, onCursorChange}) {
  const field = $(htmlField)
  const cursors = {}

  // TODO: input from user handle

  function renderState (state, cursors) { // TODO: add cursor support
    return `<div class="da-pad">
    ${state.lines.map(line =>
    `<div class="line">
        ${line.map(change => `<div class="change" style="background: ${authorToRGBA(change.author)}">${escape(change.text)}</div>`)}
        </div>`
  ).join('')}
    </div>`
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

    return renderState(crdt.state(), _cursors)
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

  async function save () {
    await set('lastSyncedDeltaId', lastSyncDeltaId)
    await set('lastSyncState', lastSyncState)
    await set('unsyncedState', unsyncedState)
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
    const delta = await client.request(`${padUrl}/fetch-delta-changes/${lastSyncDeltaId}`)
    lastSyncDeltaId = delta.id
    lastSyncState = mergeDeltas([lastSyncState, delta.delta])
    await save()
    onDelta(delta)
  }

  client.subscribe(`${padUrl}/sub/delta`, async (delta) => {
    if (delta.id !== lastSyncDeltaId + 1) {
      await doCompleteSync()
    } else {
      lastSyncDeltaId++
      lastSyncState = mergeDeltas([lastSyncState, delta.delta])
      await save()
      await onDelta(delta.delta)
    }
  })

  client.subscribe(`${padUrl}/sub/cursor`, (data) => {
    onCursor(data)
  })

  if (!lastSyncDeltaId) {
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

/*

const crdt = CRDT(authorId, padId)

let cursors = {} // author => {time, pos}

const field = $(htmlField)

function escape (str) {
  return str // TODO: SECURITY!!!11
}

const padUrl = `_da-pad/sub/${padId}`

const initialState = await client.request(`${padUrl}/fetch-delta-changes/${deltaId}`)

crdt.apply(initialState)

client.subscribe(`${padUrl}/delta`, (delta) => {
  crdt.apply(delta)
  prepareRenderState()
})

client.subscribe(`${padUrl}/cursor`, (author, pos) => {
  cursors[author] = {time: Date.now(), pos}
  prepareRenderState()
})
*/
