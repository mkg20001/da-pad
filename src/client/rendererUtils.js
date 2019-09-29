'use strict'

const crypto = require('crypto')

const RGBA_CACHE = {}

function authorToRGBA (author, alpha) {
  if (!RGBA_CACHE[author]) {
    let hash = crypto.createHash('sha1').update(author).digest('hex')
    RGBA_CACHE[author] = `${parseInt(hash.substr(0, 2), 16)}, ${parseInt(hash.substr(2, 2), 16)}, ${parseInt(hash.substr(4, 2), 16)}`
  }

  return `rgba(${RGBA_CACHE[author]}, ${alpha})`
}

function renderText (nodeId, node) {
  return `<span data-nodeid="${escape(nodeId)}" data-author="${escape(node.a)}" style="background: ${authorToRGBA(node.a, 0.16)}">${escape(node.c)}</span>`
}

function renderLine (nodeId, node) {
  return `<div data-nodeid="${nodeId}"></div>`
}

module.exports = {
  renderNode,
  renderLine,
  authorToRGBA
}
