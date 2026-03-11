const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const config = require('../config');
const {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    verifyAccessToken,
    getRefreshTokenExpiry,
} = require('../utils/token');
const { isValidEmail, isStrongPassword, sanitizeInput, isValidName } = require('../utils/validation');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');

const router = express.Router();


router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { name, email, password, deviceId } = req.body;


        const cleanName = sanitizeInput(name);
        const cleanEmail = sanitizeInput(email);

        if (!isValidName(cleanName)) {
            return res.status(400).json({ error: 'Name is required (1–100 characters)' });
        }
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol',
            });
        }
        if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8) {
            return res.status(400).json({ error: 'Valid device ID is required' });
        }


        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }


        const passwordHash = await bcrypt.hash(password, 12);


        const emailVerificationToken = crypto.randomBytes(32).toString('hex');


        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            passwordHash,
            deviceId,
            emailVerificationToken,
            registrationIP: req.ip,
        });


        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);

        await RefreshToken.create({
            userId: user._id,
            tokenHash: refreshTokenHash,
            expiresAt: getRefreshTokenExpiry(),
        });

        res.status(201).json({
            message: 'Registration successful',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                emailVerified: user.emailVerified,
            },
            role: 'student',
            accessToken,
            refreshToken,
            emailVerificationToken,
        });
    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({ error: 'Registration failed' });
    }
});


router.post('/register-faculty', registerLimiter, async (req, res) => {
    try {
        const { name, email, password, deviceId, facultyCode } = req.body;


        if (!facultyCode || facultyCode !== config.faculty.code) {
            return res.status(403).json({ error: 'Invalid faculty code' });
        }


        const cleanName = sanitizeInput(name);
        const cleanEmail = sanitizeInput(email);

        if (!isValidName(cleanName)) {
            return res.status(400).json({ error: 'Name is required (1–100 characters)' });
        }
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (!isStrongPassword(password)) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters with uppercase, lowercase, number, and symbol',
            });
        }
        if (!deviceId || typeof deviceId !== 'string' || deviceId.length < 8) {
            return res.status(400).json({ error: 'Valid device ID is required' });
        }


        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.status(409).json({ error: 'Email already registered' });
        }


        const passwordHash = await bcrypt.hash(password, 12);


        const user = await User.create({
            name: cleanName,
            email: cleanEmail,
            passwordHash,
            deviceId,
            role: 'faculty',
            emailVerified: true,
            registrationIP: req.ip,
        });

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);

        await RefreshToken.create({
            userId: user._id,
            tokenHash: refreshTokenHash,
            expiresAt: getRefreshTokenExpiry(),
        });

        res.status(201).json({
            message: 'Faculty account created',
            role: 'faculty',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            accessToken,
            refreshToken,
        });
    } catch (err) {
        console.error('Faculty registration error:', err);
        res.status(500).json({ error: 'Faculty registration failed' });
    }
});


router.post('/verify-email', async (req, res) => {
    try {
        const { token } = req.body;
        if (!token) {
            return res.status(400).json({ error: 'Verification token required' });
        }

        const user = await User.findOne({ emailVerificationToken: token });
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        user.emailVerified = true;
        user.emailVerificationToken = null;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (err) {
        console.error('Email verification error:', err);
        res.status(500).json({ error: 'Email verification failed' });
    }
});


router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { email, password, deviceId } = req.body;

        const cleanEmail = sanitizeInput(email);
        if (!isValidEmail(cleanEmail)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }
        if (!deviceId) {
            return res.status(400).json({ error: 'Device ID is required' });
        }


        const user = await User.findOne({ email: cleanEmail });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }


        if (user.isLocked()) {
            const lockRemaining = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return res.status(423).json({
                error: `Account locked. Try again in ${lockRemaining} minute(s)`,
            });
        }


        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            await user.incrementFailedAttempts(config);
            return res.status(401).json({ error: 'Invalid email or password' });
        }


        if (user.deviceId !== deviceId) {
            return res.status(403).json({
                error: 'Device mismatch. This account is bound to a different device.',
            });
        }


        await user.resetFailedAttempts();

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const refreshTokenHash = hashToken(refreshToken);

        await RefreshToken.create({
            userId: user._id,
            tokenHash: refreshTokenHash,
            expiresAt: getRefreshTokenExpiry(),
        });

        const isFaculty = user.role === 'faculty';
        res.json({
            message: isFaculty
                ? 'Login successful'
                : 'Login successful — gesture verification required',
            requiresGesture: !isFaculty,
            role: user.role || 'student',
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
            },
            accessToken,
            refreshToken,
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Login failed' });
    }
});


router.post('/refresh-token', async (req, res) => {
    try {
        const { refreshToken: incomingToken } = req.body;
        if (!incomingToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        const incomingHash = hashToken(incomingToken);
        const storedToken = await RefreshToken.findOne({ tokenHash: incomingHash });

        if (!storedToken) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        if (storedToken.expiresAt < new Date()) {
            await RefreshToken.deleteOne({ _id: storedToken._id });
            return res.status(401).json({ error: 'Refresh token expired' });
        }


        await RefreshToken.deleteOne({ _id: storedToken._id });


        const user = await User.findById(storedToken.userId);
        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }


        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken();
        const newRefreshHash = hashToken(newRefreshToken);

        await RefreshToken.create({
            userId: user._id,
            tokenHash: newRefreshHash,
            expiresAt: getRefreshTokenExpiry(),
        });

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (err) {
        console.error('Token refresh error:', err);
        res.status(500).json({ error: 'Token refresh failed' });
    }
});


router.post('/logout', async (req, res) => {
    try {
        const { refreshToken: incomingToken } = req.body;
        if (incomingToken) {
            const tokenHash = hashToken(incomingToken);
            await RefreshToken.deleteOne({ tokenHash });
        }


        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            try {
                const decoded = verifyAccessToken(authHeader.split(' ')[1]);
                await User.updateOne(
                    { _id: decoded.userId },
                    { $inc: { tokenVersion: 1 } }
                );
            } catch (_) {
                // Token might already be expired — that's fine
            }
        }

        res.json({ message: 'Logged out successfully' });
    } catch (err) {
        console.error('Logout error:', err);
        res.status(500).json({ error: 'Logout failed' });
    }
});

module.exports = router;
