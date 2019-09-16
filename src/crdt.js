'use strict'

const CRDT = require('delta-crdts')
const rga = require('delta-crdts/src/rga')

const assert = require('assert').strict

const crdtType = CRDT('rga')

/*

{author: 'name', content: 'test'},
{author: 'name', content: '\n'},
{author: 'name', content: 'test2'},
{author: 'name', content: '\n'},
{author: 'name', content: 'test3'},

*/

function mergeDeltas (deltas) {
  const d = deltas.filter(Boolean)
  if (d.length < 2) return d[0] || rga.initial()
  return d.reduce(rga.join, rga.initial())
}

function verifyValues (diff, ensureAuthor) {
  rga.value(diff).forEach(val => {
    assert(val.content === '\n' || val.content.indexOf('\n') === -1)
    assert(val.author)
    if (ensureAuthor) {
      assert(val.author === ensureAuthor)
    }
  })
}

module.exports = {
  crdtType,
  mergeDeltas,
  verifyValues
}
