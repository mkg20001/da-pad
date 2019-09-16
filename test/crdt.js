'use strict'

const {crdtType} = require('../src/crdt')

describe('crdt', () => {
  it('can create a text object', () => {
    let crdt = crdtType('id')
    crdt.createLineAfter(0)
    crdt.appendTextAfterText(0, 0, {author: 'me', content: 'content'})
    console.log(crdt.value())
  })
})
