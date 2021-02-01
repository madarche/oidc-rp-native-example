'use strict'

const {errors} = require('openid-client')
const OPError = errors.OPError

const logger = require('../lib/logger')
const oidc = require('../lib/oidc')

async function logIn(req, res, next) {
    try {
        const client = await oidc.getClient(req)
        const authorization_url = client.buildAuthorizationUrl()
        res.redirect(authorization_url)
    } catch (err) {
        logger.error(err)
        res.sendStatus(500)
    }
}

async function loggedIn(req, res, next) {
    const data = {
        config_info_not_for_prod: oidc.getConfigInfo(),
    }

    try {
        const client = await oidc.getClient(req)
        await client.callback()

        const token_set = client.getTokenSet()
        logger.debug(client.getTokenExpirationDetails())

        const access_token_verify = await client.introspect(token_set.access_token)
        logger.trace('access_token_verify:', access_token_verify)

        // Example of a failed verification
        // const fake_token_verify = await client.introspect('fake_value')
        // logger.trace('fake_token_verify:', fake_token_verify)

        const user_info = await client.userinfo()
        data.user_info = user_info

        // TODO: Test requesting grants
        // const result = await client.grant({grant_type: TODO});
        // logger.trace('result:', result);

        res.render('logged_in.njk', data)
    } catch (err) {
        if (err instanceof OPError &&
            err.error && err.error == 'consent_required') {
            res.status(403).send(err.error_description)
        } else {
            logger.error(err)
            res.sendStatus(500)
        }
    }
}

async function logOut(req, res, next) {
    try {
        const client = await oidc.getClient(req)
        const token_set = client.getTokenSet()

        // In case the developer/the user deleted the cookies manually.
        // It happens often when developing/debugging.
        if (!token_set) {
            res.redirect('/')
            return
        }

        const end_session_url = client.buildEndSessionUrl()
        res.redirect(end_session_url)
    } catch (err) {
        logger.error(err)
        res.sendStatus(500)
    }
}

function loggedOut(req, res, next) {
    // Destroying the session (and req.session.token_set is the information we
    // use to determine if the user is logged in).
    req.session = null

    res.redirect('/')
}

module.exports = {
    logIn,
    loggedIn,
    logOut,
    loggedOut,
}
