'use strict'

const config = require('./lib/config')
const logger = require('./lib/logger')
const logger_console = require('./lib/logger_console')
const app = require('./app')

app.listen(config.get('server.port'), config.get('server.ip'), function() {
    logger_console.info('Node.js', process.version,
        'server in', __dirname, 'listening on', this.address())
    logger.info({context: {
        nodejs_version: process.version,
        app_root_dir_path: __dirname,
        app_address: this.address(),
    }})
})
