'use strict'

const Sequelize = require('sequelize')
const Op = Sequelize.Op
const Joi = require('@hapi/joi')

const {crdtType, mergeDeltas, verifyValues, Cencode, Cdecode} = require('./crdt')

module.exports = async (server, sequelize, config) => { // TODO: add canViewPad, canEditPad
  class Delta extends Sequelize.Model {}
  Delta.init({
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    padId: Sequelize.STRING,

    authorId: Sequelize.STRING,

    // delta: Sequelize.JSONB,
    delta: Sequelize.STRING(10000),
    deltaId: Sequelize.INTEGER
  }, { sequelize, modelName: 'delta' })

  server.subscription('/_da-pad/{padId}/sub/cursor')
  server.subscription('/_da-pad/{padId}/sub/delta')

  server.route({
    method: 'GET',
    path: '/_da-pad/{padId}/fetch-delta-changes/{from}',

    options: {
      validate: {
        params: Joi.object({
          padId: Joi.string().required(),
          from: Joi.number().integer().min(0).default(0)
        })
      }
    },

    handler: async (request, h) => {
      // SELECT id, authorId, content FROM deltas WHERE id < from ORDER BY id ASC
      const res = await Delta.findAll({
        where: {
          padId: request.params.padId,
          deltaId: {
            [Op.gt]: request.params.from
          }
        },
        order: [
          ['deltaId', 'ASC']
        ]
      })

      return {
        delta: Cencode(mergeDeltas(res.map(d => Cdecode(d.delta)))),
        lastId: res.length ? res.pop().deltaId : request.params.from
      }
    }
  })

  server.route({
    method: 'POST',
    path: '/_da-pad/{padId}/sync',
    handler: async (request, h) => {
      // TODO: determine author propertly

      const {padId} = request.params
      const padUrl = `/_da-pad/${padId}/sub`

      const authorId = 'test'

      let {cursor, delta} = request.payload

      const out = {}

      if (cursor) {
        server.publish(`${padUrl}/cursor`, { a: authorId, c: cursor })
        out.cursor = true
      }

      if (delta) {
        let deltaEnc = delta
        delta = Cdecode(delta)
        verifyValues(delta, authorId)

        // TODO: acid or put this directly on server
        let prev = await Delta.findAll({
          where: {
            padId
          },
          order: [
            ['deltaId', 'DESC']
          ],
          limit: 1
        })[0]

        const _delta = await Delta.create({
          padId,
          authorId,

          delta: deltaEnc,
          deltaId: prev ? (prev.deltaId + 1) : 1
        })

        out.delta = _delta.toJSON().deltaId

        server.publish(`${padUrl}/delta`, _delta)
      }

      return out
    }
  })

  return {
    create: async (id, initialContent) => {
      // TODO: check if already exists

      const pad = crdtType(id)
      initialContent = initialContent.split('\n').reduce((list, line) => {
        list.push(
          {a: 'System', c: line},
          {a: 'System', c: '\n'}
        )

        return list
      }, [])

      const initialDelta = pad.insertAllAt(0, initialContent)

      return Delta.create({
        padId: id,
        authorId: 'system',
        delta: Cencode(initialDelta),
        deltaId: 1
      })
    },
    delete: async (id) => {
      return Delta.destroy({
        where: {
          padId: id
        }
      })
    },
    Delta
  }
}
