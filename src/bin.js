#!/usr/bin/env node

/* eslint-disable no-console */

'use strict'

module.exports = (init) => {
  const yaml = require('js-yaml')
  const fs = require('fs')
  const path = require('path')

  const confPath = [path.join(process.cwd(), 'config.yaml'), '/etc/da-pad.yaml'].filter(p => fs.existsSync(p))[0]

  if (!confPath) {
    throw new Error('No config found!')
  }

  const config = yaml.load(String(fs.readFileSync(confPath)))

  init(config).catch(e => {
    console.error('')
    console.error('A fatal error has occured! Application has been terminated!')
    console.error('')
    console.error(e.stack)
    process.exit(1) // TODO: sentry catch uncaught call
  })
}
