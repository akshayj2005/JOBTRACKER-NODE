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
    },
    otp: { type: String },
    otpExpires: { type: Date },
    isVerified: { type: Boolean, default: false },
    pendingEmail: { type: String, trim: true, lowercase: true },
    googleId: { type: String },
    githubId: { type: String },
    profileImage: { type: String },
    authProvider: { type: String, default: 'local' },
    // Profile Fields
    location: { type: String, trim: true },
    professionalSummary: { type: String, trim: true },
    skills: { type: String, default: '[]' },
    experience: { type: String, default: '[]' },
    education: { type: String, default: '[]' },
    certifications: { type: String, default: '[]' },
    projects: { type: String, default: '[]' },
    linkedin: { type: String, trim: true },
    github: { type: String, trim: true },
    twitter: { type: String, trim: true },
    website: { type: String, trim: true },
    degree: { type: String, trim: true },
    course: { type: String, trim: true }
});

module.exports = mongoose.model('User', userSchema);
