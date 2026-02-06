const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');

// Schedule notifications for a job
router.post('/schedule', notificationController.scheduleJobNotifications);

// Cancel notifications for a job
router.delete('/job/:jobId', notificationController.cancelJobNotifications);

// Get all scheduled notifications
router.get('/scheduled', notificationController.getScheduledNotifications);

// Test email notification
router.post('/test', notificationController.testNotification);

module.exports = router;
