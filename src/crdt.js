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
    assert(val.c)
    assert(val.c === '\n' || val.c.indexOf('\n') === -1)
    assert(val.a)
    if (ensureAuthor) {
      assert(val.a === ensureAuthor)
    }
  })
}

const codec = require('delta-crdts-msgpack-codec') // TODO: switch to non-binary codec

module.exports = {
  crdtType,
  mergeDeltas,
  verifyValues,
  Cencode: (d) => codec.encode(d).toString('base64'),
  Cdecode: (d) => codec.decode(Buffer.from(d, 'base64'))
}
