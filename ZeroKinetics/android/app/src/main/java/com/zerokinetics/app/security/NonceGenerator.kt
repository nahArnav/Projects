package com.zerokinetics.app.security

import java.util.UUID

/**
 * Generates unique nonces and timestamps for replay attack protection.
 * Each request to a protected endpoint must include a fresh nonce + timestamp.
 */
object NonceGenerator {

    /**
     * Generate a unique nonce string (UUID v4)
     */
    fun generateNonce(): String = UUID.randomUUID().toString()

    /**
     * Generate the current timestamp in milliseconds
     */
    fun generateTimestamp(): String = System.currentTimeMillis().toString()
}
