'use strict'

const client = require('..').Client

if (!window.fetch) {
  require('whatwg-fetch')
}

let padId = window.location.hash

if (!padId) {
  window.location.hash = padId = Math.random()
}

client(window.location.host, padId)
