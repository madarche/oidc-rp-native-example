/**
 * The logger to use to output to the console, typically to be used for the
 * start/stop events and the tests.
 */

'use strict'

const tracer = require('tracer')

const logger = tracer.colorConsole({level: 'trace'})

module.exports = logger
