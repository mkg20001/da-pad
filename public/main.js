'use strict'

const client = require('../src/client')

if (!window.fetch) {
  require('whatwg-fetch')
}

if (!window.location.hash) {
  window.location.hash = Math.random()
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
  localStorageWithPrefix(padId))
