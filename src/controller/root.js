'use strict'

const config = require('../lib/config')
const logger = require('../lib/logger')
const oidc = require('../lib/oidc')

const resources_url = config.get('resources.url')

async function renderPage(req, res, next) {
    const data = {
        config_info_not_for_prod: oidc.getConfigInfo(),
        login_url: '/login',
        logout_url: '/logout',
    }

    try {
        const client = await oidc.getClient(req)
        const token_set = client.getTokenSet()

        if (!token_set || token_set.expired()) {
            // User NOT logged
            data.logged_in = false
        } else {
            // User may be LOGGED, but their tokens may still be invalid
            logger.debug(client.getTokenExpirationDetails())

            const access_token_verify = await client.introspect(token_set.access_token)
            logger.trace('access_token_verify:', access_token_verify)

            // Is the id_token supposed to be verifiable???
            // const id_token_verify = await client.introspect(token_set.id_token)
            // logger.trace('id_token_verify:', id_token_verify)

            // Example of a failed verification
            const fake_token_verify = await client.introspect('fake_value')
            logger.trace('fake_token_verify:', fake_token_verify)

            const user_info = await client.userinfo()
            data.user_info = user_info

            try {
                if (resources_url) {
                    logger.trace('Requesting resources from Resource Server at:', resources_url)
                    const resp = await client.requestResource(resources_url, token_set)
                    logger.trace('Response from Resource Server:', resp.body.toString())
                } else {
                    logger.trace('No resources_url not defined, so not fetching')
                }
            } catch (err) {
                logger.debug(err)
            }

            // User LOGGED if arriving to this point
            data.logged_in = true
        }

        res.render('root.njk', data)
    } catch (err) {
        logger.error(err)
        res.sendStatus(500)
    }
}

module.exports = {
    renderPage,
}
