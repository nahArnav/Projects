const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        minlength: 1,
        maxlength: 100,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
        index: true,
    },
    passwordHash: {
        type: String,
        required: true,
    },
    deviceId: {
        type: String,
        required: true,
        index: true,
    },
    role: {
        type: String,
        enum: ['student', 'faculty'],
        default: 'student',
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerificationToken: {
        type: String,
        default: null,
    },
    failedAttempts: {
        type: Number,
        default: 0,
    },
    lockUntil: {
        type: Date,
        default: null,
    },
    tokenVersion: {
        type: Number,
        default: 0,
    },
    modelReference: {
        type: String,
        default: null,
    },
    registrationIP: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

userSchema.methods.isLocked = function () {
    if (this.lockUntil && this.lockUntil > new Date()) {
        return true;
    }
    return false;
};

userSchema.methods.incrementFailedAttempts = async function (config) {
    const updates = { $inc: { failedAttempts: 1 } };
    if (this.failedAttempts + 1 >= config.security.maxFailedAttempts) {
        updates.$set = {
            lockUntil: new Date(Date.now() + config.security.lockDurationMinutes * 60 * 1000),
        };
    }
    await this.constructor.updateOne({ _id: this._id }, updates);
};

userSchema.methods.resetFailedAttempts = async function () {
    await this.constructor.updateOne(
        { _id: this._id },
        { $set: { failedAttempts: 0, lockUntil: null } }
    );
};

module.exports = mongoose.model('User', userSchema);
