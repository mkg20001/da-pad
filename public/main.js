'use strict'

const client = require('../src/client')

if (!window.fetch) {
  require('whatwg-fetch')
}

let padId = window.location.hash.replace(/#/g, '')

if (!padId) {
  window.location.hash = padId = Math.random()
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

client(
  {
    authorId: 'TODOMAKERANDOM',
    padId: window.location.hash
  },
  {
    htmlField: '#dapad'
  },
  {
    padServer: window.location.host,
    serverAuth: 'TODOADDAUTH'
  },
  localStorageWithPrefix(window.location.host))
