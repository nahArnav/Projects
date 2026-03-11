const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');

/**
 * Generate JWT access token (15 min)
 */
function generateAccessToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            email: user.email,
            role: user.role || 'student',
            deviceId: user.deviceId,
            tokenVersion: user.tokenVersion,
        },
        config.jwt.secret,
        { expiresIn: config.jwt.accessExpiry }
    );
}

/**
 * Generate a random refresh token string
 */
function generateRefreshToken() {
    return crypto.randomBytes(40).toString('hex');
}

/**
 * Hash a refresh token for secure storage
 */
function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Verify and decode a JWT access token
 */
function verifyAccessToken(token) {
    return jwt.verify(token, config.jwt.secret);
}

/**
 * Calculate refresh token expiry date
 */
function getRefreshTokenExpiry() {
    const days = parseInt(config.jwt.refreshExpiry) || 7;
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    verifyAccessToken,
    getRefreshTokenExpiry,
};
