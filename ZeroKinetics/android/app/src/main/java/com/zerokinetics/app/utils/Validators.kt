package com.zerokinetics.app.utils

/**
 * Client-side input validators matching backend requirements.
 */
object Validators {

    private val EMAIL_REGEX = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun isValidEmail(email: String): Boolean = EMAIL_REGEX.matches(email.trim())

    /**
     * Strong password: min 8 chars, upper, lower, digit, symbol
     */
    fun isStrongPassword(password: String): Boolean {
        if (password.length < 8) return false
        if (!password.any { it.isUpperCase() }) return false
        if (!password.any { it.isLowerCase() }) return false
        if (!password.any { it.isDigit() }) return false
        if (!password.any { !it.isLetterOrDigit() }) return false
        return true
    }

    fun isValidName(name: String): Boolean =
        name.trim().length in 1..100
}
