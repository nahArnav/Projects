const express = require('express');
const axios = require('axios');
const config = require('../config');
const { authenticate, requireRole, replayProtection } = require('../middleware/auth');
const { gestureLimiter } = require('../middleware/rateLimiter');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const User = require('../models/User');

const router = express.Router();

router.post(
    '/create-session',
    authenticate,
    requireRole('faculty'),
    replayProtection,
    async (req, res) => {
        try {
            const { courseName, durationMinutes, wifiSSID, wifiBSSID } = req.body;

            if (!courseName || !courseName.trim()) {
                return res.status(400).json({ error: 'Course name is required' });
            }
            if (!wifiSSID || !wifiBSSID) {
                return res.status(400).json({ error: 'WiFi SSID and BSSID are required' });
            }

            const duration = parseInt(durationMinutes) || config.session.defaultDuration;
            const startTime = new Date();
            const endTime = new Date(startTime.getTime() + duration * 60 * 1000);


            let sessionId;
            let attempts = 0;
            do {
                sessionId = Session.generateSessionId();
                const existing = await Session.findOne({ sessionId });
                if (!existing) break;
                attempts++;
            } while (attempts < 10);

            const session = await Session.create({
                sessionId,
                facultyId: req.userId,
                courseName: courseName.trim(),
                wifiSSID,
                wifiBSSID,
                startTime,
                endTime,
                status: 'active',
            });

            res.status(201).json({
                sessionId: session.sessionId,
                courseName: session.courseName,
                startTime: session.startTime,
                endTime: session.endTime,
                wifiSSID: session.wifiSSID,
                status: session.status,
            });
        } catch (err) {
            console.error('Create session error:', err);
            res.status(500).json({ error: 'Failed to create session' });
        }
    }
);

router.post(
    '/end-session',
    authenticate,
    requireRole('faculty'),
    replayProtection,
    async (req, res) => {
        try {
            const { sessionId } = req.body;
            if (!sessionId) {
                return res.status(400).json({ error: 'Session ID is required' });
            }

            const session = await Session.findOne({
                sessionId,
                facultyId: req.userId,
            });

            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            session.status = 'ended';
            session.endTime = new Date();
            await session.save();

            res.json({ message: 'Session ended', sessionId });
        } catch (err) {
            console.error('End session error:', err);
            res.status(500).json({ error: 'Failed to end session' });
        }
    }
);

router.get(
    '/session-status/:sessionId',
    authenticate,
    requireRole('faculty'),
    async (req, res) => {
        try {
            const session = await Session.findOne({
                sessionId: req.params.sessionId,
                facultyId: req.userId,
            });

            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }


            if (session.status === 'active' && new Date() > session.endTime) {
                session.status = 'ended';
                await session.save();
            }

            const verifiedCount = await Attendance.countDocuments({
                sessionId: session.sessionId,
                status: 'verified',
            });

            res.json({
                sessionId: session.sessionId,
                courseName: session.courseName,
                startTime: session.startTime,
                endTime: session.endTime,
                status: session.status,
                studentsVerified: verifiedCount,
                wifiSSID: session.wifiSSID,
            });
        } catch (err) {
            console.error('Session status error:', err);
            res.status(500).json({ error: 'Failed to get session status' });
        }
    }
);

router.get(
    '/session-attendance/:sessionId',
    authenticate,
    requireRole('faculty'),
    async (req, res) => {
        try {
            const session = await Session.findOne({
                sessionId: req.params.sessionId,
                facultyId: req.userId,
            });

            if (!session) {
                return res.status(404).json({ error: 'Session not found' });
            }

            const attendance = await Attendance.find({
                sessionId: session.sessionId,
            }).sort({ timestamp: 1 });

            res.json({
                sessionId: session.sessionId,
                courseName: session.courseName,
                attendance: attendance.map((a) => ({
                    studentName: a.studentName,
                    status: a.status,
                    verificationScore: a.verificationScore,
                    timestamp: a.timestamp,
                })),
            });
        } catch (err) {
            console.error('Session attendance error:', err);
            res.status(500).json({ error: 'Failed to get attendance' });
        }
    }
);

router.post(
    '/validate-session',
    authenticate,
    async (req, res) => {
        try {
            const { sessionId } = req.body;

            if (!sessionId) {
                return res.status(400).json({ error: 'Session ID is required' });
            }

            const session = await Session.findOne({ sessionId });
            if (!session) {
                return res.status(404).json({ error: 'Session not found', sessionValid: false });
            }

            if (session.status === 'ended' || new Date() > session.endTime) {
                if (session.status === 'active') {
                    session.status = 'ended';
                    await session.save();
                }
                return res.status(400).json({ error: 'Session has ended', sessionValid: false });
            }

            const existingAttendance = await Attendance.findOne({
                studentId: req.userId,
                sessionId,
                status: 'verified',
            });
            if (existingAttendance) {
                return res.status(409).json({
                    error: 'Already verified for this session',
                    sessionValid: false,
                    timestamp: existingAttendance.timestamp,
                });
            }

            res.json({
                sessionValid: true,
                wifiSSID: session.wifiSSID,
                wifiBSSID: session.wifiBSSID,
                courseName: session.courseName,
            });
        } catch (err) {
            console.error('Validate session error:', err);
            res.status(500).json({ error: 'Failed to validate session' });
        }
    }
);

router.post(
    '/join-session',
    authenticate,
    replayProtection,
    gestureLimiter,
    async (req, res) => {
        try {
            const { sessionId, wifiSSID, wifiBSSID, gestureData } = req.body;

            if (!sessionId) {
                return res.status(400).json({ error: 'Session ID is required' });
            }
            if (!wifiSSID || !wifiBSSID) {
                return res.status(400).json({ error: 'WiFi information is required' });
            }
            if (!Array.isArray(gestureData) || gestureData.length === 0) {
                return res.status(400).json({ error: 'Gesture data is required' });
            }

            const session = await Session.findOne({ sessionId });
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

            if (session.wifiBSSID !== wifiBSSID) {
                return res.status(403).json({
                    error: 'Access Denied',
                    reason: 'Not connected to classroom network',
                });
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

            const user = req.user;
            if (!user.modelReference) {
                return res.status(400).json({
                    error: 'Gesture enrollment not completed. Please enroll your gesture first.',
                });
            }

            let mlResult;
            try {
                const mlResponse = await axios.post(
                    `${config.ml.apiUrl}/predict`,
                    {
                        userId: req.userId,
                        gestureData,
                    },
                    { timeout: 10000 }
                );
                mlResult = mlResponse.data;
            } catch (mlErr) {
                console.error('ML inference error:', mlErr.message);
                return res.status(503).json({ error: 'ML inference service unavailable' });
            }

            console.log('ML RESPONSE (join-session):', mlResult);

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

            await Attendance.create({
                studentId: req.userId,
                sessionId,
                studentName: user.name,
                verificationScore: parseFloat(confidence.toFixed(4)),
                timestamp: new Date(),
                status: isVerified ? 'verified' : 'failed',
            });

            if (isVerified) {
                res.json({
                    status: 'verified',
                    message: 'Attendance recorded successfully',
                    confidence: parseFloat(confidence.toFixed(4)),
                    verified: true,
                });
            } else {
                res.json({
                    status: 'failed',
                    message: 'Gesture verification failed — does not match enrolled pattern',
                    confidence: parseFloat(confidence.toFixed(4)),
                    verified: false,
                });
            }
        } catch (err) {
            console.error('Join session error:', err);
            res.status(500).json({ error: 'Failed to join session' });
        }
    }
);

module.exports = router;
