/* const shadowMap = {}

window.crdt = crdt

function outgoingCrdt () {
  let indexMap = {}
  let lineListMap = {}
  let lineList = []

  let delta = []

  let val
  let len

  const off = () => {
    val = crdt.value()
    len = val.length
    val.forEach((el, i) => {
      const shadow = el[shadowId]

      indexMap[shadow] = i
      if (el.c === '\n') {
        lineListMap[shadow] = lineList.push(i) - 1
      }
    })
  }

  off()

  let leftLine
  field.children().toArray().map(e => {
    let ee = $(e)

    if (e.nodeName === 'DIV') {
      let leftNode

      if (!ee.data('nodeid')) {
        let id = genNodeId()
        let insertAt = lineList[lineListMap[leftLine] + 1]
        if (insertAt == null) { // we didn't any line after the current, append at end
          delta.push(crdt.push({a: authorId, c: '\n', [shadowId]: id}))
        } else {
          insertAt-- // so we add just _after_ the linebreak
          delta.push(crdt.insertAt(insertAt, {a: authorId, c: '\n', [shadowId]: id}))
        }
        off()
        ee.data('nodeid', id)
      }

      // TODO: handle line removals

      const line = ee.contents().toArray().map(t => {
        let node
        let te = $(t)

        // TODO: handle node removals

        if (t.nodeType === 3) {
          const id = genNodeId()
          node = {a: authorId, c: t.data, nodeId: id}

          const obj = $(renderNode(node))
          obj.insertBefore(t)

          te.remove()

          let insertAt = indexMap[leftNode] || indexMap[leftLine]
          delta.push(crdt.insertAt(insertAt, {a: authorId, c: t.data, [shadowId]: id}))
          shadowMap[id] = obj
        } else if (t.nodeName === 'SPAN') {
          node = {a: te.data('author'), c: te.text(), nodeId: te.data('nodeid')}
          // TODO: check if value equal and update if not
        }

        if (node) {
          leftNode = node.nodeId
        }

        return node
      }).filter(Boolean)

      leftLine = ee.data('nodeid')

      return line
    }
  }).filter(Boolean)

  return delta.length ? mergeDeltas(delta) : null
}

function incomingCrdt () {
  // for all nodes that we don't have a shadowmapping: they need to be added to the DOM and shadowmapped
  // for all nodes that we do have a shadowmapping but that is not present in the crdt: they need to be removed from the DOM

  let leftLine
  let leftNode

  let shadowsThatExist = {}

  // sync
  crdt.value().forEach(node => {
    let shadow = node[shadowId]

    if (node.c === '\n') {
      if (!shadow) {
        shadow = node[shadowId] = genNodeId()
        const obj = $(`<div data-nodeid="${shadow}"></div>`)
        if (leftLine) {
          obj.appendAfter(leftLine)
        } else {
          field.append(obj)
        }
        shadowMap[shadow] = obj
        leftLine = obj
      } else {
        leftLine = $(`*[data-nodeid="${shadow}"]`)
      }
      leftNode = null
      shadowsThatExist[shadow] = node
    } else {
      if (!shadow) {
        shadow = node[shadowId] = genNodeId()
        const obj = $(renderNode(node))
        if (leftNode) {
          obj.appendAfter(leftNode)
        } else {
          leftLine.append(obj)
        }
        shadowMap[shadow] = obj
        leftNode = obj
      }
    }
  })

  // del old
  for (const shadow in shadowMap) {
    if (!shadowsThatExist[shadow]) {
      shadowMap[shadow].remove()
      delete shadowMap[shadow]
    }
  }

  renderCursors()
} */

/* function join (field, delta) {
  const added = delta[0]
  const removed = delta[1]

  const resultEdges = delta[2]

  const unmergedEdges = delta[3]
  const edgesToAdd = unmergedEdges

  if (!resultEdges.size) {
    resultEdges.set(null, null)
  }

  while (edgesToAdd.size > 0) {
    for (const edge of edgesToAdd) {
      const [key, newValue] = edge

      if (resultEdges.has(newValue)) {
        // bypass this edge, already inserted
      } else if (resultEdges.has(key)) {
        if (!added.has(newValue)) {
          unmergedEdges.add(edge)
        } else {
          insertEdge(edge)
        }
      } else {
        unmergedEdges.add(edge)
      }
      edgesToAdd.delete(key)
    }
  }

  if (unmergedEdges.size) {
    let progress = false
    do {
      const countBefore = unmergedEdges.size
      for (const edge of unmergedEdges) {
        const [key, newValue] = edge
        if (resultEdges.has(newValue)) {
          // bypass this edge, already inserted
          unmergedEdges.delete(edge)
        } else if (resultEdges.has(key) && added.has(key)) {
          insertEdge(edge)
          unmergedEdges.delete(edge)
        }
      }

      progress = unmergedEdges.size < countBefore
    } while (progress)
  }

  return [added, removed, resultEdges, unmergedEdges]

  function insertEdge (edge) {
    let [leftEdge, newKey] = edge

    let right = resultEdges.get(leftEdge) || null

    if (!newKey || right === newKey) {
      return
    }

    while (right && (compareIds(right, newKey) > 0)) {
      leftEdge = right
      right = resultEdges.get(right) || null
    }

    resultEdges.set(leftEdge, newKey)
    resultEdges.set(newKey, right)
  }
} */
