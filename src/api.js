'use strict'

const Sequelize = require('sequelize')
const Op = Sequelize.Op

module.exports = async (server, sequelize, config) => {
  class Delta extends Sequelize.Model {}
  Delta.init({
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },

    padId: Sequelize.STRING,

    authorId: Sequelize.STRING,

    delta: Sequelize.JSONB,
    deltaId: Sequelize.INTEGER,

    createdAt: {
      type: 'TIMESTAMP',
      defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      allowNull: false
    }
  }, { sequelize, modelName: 'deltas' })

  await sequelize.sync()

  server.subscription('/_da-pad/{padId}/sub/cursor')
  server.subscription('/_da-pad/{padId}/sub/delta')

  server.route({
    method: 'GET',
    path: '/_da-pad/{padId}/fetch-delta-changes/{from}',
    handler: async (request, h) => {
      // SELECT id, authorId, content FROM deltas WHERE id < from ORDER BY id ASC
      return Delta.findAll({
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
    }
  })

  server.route({
    method: 'POST',
    path: '/_da-pad/{padId}/sync',
    handler: async (request, h) => {
      // TODO: determine author propertly
      // TODO: validate incoming data

      const {padId} = request.params
      const padUrl = `/_da-pad/${padId}/sub`

      const authorId = 'test'

      const {cursor, delta} = request.body

      if (cursor) {
        server.publish(`${padUrl}/cursor`, { author: authorId, cursor })
      }

      if (delta) {
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
}
