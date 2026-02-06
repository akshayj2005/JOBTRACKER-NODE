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
        res.status(500).json({ error: 'Failed to send recovery email.' });
    }
};

exports.testEmail = async (req, res) => {
    try {
        await notificationService.transporter.verify();
        res.json({
            status: 'success',
            message: 'SMTP Connection Verified Successfully',
            config: {
                host: process.env.EMAIL_HOST,
                port: process.env.EMAIL_PORT,
                user: process.env.EMAIL_USER
            }
        });
    } catch (error) {
        console.error('SMTP Verification Error:', error);
        res.status(500).json({
            status: 'error',
            error: 'SMTP Connection Failed',
            details: error.message,
            code: error.code,
            command: error.command
        });
    }
};
