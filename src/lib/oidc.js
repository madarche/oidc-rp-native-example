'use strict'

const {custom, Issuer} = require('openid-client')
const {OPError} = require('openid-client').errors

const config = require('./config')
const logger = require('./logger')

custom.setHttpOptionsDefaults({
    // For requestResource: Making erros be thrown for non-2xx status codes
    // responses.
    throwHttpErrors: true,
    // Increasing the 3500 ms default to 10 seconds for some connexions that may
    // take longer.
    timeout: 10000,
})

const mask_sensitive_values = config.get('common.mask_sensitive_values')
const issuer_url = config.get('oidc.issuer_url')
const client_id = config.get('oidc.client_id')
// Native clients specifics: No client_secret
const scope = config.get('oidc.scope')
const response_types = ['code']
// Native clients specifics: No client_secret, thus no auth_method
const token_endpoint_auth_method = 'none'
const base_url = config.get('common.base_url')
const redirect_uri = new URL('/logged_in', base_url).href
const post_logout_redirect_uri = new URL('/logged_out', base_url).href

let openid_client

function getConfigInfo() {
    return {
        issuer_url,
        ...!mask_sensitive_values && {client_id},
        // Native clients specifics: No client_secret
        scope,
        response_types,
        token_endpoint_auth_method,
        redirect_uri,
        post_logout_redirect_uri,
    }
}

async function getOpenidClient() {
    if (openid_client) {
        return openid_client
    }

    try {
        const issuer = await Issuer.discover(issuer_url)
        // logger.trace('Discovered issuer %s %O', issuer.issuer, issuer.metadata);
        openid_client = new issuer.Client({
            response_types,
            client_id,
            token_endpoint_auth_method,
            // Native clients specifics: No client_secret
        })
    } catch (err) {
        logger.debug('OP cannot be reached. Check issuer_url and OP availability.')
        throw err
    }

    return openid_client
}

/**
 * Express error handler middleware
 */
function handleError(err, req, res, next) {
    if (err instanceof OPError) {
        // If not passing err.toString(), it would be equivalent to
        // "res.json(err)".
        res.send(err.toString())
    } else {
        next(err)
    }
}

module.exports = {
    getConfigInfo,
    getOpenidClient,
    handleError,
}
