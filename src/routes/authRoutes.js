const express = require('express');
const router = express.Router();
const passport = require('passport');
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.get('/test-email', authController.testEmail);
router.post('/verify', authController.verifyOTP);
router.post('/resend-otp', authController.resendOTP);
router.get('/profile/:userId', authController.getProfile);
router.put('/profile', authController.updateProfile);
router.post('/verify-email-change', authController.verifyEmailChange);

// Google Authentication
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback',
    passport.authenticate('google', { failureRedirect: '/?error=GoogleAuthFailed' }),
    (req, res) => authController.oauthCallback(req, res)
);

// GitHub Authentication
router.get('/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/github/callback',
    passport.authenticate('github', { failureRedirect: '/?error=GitHubAuthFailed' }),
    (req, res) => authController.oauthCallback(req, res)
);

module.exports = router;
