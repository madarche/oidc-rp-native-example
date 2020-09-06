'use strict'

const path = require('path')
const request_logger = require('morgan')
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const cookieSession = require('cookie-session')
const onFinished = require('on-finished')
const nunjucks = require('nunjucks')

const config = require('./lib/config')
const logger = require('./lib/logger')

const app = module.exports = express()

app.locals.app_title = 'Demo OIDC RP - client web'
app.locals.app_icon_path = '/img/oidc-rp-native-example-icon-32.png'

// Securing the application, especially on HTTP headers.
// The Helmet middleware must be the first.
const helmet = require('helmet')
// Harden helmet frameguard which default is "sameorigin", because there isn't
// any frame use in this application.
app.use(helmet({frameguard: {action: 'deny'}}))

// Hide the x-powered-by header (even if helmet does this too, better safe)
app.disable('x-powered-by')

// We don't need the "extended" query parser, so let's configure express to use
// the simple and faster one.
app.set('query parser', 'simple')

// Trust the specified IP addresses to provide true "X-Forwarded-*" headers.
// "X-Forwarded-*" headers are used to know the host name of the application as
// seen by the users. It's needed to compute the login URL on authentication
// redirects.
app.enable('trust proxy')

// Logging HTTP requests as JSON to the logger when in production, and
// otherwise outputting it in human format to stdout.
if (process.env.NODE_ENV == 'production') {
    app.use((req, res, next) => {
        onFinished(res, () => {
            logger.info({
                method: req.method,
                url: req.url,
                status: res.statusCode
            })
        })
        next()
    })
} else {
    if (['info', 'debug', 'trace'].includes(config.get('log.level'))) {
        app.use(request_logger('dev')) // output to stdout
    }
}

app.use(express.static(path.join(__dirname, 'resource')))

app.use(cookieParser())
// Middleware to parse JSON input
app.use(bodyParser.json())
// To protect against CSRF attacks, NOT globally adding the middleware to do
// application/x-www-form-urlencoded parsing.
//app.use(bodyParser.urlencoded({extended: false}));

app.use(cookieSession({
    name: config.get('session.cookie_name'),
    // A secret is used to encrypt the session cookie
    secret: config.get('common.secret'),
    domain: process.env.NODE_ENV == 'test' ? '127.0.0.1' :
        new URL(config.get('common.base_url')).host,
    // maxAge: expires at the end of session by default, later modified by
    // req.sessionOptions.maxAge for each logged user.
    secureProxy: process.env.NODE_ENV != 'test',
    httpOnly: true
}))

// Templating engine
config.nunjucks_env = nunjucks.configure(path.join(__dirname, 'view'), {express: app})

require('./routes')

// Global error handler
app.use((err, req, res, next) => {

    // Logging all errors
    logger.error(err)

    // But not outputting nor sending errors to the clients/users
    res.sendStatus(err.status || 500)
})
