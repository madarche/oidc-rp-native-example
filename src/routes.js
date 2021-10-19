'use strict'

const app = require('./app')

const root = require('./controller/root')
app.route('/').get(root.renderPage)

const oidc = require('./controller/oidc')
app.route('/login').get(oidc.logIn)
app.route('/logged_in').get(oidc.loggedIn)
app.route('/logout').get(oidc.logOut)
app.route('/logged_out').get(oidc.loggedOut)
