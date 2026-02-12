const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Job = require('../models/Job');
const AppConfig = require('../models/AppConfig');

// Public API for In-Campus Companies (for all users)
router.get('/companies/public', async (req, res) => {
    try {
        let config = await AppConfig.findOne({ key: 'inCampusCompanies' });
        if (!config) {
            config = new AppConfig({ key: 'inCampusCompanies', value: [] });
            await config.save();
        }
        // Return in format expected by common.js: [{name: 'Company'}, ...]
        res.json(config.value.map(c => ({ name: c })));
    } catch (err) {
        res.status(500).json([]);
    }
});

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.isAdmin) {
        return next();
    }
    if (req.user && req.user.userId === 'admin12') {
        return next();
    }
    res.status(403).send(`
        <body style="background-color: #0f172a; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
            <h1>Access Denied</h1>
            <p>You must be logged in as an administrator to view this page.</p>
            <a href="/" style="color: #6366f1; margin-top: 20px;">Return to Home</a>
        </body>
    `);
};

// Admin Dashboard Page
router.get('/', isAdmin, async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
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

// API: Company-wise Stats
router.get('/api/stats/companies', isAdmin, async (req, res) => {
    try {
        const { type } = req.query;
        let matchStage = {};
        if (type && type !== 'all') {
            if (type === 'In Campus') {
                // Match both "In Campus" and "In-Campus" just in case of data inconsistencies
                matchStage = { applicationType: { $in: ['In Campus', 'In-Campus'] } };
            } else if (type === 'Off Campus') {
                matchStage = { applicationType: { $in: ['Off Campus', 'Off-Campus'] } };
            } else {
                matchStage = { applicationType: type };
            }
        }

        const stats = await Job.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$company",
                    studentCount: { $addToSet: "$userId" },
                    applicationCount: { $sum: 1 }
                }
            },
            {
                $project: {
                    company: "$_id",
                    count: { $size: "$studentCount" },
                    applications: "$applicationCount"
                }
            },
            { $sort: { count: -1 } }
        ]);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Students for a Company
router.get('/api/stats/company/:companyName', isAdmin, async (req, res) => {
    try {
        const { companyName } = req.params;
        const studentIds = await Job.distinct("userId", { company: companyName });
        const students = await User.find({ userId: { $in: studentIds } }, 'userId fullName email phone profileImage');
        res.json(students);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Detailed data for multiple companies (Batch)
router.post('/api/stats/companies/details', isAdmin, async (req, res) => {
    try {
        const { companies, type } = req.body;
        if (!Array.isArray(companies)) return res.status(400).json({ error: 'Companies list required' });

        const query = { company: { $in: companies } };
        if (type && type !== 'all') {
            if (type === 'In Campus') {
                query.applicationType = { $in: ['In Campus', 'In-Campus'] };
            } else if (type === 'Off Campus') {
                query.applicationType = { $in: ['Off Campus', 'Off-Campus'] };
            } else {
                query.applicationType = type;
            }
        }

        const jobs = await Job.find(query).lean();
        const userIds = [...new Set(jobs.map(j => j.userId))];
        const users = await User.find({ userId: { $in: userIds } }, 'userId fullName email').lean();

        // Map users for fast lookup
        const userMap = users.reduce((acc, u) => {
            acc[u.userId] = u;
            return acc;
        }, {});

        const result = jobs.map(j => ({
            ...j,
            studentName: userMap[j.userId]?.fullName || '-',
            email: userMap[j.userId]?.email || '-'
        }));

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Detailed data for multiple students (Batch)
router.post('/api/stats/students/details', isAdmin, async (req, res) => {
    try {
        const { userIds } = req.body;
        if (!Array.isArray(userIds)) return res.status(400).json({ error: 'User IDs list required' });

        const users = await User.find({ userId: { $in: userIds } }, 'userId fullName email phone isVerified course').lean();
        const jobs = await Job.find({ userId: { $in: userIds } }).lean();

        res.json({ users, jobs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Student Applications for a Company
router.get('/api/stats/student/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await User.findOne({ userId });
        const jobs = await Job.find({ userId });
        res.json({ user, jobs });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: In-Campus Companies Config
router.get('/api/config/companies', isAdmin, async (req, res) => {
    try {
        let config = await AppConfig.findOne({ key: 'inCampusCompanies' });
        if (!config) {
            config = new AppConfig({ key: 'inCampusCompanies', value: [] });
            await config.save();
        }
        res.json(config.value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/config/companies', isAdmin, async (req, res) => {
    try {
        const { company, replaceAll, newList } = req.body;

        let config = await AppConfig.findOne({ key: 'inCampusCompanies' });
        if (!config) {
            config = new AppConfig({ key: 'inCampusCompanies', value: [] });
        }

        if (replaceAll && Array.isArray(newList)) {
            config.value = newList;
        } else if (company && company !== 'DUMMY') {
            if (!Array.isArray(config.value)) config.value = [];
            if (!config.value.includes(company)) {
                config.value.push(company);
            }
        }

        config.markModified('value');
        await config.save();
        res.json(config.value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Public API for Courses
router.get('/courses/public', async (req, res) => {
    try {
        let config = await AppConfig.findOne({ key: 'courses' });
        if (!config) {
            config = new AppConfig({ key: 'courses', value: [] });
            await config.save();
        }
        res.json(config.value);
    } catch (err) {
        res.status(500).json([]);
    }
});

// API: Summary Stats (Totals + Course Breakdown)
router.get('/api/stats/summary', isAdmin, async (req, res) => {
    try {
        const totalCompanies = await Job.distinct("company");
        const totalUniqueStudents = await User.countDocuments({});

        const courseStats = await User.aggregate([
            {
                $group: {
                    _id: { $ifNull: ["$course", "Not Set"] },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    course: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);

        res.json({
            totalCompanies: totalCompanies.length,
            totalStudents: totalUniqueStudents,
            courseStats: courseStats
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Student-wise Stats (All students with counts)
router.get('/api/stats/students', isAdmin, async (req, res) => {
    try {
        const students = await User.find({}, 'userId fullName email course');
        const jobs = await Job.find({}, 'userId applicationType');

        const stats = students.map(s => {
            const studentJobs = jobs.filter(j => j.userId === s.userId);
            return {
                userId: s.userId,
                fullName: s.fullName,
                email: s.email,
                phone: s.phone || 'N/A',
                isVerified: s.isVerified,
                course: s.course || 'Not Set',
                inCampus: studentJobs.filter(j => ['In Campus', 'In-Campus'].includes(j.applicationType)).length,
                offCampus: studentJobs.filter(j => ['Off Campus', 'Off-Campus'].includes(j.applicationType)).length,
                total: studentJobs.length
            };
        });

        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Delete User and all associated data
router.delete('/api/users/:userId', isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;
        if (userId === 'admin12') {
            return res.status(403).json({ error: 'Cannot delete the admin account' });
        }

        // Delete user
        const result = await User.findOneAndDelete({ userId });
        if (!result) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Cascade delete jobs
        await Job.deleteMany({ userId });

        // Notifications are usually related to jobs, so they should be cleaned up too
        // If there's a Notification model, it would be deleted here
        try {
            const Notification = require('../models/Notification');
            if (Notification) await Notification.deleteMany({ userId });
        } catch (e) { /* Notification model might not exist or be named differently */ }

        res.json({ message: 'User and all associated data deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Course-wise Stats
router.get('/api/stats/courses', isAdmin, async (req, res) => {
    try {
        const stats = await User.aggregate([
            {
                $group: {
                    _id: { $ifNull: ["$course", "Not Set"] },
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    course: "$_id",
                    count: 1,
                    _id: 0
                }
            },
            { $sort: { count: -1 } }
        ]);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// API: Manage Courses
router.get('/api/config/courses', isAdmin, async (req, res) => {
    try {
        let config = await AppConfig.findOne({ key: 'courses' });
        if (!config) {
            config = new AppConfig({ key: 'courses', value: [] });
            await config.save();
        }
        res.json(config.value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/api/config/courses', isAdmin, async (req, res) => {
    try {
        const { courses } = req.body; // Expecting array of strings
        let config = await AppConfig.findOne({ key: 'courses' });
        if (!config) {
            config = new AppConfig({ key: 'courses', value: [] });
        }
        config.value = courses;
        await config.save();
        res.json(config.value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
