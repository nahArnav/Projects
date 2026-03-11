const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    facultyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    courseName: {
        type: String,
        required: true,
        trim: true,
    },
    wifiSSID: {
        type: String,
        required: true,
    },
    wifiBSSID: {
        type: String,
        required: true,
    },
    startTime: {
        type: Date,
        required: true,
        default: Date.now,
    },
    endTime: {
        type: Date,
        required: true,
    },
    status: {
        type: String,
        enum: ['active', 'ended'],
        default: 'active',
    },
}, {
    timestamps: true,
});

// Auto-end expired sessions
sessionSchema.methods.isExpired = function () {
    return this.status === 'ended' || new Date() > this.endTime;
};

// Generate a unique session ID like ZK-XXXX
sessionSchema.statics.generateSessionId = function () {
    const num = Math.floor(1000 + Math.random() * 9000);
    return `ZK-${num}`;
};

module.exports = mongoose.model('Session', sessionSchema);
