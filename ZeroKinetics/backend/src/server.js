const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const { generalLimiter } = require('./middleware/rateLimiter');


const authRoutes = require('./routes/auth');
const gestureRoutes = require('./routes/gesture');
const sessionRoutes = require('./routes/session');

const app = express();


app.use(helmet());
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Device-Id',
        'X-Nonce',
        'X-Timestamp',
    ],
}));
app.use(express.json({ limit: '5mb' }));
app.use(generalLimiter);

app.set('trust proxy', 1);


app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'ZeroKinetics API',
        timestamp: new Date().toISOString(),
    });
});


app.use('/api', authRoutes);
app.use('/api', gestureRoutes);
app.use('/api', sessionRoutes);


app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});


app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});


async function startServer() {
    try {
        await mongoose.connect(config.mongodbUri);
        console.log('✅ Connected to MongoDB');

        app.listen(config.port, '0.0.0.0', () => {
            console.log(`🚀 ZeroKinetics API running on port ${config.port}`);
            console.log(`   Environment: ${config.nodeEnv}`);
            console.log(`   ML API: ${config.ml.apiUrl}`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1);
    }
}


module.exports = app;


if (require.main === module) {
    startServer();
}
