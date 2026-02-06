const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

const jobsFilePath = path.join(__dirname, '../data/jobs.json');

exports.register = async (req, res) => {
    try {
        const { userId, email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({
            $or: [{ userId }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({ error: 'User ID or Email already exists' });
        }

        const user = new User({
            userId,
            email,
            password, // In a real app, hash this!
            notificationPreferences: {
                email: true,
                intervals: ['1day', '6hrs', '1hr', 'exact']
            }
        });

        await user.save();
        res.status(201).json({ message: 'User registered successfully', userId });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
};

exports.login = async (req, res) => {
    try {
        const { userId, password } = req.body;

        const user = await User.findOne({ userId });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        res.json({
            message: 'Login successful',
            userId: user.userId,
            user: {
                email: user.email,
                fullName: user.fullName,
                phone: user.phone,
                notificationPreferences: user.notificationPreferences
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

exports.logout = (req, res) => {
    res.json({ message: 'Logged out successfully' });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // 1. Try to find user by registration email in Cloud DB
        let user = await User.findOne({ email });

        // 2. If not found, try to find in profile details (jobs.json fallback)
        if (!user) {
            try {
                if (fs.existsSync(jobsFilePath)) {
                    const jobs = JSON.parse(fs.readFileSync(jobsFilePath, 'utf8') || '[]');
                    const profile = jobs.find(j => j.company === 'Profile' && j.email === email);
                    if (profile && profile.userId) {
                        user = await User.findOne({ userId: profile.userId });
                    }
                }
            } catch (err) {
                console.error('Error searching profile emails:', err);
            }
        }

        if (!user) {
            return res.status(404).json({ error: 'No account found with this email address.' });
        }

        await notificationService.sendForgotPasswordEmail(email, user.password);
        res.json({ message: 'Password recovery email sent successfully.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            error: 'Failed to send recovery email.',
            details: error.message,
            code: error.code
        });
    }
};

exports.testEmail = async (req, res) => {
    try {
        const results = {
            status: 'success',
            diagnostics: {}
        };

        // Check Resend (Exclusively used for Cloud)
        if (notificationService.resend) {
            results.diagnostics.resend = {
                status: 'initialized',
                provider: 'Resend (HTTP)',
                fromEmail: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'
            };
        } else {
            results.diagnostics.resend = { status: 'not_configured', message: 'RESEND_API_KEY missing' };
            results.status = 'partial_success';
        }

        res.json(results);
    } catch (error) {
        console.error('Email Diagnosis Error:', error);
        res.status(500).json({
            status: 'error',
            error: 'Diagnostic process failed',
            details: error.message
        });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const { userId, fullName, phone } = req.body;
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        const user = await User.findOneAndUpdate(
            { userId },
            { fullName, phone },
            { new: true }
        );

        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({ message: 'Profile updated in cloud successfully', user: { fullName: user.fullName, phone: user.phone } });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update cloud profile' });
    }
};
