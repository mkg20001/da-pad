'use strict'

/* eslint-env mocha */

global.USEATTR = true

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

function t ({ name, html, exec, outHtml, outDelta }) {
  it(name, async () => {
    const { dom, field, $ } = _(html)

    await exec({ dom, field, $ })

    if (outDelta != null) {
      const delta = makeDelta($, field, 'join', 'test')
      assert.deepEqual(outDelta, delta)
      join($, field, delta)
    }

    if (outHtml != null) {
      assert.deepEqual(outHtml, field.html())
    }
  })
}

const crdt = RGA('join')
const deltaMini = mergeDeltas([crdt.push({a: 'test', c: '\n'}), crdt.push({a: 'test', c: 'hello'})])

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
      join($, field, deltaMini)
    },
    outHtml: '<div data-nodeid="kgGkam9pbg=="><span data-nodeid="kgKkam9pbg==" data-author="test" style="background: rgba(169, 74, 143, 0.16);">hello</span></div>'
  })

  t({
    name: 'can process a merged push join line and text + removal sequential',
    exec: ({ field, $ }) => {
      join($, field, deltaMini)
      join($, field, crdt.removeAt(1))
      join($, field, crdt.removeAt(0))
    },
    outHtml: ''
  })
})

describe('crdt delta', () => {
  t({
    name: 'can process a line addition',
    html: '<body><div id="dapad"></div></body>',
    exec: ({ field, $ }) => {
      join($, field, deltaMini)
      $('<div>test</div>').appendTo(field)
    },
    outDelta: [
      new Map([
        ['kgOkam9pbg==', { a: 'test', c: '\n' }],
        ['kgSkam9pbg==', { a: 'test', c: 'test' }]
      ]),
      new Set(),
      new Map([
        ['kgGkam9pbg==', 'kgOkam9pbg=='],
        ['kgOkam9pbg==', 'kgSkam9pbg==']
      ]),
      new Set()
    ],
    outHtml: '<div data-nodeid="kgGkam9pbg=="><span data-nodeid="kgKkam9pbg==" data-author="test" style="background: rgba(169, 74, 143, 0.16);">hello</span></div><div data-nodeid="kgOkam9pbg=="><span data-nodeid="kgSkam9pbg==" data-author="test" style="background: rgba(169, 74, 143, 0.16);">test</span></div>'
  })
})
