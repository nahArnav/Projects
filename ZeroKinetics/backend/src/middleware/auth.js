const { verifyAccessToken } = require('../utils/token');
const config = require('../config');
const User = require('../models/User');

const nonceStore = new Map();

setInterval(() => {
    const now = Date.now();
    for (const [nonce, timestamp] of nonceStore.entries()) {
        if (now - timestamp > config.security.nonceExpirySeconds * 1000 * 2) {
            nonceStore.delete(nonce);
        }
    }
}, 60000);

/**
 * JWT verification middleware
 * Checks: valid JWT, token version, device binding
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const token = authHeader.split(' ')[1];
        let decoded;
        try {
            decoded = verifyAccessToken(token);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Access token expired' });
            }
            return res.status(401).json({ error: 'Invalid access token' });
        }


        const requestDeviceId = req.headers['x-device-id'];
        if (!requestDeviceId || requestDeviceId !== decoded.deviceId) {
            return res.status(403).json({ error: 'Device binding mismatch' });
        }


        const user = await User.findById(decoded.userId).select('+tokenVersion');
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }
        if (user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({ error: 'Token has been revoked' });
        }

        req.user = user;
        req.userId = decoded.userId;
        req.deviceId = decoded.deviceId;
        req.userRole = user.role || 'student';
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        return res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Role authorization middleware factory
 * Usage: requireRole('faculty')
 */
function requireRole(role) {
    return (req, res, next) => {
        if (req.userRole !== role) {
            return res.status(403).json({ error: `Access denied. ${role} role required.` });
        }
        next();
    };
}

/**
 * Replay attack protection middleware
 * Checks: nonce uniqueness and timestamp freshness
 */
function replayProtection(req, res, next) {
    const nonce = req.headers['x-nonce'];
    const timestamp = req.headers['x-timestamp'];

    if (!nonce || !timestamp) {
        return res.status(400).json({ error: 'Nonce and timestamp required' });
    }

    const requestTime = parseInt(timestamp);
    const now = Date.now();


    if (Math.abs(now - requestTime) > config.security.nonceExpirySeconds * 1000) {
        return res.status(400).json({ error: 'Request timestamp expired' });
    }


    if (nonceStore.has(nonce)) {
        return res.status(400).json({ error: 'Duplicate nonce detected — replay attack blocked' });
    }


    nonceStore.set(nonce, now);
    next();
}

module.exports = {
    authenticate,
    requireRole,
    replayProtection,
    nonceStore,
};
