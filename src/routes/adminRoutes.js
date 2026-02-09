const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Middleware to check if user is admin
// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    // Check for Admin Session set in authController.login
    if (req.session && req.session.isAdmin) {
        return next();
    }

    // Fallback: Check if authenticated via Passport as admin12 (if ever needed)
    if (req.user && req.user.userId === 'admin12') {
        return next();
    }

    // Access Denied
    res.status(403).send(`
        <body style="background-color: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
            <h1>Access Denied</h1>
            <p>You must be logged in as an administrator to view this page.</p>
            <a href="/" style="color: #6366f1; margin-top: 20px;">Return to Home</a>
        </body>
    `);
};

router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });

        // Filter for "Same Day New Users"
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const newUsersToday = users.filter(user => {
            const userDate = new Date(user.createdAt);
            return userDate >= today;
        });

        res.render('admin', {
            users,
            newUsersToday,
            user: req.user
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
});

// This file exports the router, which should be mounted at '/admin' in app.js
module.exports = router;
