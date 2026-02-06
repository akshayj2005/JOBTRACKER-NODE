const express = require('express');
const router = express.Router();
const pageController = require('../controllers/pageController');

router.get('/', pageController.getHome);
router.get('/contact', pageController.getContact);
router.get('/dashboard', pageController.getDashboard);
router.get('/profile', pageController.getProfile);

module.exports = router;
