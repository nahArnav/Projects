const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for login endpoint
 * 5 attempts per minute per IP
 */
const loginLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many login attempts. Please try again after 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

/**
 * Rate limiter for registration endpoint
 * 5 attempts per minute per IP
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'Too many registration attempts. Please try again after 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
});

/**
 * Rate limiter for gesture verification
 * 10 attempts per minute per user (keyed by user ID from JWT)
 */
const gestureLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { error: 'Too many gesture verification attempts. Please try again after 1 minute.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.userId || req.ip,
});

/**
 * General API rate limiter
 * 100 requests per minute per IP
 */
const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests. Please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = {
    loginLimiter,
    registerLimiter,
    gestureLimiter,
    generalLimiter,
};
