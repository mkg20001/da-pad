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

function renderText ($, nodeId, data) {
  // const node = $(`<span data-nodeid="${escape(nodeId)}" data-author="${escape(node.a)}" style="background: ${authorToRGBA(node.a, 0.16)}">${escape(node.c)}</span>`)
  const node = $('<span></span>')
  node.attr('data-nodeid', String(nodeId))
  node.attr('data-author', data.a)
  node.css('background', authorToRGBA(data.a, 0.16))
  node.text(data.c)
  return node
}

function renderLine ($, nodeId, data) {
  const node = $('<div></div>')
  node.attr('data-nodeid', String(nodeId))
  return node
}

module.exports = {
  renderText,
  renderLine,
  authorToRGBA
}
