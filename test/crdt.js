'use strict'

const CRDT = require('delta-crdts')

const jsdom = require('jsdom')
const { JSDOM } = jsdom
const jquery = require('jquery')

const RGA = CRDT('rga')
const {join, makeDelta} = require('../src/client/join')

function _ (html) {
  const dom = new JSDOM(html || '<body><div id="dapad"></div></body>')
  const $ = jquery(dom.window)
  const field = $('#dapad')
  return { dom, field, $ }
}

describe('crdt join', () => {
  it('can process a join', () => {
    const { dom, field, $ } = _()
    const crdt = RGA('join')

    const delta = crdt.push({a: 'test', c: 'hello'})

    join(field, delta)

    console.log(field.html())
  })
})
