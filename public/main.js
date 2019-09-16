'use strict'

const client = require('../src/client')

if (!window.fetch) {
  require('whatwg-fetch')
}

if (!window.location.hash) {
  window.location.hash = Math.random()
}

const padId = window.location.hash.replace(/#/g, '')

client(
  {
    authorId: 'TODOMAKERANDOM',
    padId: padId
  },
  {
    htmlField: '#dapad'
  },
  {
    padServer: window.location.host,
    serverAuth: 'TODOADDAUTH'
  },
  client.localStorage(padId))
