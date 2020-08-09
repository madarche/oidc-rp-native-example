'use strict'

const {custom, Issuer, generators, TokenSet} = require('openid-client')

const config = require('./config')
const logger = require('./logger')

custom.setHttpOptionsDefaults({
    // For requestResource: Making erros be thrown for non-2xx status codes
    // responses.
    throwHttpErrors: true,
})

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
        client_id,
        // Native clients specifics: No client_secret
        scope,
        response_types,
        token_endpoint_auth_method,
        redirect_uri,
        post_logout_redirect_uri,
    }
}

/**
 * Returns a wrapped openid-client with session support (for nonce, state and
 * token_set) and higher-level methods.
 */
async function getClient(req) {
    if (!openid_client) {
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
            logger.error('OP cannot be reached. Check issuer_url and OP availability.')
            throw err
        }
    }

    return new WrappedClient(req)
}

class WrappedClient {

    constructor(req) {
        this.req = req
    }

    /**
     * Returns {Promise} which will be resolved with the authorization URL
     */
    buildAuthorizationUrl() {
        const state = generators.state()
        const nonce = generators.nonce()
        this.req.session.state = state
        this.req.session.nonce = nonce

        // Native clients specifics: PKCE code_verifier and code_challenge
        const code_verifier = generators.codeVerifier()
        const code_challenge = generators.codeChallenge(code_verifier)
        this.req.session.code_verifier = code_verifier
        this.req.session.code_challenge = code_challenge

        const authorization_url = openid_client.authorizationUrl({
            redirect_uri,
            scope,
            state,
            nonce,
            // Native clients specifics: PKCE code_verifier and code_challenge
            code_challenge,
            code_challenge_method: 'S256',
            // To obtain refresh token
            prompt: 'consent',
        })

        return authorization_url
    }

    async callback() {
        const params = openid_client.callbackParams(this.req)
        logger.trace('params:', params)

        // Native clients specifics: PKCE code_verifier and code_challenge
        const code_verifier = this.req.session.code_verifier
        // TODO: Find how to use code_challenge
        // const code_challenge = req.session.code_challenge;

        const token_set = await openid_client.callback(
            redirect_uri,
            params, {
                state: this.req.session.state,
                nonce: this.req.session.nonce,
                // Native clients specifics: PKCE code_verifier and code_challenge
                code_verifier,
            })
        logger.trace('token_set:', token_set)

        // Putting the token_set both in memory and in session
        this.token_set = token_set
        this.req.session.token_set = token_set
    }

    /**
     * Gets the token_set from memory if available, or otherwise from session
     */
    getTokenSet() {
        const token_set = this.token_set ? this.token_set :
            this.req.session.token_set && new TokenSet(this.req.session.token_set) || null
        return token_set
    }

    async userinfo() {
        const resp = await openid_client.userinfo(this.getTokenSet())
        return resp
    }

    async introspect(token) {
        const resp = await openid_client.introspect(token)
        return resp
    }

    async requestResource(resource_url) {
        const resp = await openid_client.requestResource(resource_url, this.getTokenSet())
        return resp
    }

    getTokenExpirationDetails() {
        const token_set = this.getTokenSet()
        const expiration_str = new Date(token_set.expires_at * 1000).toISOString()
        let details = `It is ${new Date().toISOString()}. `
        if (token_set.expired()) {
            details += `token_set EXPIRED since ${expiration_str}`
        } else {
            details += `token_set NOT expired, will expire at ${expiration_str}`
        }
        details += `\n${token_set}`
        return details
    }

    buildEndSessionUrl() {
        const token_set = this.getTokenSet()
        const end_session_url = openid_client.endSessionUrl({
            id_token_hint: token_set,
            post_logout_redirect_uri,
            state: this.req.session.state,
        })

        return end_session_url
    }
}

module.exports = {
    getConfigInfo,
    getClient,
}
