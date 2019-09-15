'use strict'

module.exports = async (server, config) => {
  server.route({
    method: 'POST',
    path: '/',
    handler: function (request, h) {
      return 'Hello World!'
    }
  })
}
