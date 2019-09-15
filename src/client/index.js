'use strict'

const Nes = require('@hapi/nes')
const CRDT = require('delta-crdts')

module.exports = (padServer, padId) => {
  const client = new Nes.Client(`ws://${padServer}/_da-pad/sub/${padId}`)
}
