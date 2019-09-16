'use strict'

/*

State looks like this:
  {author: 'name', line: '', beforeLine: '', afterLine: '', text: '', beforeText: '', afterText: ''}

*/

/* const DocumentWithAuthors = {
  initial: () => {
    return {
      lines: {},
      lineOrder: []
    }
  },
  join: (s1, s2) => {

  },
  value: (state) => state,
  mutators: {
    doSomething (id, state, arg1) => {
      // example mutator, returning a delta
      return 0
    }
  }
}  */

/*

Document {
  lineIds: RGA(),
  lines: {
    $id: RGA(text)
  }
}

Text {
  author "authorId"
  content "someString"
}

*/

const CRDT = require('delta-crdts')

module.exports = (padId, authorId) => {
  const rga = CRDT('rga')

  /* const DocumentWithAuthors = {
    initial: () => {
      return {
        lineIds: rga(padId + '#')
      }
    },
    join: (s1, s2) => {

    },
    value: (state) => state,
    mutators: {
      appendLine (beforeLine) => {

      }
    }
  } */

  /* const set = rga(padId)

  return {
    appendText: (text) => {
      return set.push({author: 'test'})
    }
  } */

  return rga
}
