'use strict'

const {TokenSet} = require('openid-client')
const {OPError} = require('openid-client').errors

const config = require('../lib/config')
const logger = require('../lib/logger')
const oidc = require('../lib/oidc')

const resources_url = config.get('resources.url')

async function renderPage(req, res, next) {
    const data = {
        config_info_not_for_prod: oidc.getConfigInfo(),
        login_url: '/login',
        logout_url: '/logout',
        refresh_url: '/refresh',
    }

    try {
        const client = await oidc.getOpenidClient()

        const token_set = req.session.token_set
        if (token_set && !new TokenSet(req.session.token_set).expired()) {

            // User may still be LOGGED, but their tokens may still be invalid
            // from the OP (revoked, user logged-out from OP).
            try {
                const introspection = await client.introspect(token_set.access_token)
                logger.trace('introspection:', introspection)

                const user_info = await client.userinfo(token_set.access_token)
                data.user_info = user_info

                try {
                    if (resources_url) {
                        logger.trace('Requesting resources from Resource Server at:', resources_url)
                        const resp = await client.requestResource(resources_url, token_set)
                        logger.trace('Response from Resource Server:',
                            resp.headers, resp.body.toString())
                    } else {
                        logger.trace('No resources_url not defined, so not fetching')
                    }
                } catch (err) {
                    logger.debug(err)
                }

                // User LOGGED if arriving to this point
                data.logged_in = true
            } catch (err) {
                if (err instanceof OPError && err.error == 'invalid_token') {
                    logger.debug('invalid_token so destroying the application session')
                    req.session = null
                } else {
                    throw err
                }
            }
        }

        res.render('root.njk', data)
    } catch (err) {
        next(err)
    }
}

module.exports = {
    renderPage,
}
