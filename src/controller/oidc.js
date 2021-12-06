'use strict'

const {generators} = require('openid-client')

const logger = require('../lib/logger')
const oidc = require('../lib/oidc')

const {
    scope,
    redirect_uri,
    post_logout_redirect_uri,
} = oidc.getConfigInfo()

async function logIn(req, res, next) {
    try {
        const openid_client = await oidc.getOpenidClient()

        const state = generators.state()
        const nonce = generators.nonce()
        req.session.state = state
        req.session.nonce = nonce

        // Native clients specifics: PKCE code_verifier and code_challenge
        const code_verifier = generators.codeVerifier()
        const code_challenge = generators.codeChallenge(code_verifier)
        req.session.code_verifier = code_verifier
        req.session.code_challenge = code_challenge

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
        res.redirect(authorization_url)
    } catch (err) {
        next(err)
    }
}

async function loggedIn(req, res, next) {
    try {
        const openid_client = await oidc.getOpenidClient()

        const params = openid_client.callbackParams(req)

        const token_set = await openid_client.callback(
            redirect_uri,
            params, {
                state: req.session.state,
                nonce: req.session.nonce,
                // Native clients specifics: PKCE code_verifier and code_challenge
                code_verifier: req.session.code_verifier,
            })
        logger.trace('token_set:', token_set)

        req.session.token_set = token_set

        res.redirect('/')
    } catch (err) {
        next(err)
    }
}

async function logOut(req, res, next) {
    try {
        // In case the developer/the user deleted the cookies manually.
        // It happens often when developing/debugging.
        if (!req.session.token_set) {
            res.redirect('/')
            return
        }

        const openid_client = await oidc.getOpenidClient()

        const end_session_url = openid_client.endSessionUrl({
            id_token_hint: req.session.token_set.id_token,
            post_logout_redirect_uri,
            state: req.session.state,
        })

        res.redirect(end_session_url)
    } catch (err) {
        next(err)
    }
}

function loggedOut(req, res, next) {
    // Destroying the session (and req.session.token_set is the information we
    // use to determine if the user is logged in).
    req.session = null

    res.redirect('/')
}

async function refresh(req, res, next) {
    try {
        // In case the developer/the user deleted the cookies manually.
        // It happens often when developing/debugging.
        if (!req.session.token_set) {
            res.redirect('/')
            return
        }

        const client = await oidc.getOpenidClient()

        const token_set = await client.refresh(req.session.token_set.refresh_token)
        logger.trace('token_set:', token_set)

        req.session.token_set = token_set

        res.redirect('/')
    } catch (err) {
        logger.error(err)
        res.sendStatus(500)
    }
}

module.exports = {
    logIn,
    loggedIn,
    logOut,
    loggedOut,
    refresh,
}
