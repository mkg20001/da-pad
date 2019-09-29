'use strict'

const Nes = require('@hapi/nes/lib/client')
const {crdtType, mergeDeltas, Cencode, Cdecode} = require('../crdt')

async function SyncController ({padServer, serverAuth}, {get, set}, {authorId, padId}, {onDelta, onCursor, onConnectionStatusChange}) {
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

  const padUrl = `/_da-pad/${padId}`

  async function doSyncQueue () {
    await reduceQueue()

    try {
      const rawResponse = await window.fetch(`${padUrl}/sync`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cursor: unsyncedState[0].cursor,
          delta: unsyncedState[0].delta ? Cencode(unsyncedState[0].delta) : null
        })
      })
      const content = await rawResponse.json()

      console.log(content)

      if (!content.error) {
        unsyncedState.unshift()
      }

      if (unsyncedState.length) {
        return doSyncQueue()
      } else {
        await save()
      }
    } catch (err) {
      console.error(err)
      return doSyncQueue()
    }
  }

  async function reduceQueue () {
    // reduce: cursor(s1, s2) => s2, delta(s1, s2) => mergeDeltas(s1, s2) where s2 is newer
    unsyncedState = [unsyncedState.reduce((s1, s2) => {
      return {
        cursor: (s2.cursor || s1.cursor),
        delta: s1.delta && s2.delta ? mergeDeltas([s1.delta, s2.delta]) : (s2.delta || s1.delta)
      }
    }, {})]
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

  const task = (async () => {
    await client.connect({ })

    if (!lastSyncDeltaId || !lastSyncState) {
      onConnectionStatusChange(1, false)
      await doCompleteSync()
      onConnectionStatusChange(2, true)
    } else {
      onDelta(mergeDeltas([lastSyncState].concat(unsyncedState.map(s => s.delta).filter(Boolean))))
      onConnectionStatusChange(1, true)
      await doCompleteSync()
    }
  })()

  return {
    send: {
      cursor: async (cursor) => {
        return syncQueue({cursor})
      },
      delta: async (delta) => {
        return syncQueue({delta})
      }
    },
    task
  }
}

module.exports = SyncController
