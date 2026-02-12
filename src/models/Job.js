const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        trim: true
    },
    company: {
        type: String,
        required: true,
        trim: true
    },
    position: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        required: true,
        trim: true
    },
    appliedDate: {
        type: Date,
        default: null
    },
    applicationType: {
        type: String,
        enum: ['In Campus', 'Off Campus'],
        default: 'Off Campus'
    },
    notes: {
        type: String,
        default: ''
    },
    rounds: {
        type: String, // Stored as stringified JSON to match legacy data structure
        default: '[]'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Job', jobSchema);
