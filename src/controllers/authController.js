const User = require('../models/User');
const notificationService = require('../services/notificationService');

exports.register = async (req, res) => {
    try {
        const { userId, email, password, fullName } = req.body;

        if (userId === 'admin12') {
            return res.status(400).json({ error: 'This User ID is reserved.' });
        }

        // Check if user exists
        let user = await User.findOne({
            $or: [{ userId }, { email }]
        });

        if (user && user.isVerified) {
            return res.status(400).json({ error: 'User ID or Email already exists' });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

        if (user && !user.isVerified) {
            // Update existing unverified user
            user.userId = userId;
            user.fullName = fullName;
            user.email = email;
            user.password = password;
            user.otp = otp;
            user.otpExpires = otpExpires;
            await user.save();
        } else {
            // Create new user
            user = new User({
                userId,
                fullName,
                email,
                password, // In a real app, hash this!
                otp,
                otpExpires,
                isVerified: false, // MANDATORY verification
                notificationPreferences: {
                    email: true,
                    intervals: ['1day', '6hrs', '1hr', 'exact']
                }
            });
            await user.save();
        }

        // Send OTP Email
        try {
            await notificationService.sendOTPEmail(email, otp);
            res.status(200).json({
                message: 'Verification code sent to email',
                userId,
                requiresVerification: true
            });
        } catch (emailErr) {
            console.error('Failed to send OTP:', emailErr);
            // We saved the user but email failed. Allow retry.
            res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
        }

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Failed to register user' });
    }
};


exports.verifyOTP = async (req, res) => {
    try {
        const { userId, otp } = req.body;
        const user = await User.findOne({ userId });

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: 'Email verified successfully! You can now login.' });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

exports.resendOTP = async (req, res) => {
    try {
        const { userId } = req.body;
        const user = await User.findOne({ userId });

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (user.isVerified) return res.status(400).json({ error: 'User already verified' });

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
        await user.save();

        await notificationService.sendOTPEmail(user.email, otp);
        res.json({ message: 'New verification code sent.' });
    } catch (error) {
        console.error('Resend OTP error:', error);
        res.status(500).json({ error: 'Failed to resend OTP' });
    }
};

exports.login = async (req, res) => {
    try {
        const { userId, password } = req.body;

        // Admin Hardcoded Check
        if (userId === 'admin12') {
            if (password === 'password123') {
                // Set Admin Session
                req.session.isAdmin = true;
                req.session.userId = userId;

                // Establish session with req.login
                req.login({ userId: 'admin12', isAdmin: true }, (err) => {
                    if (err) {
                        return res.status(500).json({ error: 'Session creation failed' });
                    }
                    return res.json({
                        message: 'Admin Login Successful',
                        userId: 'admin12',
                        isAdmin: true,
                        user: { fullName: 'Administrator', email: 'admin@jobtracker.com' }
                    });
                });
                return;
            } else {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }

        const user = await User.findOne({ userId });

        if (!user || user.password !== password) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                error: 'Email not verified',
                requiresVerification: true,
                userId: user.userId
            });
        }

        // Establish session with req.login
        req.login(user, (err) => {
            if (err) {
                console.error('Session creation error:', err);
                return res.status(500).json({ error: 'Session creation failed' });
            }

            res.json({
                message: 'Login successful',
                userId: user.userId,
                isAdmin: false,
                user: {
                    email: user.email,
                    fullName: user.fullName,
                    phone: user.phone,
                    notificationPreferences: user.notificationPreferences
                }
            });
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
};

exports.logout = (req, res) => {
    req.logout((err) => {
        if (err) {
            return res.status(500).json({ error: 'Logout failed' });
        }
        req.session.destroy((err) => {
            if (err) {
                return res.status(500).json({ error: 'Session destruction failed' });
            }
            res.clearCookie('connect.sid'); // Clear the session cookie
            res.json({ message: 'Logged out successfully' });
        });
    });
};

exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Find user by registration email in MongoDB
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'No account found with this email address.' });
        }

        await notificationService.sendForgotPasswordEmail(email, user.password);
        res.json({ message: 'Password recovery email sent successfully.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            error: 'Failed to send recovery email.',
            details: error.message || 'Unknown error'
        });
    }
};

exports.testEmail = async (req, res) => {
    try {
        const results = {
            status: 'success',
            diagnostics: {}
        };

        // Check Gmail API (Exclusively used for Cloud)
        if (notificationService.gmail) {
            results.diagnostics.gmail = {
                status: 'initialized',
                provider: 'Gmail API (OAuth2)',
                fromEmail: process.env.EMAIL_USER || 'me'
            };
        } else {
            results.diagnostics.gmail = { status: 'not_configured', message: 'Gmail API credentials missing' };
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

exports.getProfile = async (req, res) => {
    try {
        const userId = req.user?.userId || req.params.userId;
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        // Handle Hardcoded Admin
        if (userId === 'admin12') {
            return res.json({
                userId: 'admin12',
                fullName: 'Administrator',
                email: 'admin@jobtracker.com',
                phone: 'N/A',
                isVerified: true,
                authProvider: 'local',
                notificationPreferences: { email: true, intervals: [] }
            });
        }

        const user = await User.findOne({ userId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Return only safe fields, including all profile fields
        res.json({
            userId: user.userId,
            email: user.email,
            fullName: user.fullName || '',
            phone: user.phone || '',
            profileImage: user.profileImage || '',
            location: user.location || '',
            professionalSummary: user.professionalSummary || '',
            skills: user.skills || '[]',
            experience: user.experience || '[]',
            education: user.education || '[]',
            certifications: user.certifications || '[]',
            projects: user.projects || '[]',
            linkedin: user.linkedin || '',
            github: user.github || '',
            twitter: user.twitter || '',
            website: user.website || '',
            degree: user.degree || '',
            course: user.course || ''
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
};

exports.updateProfile = async (req, res) => {
    try {
        const profileData = req.body;
        const userId = req.user?.userId || profileData.userId;
        const { email } = profileData;
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        if (userId === 'admin12') {
            return res.status(403).json({ error: 'Hardcoded admin profile cannot be modified via API' });
        }

        const user = await User.findOne({ userId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Fields to update directly
        const directFields = [
            'fullName', 'phone', 'degree', 'location',
            'professionalSummary', 'skills', 'experience',
            'education', 'certifications', 'projects',
            'linkedin', 'github', 'twitter', 'website', 'profileImage', 'course'
        ];

        directFields.forEach(field => {
            if (profileData[field] !== undefined) {
                user[field] = profileData[field];
            }
        });

        // Handle snake_case to camelCase mapping for fields that might come from legacy frontend
        if (profileData.full_name) user.fullName = profileData.full_name;
        if (profileData.professional_summary) user.professionalSummary = profileData.professional_summary;

        let emailUpdateMsg = '';
        let requiresVerification = false;

        // Check for Email Change
        if (email && email.toLowerCase() !== user.email.toLowerCase()) {
            const emailExists = await User.findOne({ email });
            if (emailExists) {
                return res.status(400).json({ error: 'Email already in use by another account.' });
            }

            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            user.pendingEmail = email;
            user.otp = otp;
            user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);

            try {
                await notificationService.sendOTPEmail(email, otp);
                emailUpdateMsg = ' A verification code has been sent to your new email.';
                requiresVerification = true;
            } catch (err) {
                console.error("Failed to send email verification OTP", err);
                return res.status(500).json({ error: 'Failed to send verification email.' });
            }
        }

        await user.save();

        res.json({
            message: 'Profile updated.' + emailUpdateMsg,
            user: {
                fullName: user.fullName,
                phone: user.phone,
                email: user.email,
                profileImage: user.profileImage
            },
            requiresVerification,
            pendingEmail: email
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
};

exports.verifyEmailChange = async (req, res) => {
    try {
        const { userId, otp } = req.body;
        const user = await User.findOne({ userId });

        if (!user) return res.status(404).json({ error: 'User not found' });
        if (!user.pendingEmail) return res.status(400).json({ error: 'No pending email change request.' });

        if (user.otp !== otp || user.otpExpires < Date.now()) {
            return res.status(400).json({ error: 'Invalid or expired verification code' });
        }

        // Apply Email Change
        user.email = user.pendingEmail;
        user.pendingEmail = undefined;
        user.otp = undefined;
        user.otpExpires = undefined;
        await user.save();

        res.json({ message: 'Email updated successfully!', newEmail: user.email });
    } catch (error) {
        console.error('Email change verification error:', error);
        res.status(500).json({ error: 'Verification failed' });
    }
};

// --- OAuth Callback Handler ---
exports.oauthCallback = (req, res) => {
    // User is already authenticated by Passport and session is established
    if (!req.user) {
        return res.redirect('/?error=AuthenticationFailed');
    }

    // Simply redirect to dashboard - session is already established
    res.redirect('/dashboard');
};
