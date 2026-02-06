const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        trim: true
    },
    phone: {
        type: String,
        trim: true
    },
    notificationPreferences: {
        email: { type: Boolean, default: true },
        intervals: {
            type: [String],
            default: ['1day', '6hrs', '1hr', 'exact']
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('User', userSchema);
