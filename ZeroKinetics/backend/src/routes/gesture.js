const express = require('express');
const axios = require('axios');
const config = require('../config');
const { authenticate, replayProtection } = require('../middleware/auth');
const { gestureLimiter } = require('../middleware/rateLimiter');
const User = require('../models/User');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    getRefreshTokenExpiry,
} = require('../utils/token');
const RefreshToken = require('../models/RefreshToken');

const router = express.Router();


router.post('/enroll-gesture', authenticate, replayProtection, async (req, res) => {
    try {
        const { gestureSamples } = req.body;

        if (!Array.isArray(gestureSamples) || gestureSamples.length < 50) {
            return res.status(400).json({
                error: `Minimum 50 gesture samples required. Received: ${Array.isArray(gestureSamples) ? gestureSamples.length : 0
                    }`,
            });
        }


        for (let i = 0; i < gestureSamples.length; i++) {
            const sample = gestureSamples[i];
            if (!Array.isArray(sample.data) || sample.data.length === 0) {
                return res.status(400).json({
                    error: `Invalid gesture sample at index ${i}: data array required`,
                });
            }
        }


        try {
            const mlResponse = await axios.post(`${config.ml.apiUrl}/train`, {
                userId: req.userId,
                gestureSamples,
            }, { timeout: 120000 });


            if (mlResponse.data && mlResponse.data.modelId) {
                await User.updateOne(
                    { _id: req.userId },
                    { $set: { modelReference: mlResponse.data.modelId } }
                );
            }

            res.json({
                message: 'Gesture enrollment successful — model training initiated',
                modelId: mlResponse.data?.modelId,
                status: mlResponse.data?.status || 'training',
            });
        } catch (mlErr) {
            console.error('ML training service error:', mlErr.message);

            res.status(202).json({
                message: 'Gesture samples received. ML training will be processed when available.',
                samplesReceived: gestureSamples.length,
            });
        }
    } catch (err) {
        console.error('Gesture enrollment error:', err);
        res.status(500).json({ error: 'Gesture enrollment failed' });
    }
});

router.post(
    '/verify-gesture',
    authenticate,
    replayProtection,
    gestureLimiter,
    async (req, res) => {
        try {
            const { gestureData, sessionId } = req.body;

            if (!Array.isArray(gestureData) || gestureData.length === 0) {
                return res.status(400).json({ error: 'Gesture data array required' });
            }

            const user = req.user;

            if (!user.modelReference) {
                return res.status(400).json({
                    error: 'Gesture enrollment not completed. Please enroll your gesture first.',
                });
            }

            // --- Session pre-validation (when attending) ---
            let session = null;
            if (sessionId) {
                session = await Session.findOne({ sessionId });
                if (!session) {
                    return res.status(404).json({ error: 'Session not found' });
                }
                if (session.status === 'ended' || new Date() > session.endTime) {
                    if (session.status === 'active') {
                        session.status = 'ended';
                        await session.save();
                    }
                    return res.status(400).json({ error: 'Session has ended' });
                }
                const existingAttendance = await Attendance.findOne({
                    studentId: req.userId,
                    sessionId,
                    status: 'verified',
                });
                if (existingAttendance) {
                    return res.status(409).json({
                        error: 'Already verified for this session',
                        timestamp: existingAttendance.timestamp,
                    });
                }
            }

            // --- ML gesture verification ---
            let mlResult;
            try {
                const mlResponse = await axios.post(`${config.ml.apiUrl}/predict`, {
                    userId: req.userId,
                    modelId: user.modelReference,
                    gestureData,
                }, { timeout: 20000 });

                mlResult = mlResponse.data;
            } catch (mlErr) {
                console.error('ML inference error:', mlErr.message);
                return res.status(503).json({ error: 'ML inference service unavailable' });
            }

            console.log('ML RESPONSE:', mlResult);

            const verified = mlResult?.verified;
            const authenticated = mlResult?.authenticated;
            const probability = mlResult?.probability;
            const distance = mlResult?.distance;

            const confidence =
                mlResult?.confidence ??
                probability ??
                (typeof distance === 'number' ? parseFloat((1 - distance).toFixed(4)) : null);

            if (confidence === null && verified !== true && authenticated !== true) {
                return res.status(500).json({ error: 'Invalid ML response' });
            }

            const isVerified =
                verified === true ||
                authenticated === true ||
                (typeof probability === 'number' && probability >= config.ml.gestureThreshold);

            // --- Session-aware attendance flow ---
            if (sessionId && session) {
                await Attendance.findOneAndUpdate(
                    { studentId: req.userId, sessionId },
                    {
                        studentName: user.name,
                        verificationScore: parseFloat(confidence.toFixed(4)),
                        timestamp: new Date(),
                        status: isVerified ? 'verified' : 'failed',
                    },
                    { upsert: true, new: true }
                );

                if (isVerified) {
                    return res.json({
                        status: 'verified',
                        message: 'Attendance recorded successfully',
                        confidence: parseFloat(confidence.toFixed(4)),
                        verified: true,
                        courseName: session.courseName,
                    });
                } else {
                    return res.json({
                        status: 'failed',
                        message: 'Gesture verification failed — does not match enrolled pattern',
                        confidence: parseFloat(confidence.toFixed(4)),
                        verified: false,
                    });
                }
            }

            // --- Standalone verification (no session) ---
            if (isVerified) {
                await user.resetFailedAttempts();

                const accessToken = generateAccessToken(user);
                const refreshToken = generateRefreshToken();
                await RefreshToken.create({
                    userId: user._id,
                    tokenHash: hashToken(refreshToken),
                    expiresAt: getRefreshTokenExpiry(),
                });

                return res.json({
                    status: 'verified',
                    confidence: parseFloat(confidence.toFixed(4)),
                    message: 'Gesture verified successfully',
                    accessToken,
                    refreshToken,
                });
            } else {
                await user.incrementFailedAttempts(config);

                const remainingAttempts = Math.max(
                    0,
                    config.security.maxFailedAttempts - (user.failedAttempts + 1)
                );

                return res.json({
                    status: 'rejected',
                    confidence: parseFloat(confidence.toFixed(4)),
                    message: 'Gesture verification failed — does not match enrolled pattern',
                    remainingAttempts,
                });
            }
        } catch (err) {
            console.error('Gesture verification error:', err);
            res.status(500).json({ error: 'Gesture verification failed' });
        }
    }
);

module.exports = router;
