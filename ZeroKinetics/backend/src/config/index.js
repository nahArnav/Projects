require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/zerokinetics',

  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-do-not-use-in-prod',
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
  },

  ml: {
    apiUrl: process.env.ML_API_URL || 'http://localhost:8000',
    gestureThreshold: parseFloat(process.env.GESTURE_THRESHOLD) || 0.75,
  },

  faculty: {
    code: process.env.FACULTY_CODE || 'ZEROKINETICS-FACULTY',
  },

  session: {
    defaultDuration: parseInt(process.env.SESSION_DEFAULT_DURATION) || 5,
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@zerokinetics.com',
  },

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

  security: {
    maxFailedAttempts: parseInt(process.env.MAX_FAILED_ATTEMPTS) || 5,
    lockDurationMinutes: parseInt(process.env.LOCK_DURATION_MINUTES) || 15,
    nonceExpirySeconds: parseInt(process.env.NONCE_EXPIRY_SECONDS) || 30,
  },
};
