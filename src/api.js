'use strict'

const Sequelize = require('sequelize')
const Op = Sequelize.Op
const Joi = require('@hapi/joi')

const {crdtType, crdt, mergeDeltas, verifyValues, Cencode, Cdecode} = require('./crdt')

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
    delta: Sequelize.STRING,
    deltaId: Sequelize.INTEGER,

    createdAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      allowNull: false
    }
  }, { sequelize, modelName: 'delta' })

  server.subscription('/_da-pad/{padId}/sub/cursor')
  server.subscription('/_da-pad/{padId}/sub/delta')

  server.route({
    method: 'GET',
    path: '/_da-pad/{padId}/fetch-delta-changes/{from}',

    options: {
      validate: {
        /* params: { TODO: hapi fails at it's own stuff, great
          padId: Joi.string().required(),
          from: Joi.number().integer().min(0).default(0)
        } */
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
        delta: Cencode(mergeDeltas(res)),
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

      let {cursor, delta} = request.body

      if (cursor) {
        server.publish(`${padUrl}/cursor`, { author: authorId, cursor })
      }

      if (delta) {
        delta = Cdecode(delta)
        verifyValues(delta, authorId)

        // TODO: acid or put this directly on server
        const prev = await Delta.findAll({
          where: {
            padId: request.params.padId,
            deltaId: {
              [Op.gt]: request.params.from
            }
          },
          order: [
            ['deltaId', 'DESC']
          ],
          limit: 1
        })[0]

        const _delta = await Delta.create({
          padId,
          authorId,

          delta,
          deltaId: prev ? prev.deltaId + 1 : 1
        })

        server.publish(`${padUrl}/cursor`, _delta)
      }
    }
  })

  return {
    create: async (id, initialContent) => {
      // TODO: check if already exists

      const pad = crdt(id)
      initialContent = initialContent.split('\n').reduce((list, line) => {
        list.push(
          {author: 'System', content: line},
          {author: 'System', content: '\n'}
        )
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
    }
  }
}
