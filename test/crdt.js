'use strict'

/* eslint-env mocha */

const assert = require('assert').strict

const jsdom = require('jsdom')
const { JSDOM } = jsdom
const jquery = require('jquery')

const { crdtType: RGA, mergeDeltas } = require('../src/crdt')
const {join, makeDelta} = require('../src/client/crdtDom')

function _ (html) {
  const dom = new JSDOM(html || '<body><div id="dapad"></div></body>')
  const $ = jquery(dom.window)
  const field = $('#dapad')
  return { dom, field, $ }
}

function t ({ name, html, exec, outHtml }) {
  it(name, async () => {
    const { dom, field, $ } = _(html)

    await exec({ dom, field, $ })

    assert.deepEqual(outHtml, field.html())
  })
}

describe('crdt join', () => {
  t({
    name: 'can process a push join text',
    exec: ({ field, $ }) => {
      const crdt = RGA('join')
      const delta = crdt.push({a: 'test', c: 'hello'})

      join($, field, delta)
    },
    outHtml: '<div data-nodeid="dummy"><span data-nodeid="kgGkam9pbg==" data-author="test" style="background: rgba(169, 74, 143, 0.16);">hello</span></div>'
  })

  t({
    name: 'can process a push join line',
    exec: ({ field, $ }) => {
      const crdt = RGA('join')
      const delta = crdt.push({a: 'test', c: '\n'})

      join($, field, delta)
    },
    outHtml: '<div data-nodeid="kgGkam9pbg=="></div>'
  })

  t({
    name: 'can process a push join line and text',
    exec: ({ field, $ }) => {
      const crdt = RGA('join')

      join($, field, crdt.push({a: 'test', c: '\n'}))
      join($, field, crdt.push({a: 'test', c: 'hello'}))
    },
    outHtml: '<div data-nodeid="kgGkam9pbg=="><span data-nodeid="kgKkam9pbg==" data-author="test" style="background: rgba(169, 74, 143, 0.16);">hello</span></div>'
  })

  t({
    name: 'can process a merged push join line and text',
    exec: ({ field, $ }) => {
      const crdt = RGA('join')
      const delta = mergeDeltas([crdt.push({a: 'test', c: '\n'}), crdt.push({a: 'test', c: 'hello'})])

      join($, field, delta)
    },
    outHtml: '<div data-nodeid="kgGkam9pbg=="><span data-nodeid="kgKkam9pbg==" data-author="test" style="background: rgba(169, 74, 143, 0.16);">hello</span></div>'
  })

  t({
    name: 'can process a merged push join line and text + removal sequential',
    exec: ({ field, $ }) => {
      const crdt = RGA('join')
      const delta = mergeDeltas([crdt.push({a: 'test', c: '\n'}), crdt.push({a: 'test', c: 'hello'})])

      join($, field, delta)
      join($, field, crdt.removeAt(1))
      join($, field, crdt.removeAt(0))
    },
    outHtml: ''
  })
})
