'use strict'

const app = require('./app')

const root = require('./controller/root')
app.route('/').get(root.renderPage)

const oidc_auth = require('./controller/oidc_auth')
app.route('/login').get(oidc_auth.logIn)
app.route('/logged_in').get(oidc_auth.loggedIn)
app.route('/logout').get(oidc_auth.logOut)
app.route('/logged_out').get(oidc_auth.loggedOut)
