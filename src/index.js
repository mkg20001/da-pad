'use strict'

const Hapi = require('@hapi/hapi')
const CatboxMongoDB = require('catbox-mongodb')
const Joi = require('@hapi/joi')

const pino = require('pino')
const log = pino({name: 'da-pad'})

const mongoose = require('mongoose')

const Relish = require('relish')({
  messages: {}
})

const init = async (config) => {
  const mongodbDB = config.mongodb.split('/').pop().split('?').shift() // get uppercase part: mongodb://url:port/DB?something
  config.hapi.cache = [{
    provider: {
      constructor: CatboxMongoDB,
      options: {
        uri: config.mongodb,
        partition: mongodbDB
      }
    }
  }]

  config.hapi.routes = {
    validate: {
      failAction: Relish.failAction
    }
  }

  const server = Hapi.server(config.hapi)

  await server.register({
    plugin: require('hapi-pino'),
    options: {name: 'da-pad'}
  })

  if (global.SENTRY) {
    await server.register({
      plugin: require('hapi-sentry'),
      options: {client: global.SENTRY}
    })
  }

  await server.register({
    plugin: require('@hapi/inert')
  })

  require('hapi-spa-serve')(server, {assets: require('path').join(__dirname, '../dist')})

  await require('./api')(server, config)

  await mongoose.connect(config.mongodb)
  await server.start()
}

module.exports = init
