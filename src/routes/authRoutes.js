const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/logout', authController.logout);
router.post('/forgot-password', authController.forgotPassword);
router.get('/test-email', authController.testEmail);
router.put('/profile', authController.updateProfile);

module.exports = router;
