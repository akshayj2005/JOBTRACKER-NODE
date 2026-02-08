const fs = require('fs');
const path = require('path');
const Job = require('../models/Job');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

const jobsFilePath = path.join(__dirname, '../data/jobs.json');

// Helper to read jobs from file
exports.readJobs = () => {
    try {
        if (!fs.existsSync(jobsFilePath)) return [];
        const data = fs.readFileSync(jobsFilePath, 'utf8');
        return JSON.parse(data || '[]');
    } catch (error) {
        console.error('Error reading jobs:', error);
        return [];
    }
};

const readJobs = exports.readJobs;

// Helper to write jobs to file
const writeJobs = (jobs) => {
    try {
        fs.writeFileSync(jobsFilePath, JSON.stringify(jobs, null, 2));
        return true;
    } catch (error) {
        console.error('Error writing jobs:', error);
        return false;
    }
};

exports.getAllJobs = (req, res) => {
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const jobs = readJobs();
    const filteredJobs = jobs.filter(j => j.userId === userId || j.user_id === userId);
    res.json(filteredJobs);
};

exports.createJob = async (req, res) => {
    const userId = req.headers['x-user-id'] || req.body.user_id || req.body.userId;
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const jobs = readJobs();
    const jobData = req.body;

    const newJob = new Job(
        Date.now().toString(),
        userId,
        jobData.company,
        jobData.position,
        jobData.status
    );

    Object.keys(jobData).forEach(key => {
        if (key !== 'id' && key !== 'userId' && key !== 'user_id') {
            newJob[key] = jobData[key];
        }
    });

    jobs.push(newJob);
    if (writeJobs(jobs)) {
        // Schedule Notifications
        try {
            const user = await User.findOne({ userId });
            if (user && newJob.rounds) {
                let rounds = [];
                try {
                    rounds = typeof newJob.rounds === 'string' ? JSON.parse(newJob.rounds) : newJob.rounds;
                } catch (e) { rounds = []; }

                if (Array.isArray(rounds)) {
                    rounds.forEach((round, index) => {
                        if (round.datetime) {
                            notificationService.scheduleInterviewNotifications(round, newJob, user, newJob.id, index);
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Error scheduling notifications for new job:', err);
        }

        res.status(201).json(newJob);
    } else {
        res.status(500).json({ error: 'Failed to save job' });
    }
};

exports.updateJob = async (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    const jobs = readJobs();
    const index = jobs.findIndex(j => j.id === id && (j.userId === userId || j.user_id === userId));

    if (index === -1) {
        return res.status(404).json({ error: 'Job not found or access denied' });
    }

    const updatedJobData = req.body;
    jobs[index] = { ...jobs[index], ...updatedJobData, userId }; // Ensure userId isn't overwritten

    if (writeJobs(jobs)) {
        // Update Notifications
        try {
            notificationService.cancelJobNotifications(id); // Cancel old ones

            const user = await User.findOne({ userId });
            if (user && jobs[index].rounds) {
                let rounds = [];
                try {
                    rounds = typeof jobs[index].rounds === 'string' ? JSON.parse(jobs[index].rounds) : jobs[index].rounds;
                } catch (e) { rounds = []; }

                if (Array.isArray(rounds)) {
                    rounds.forEach((round, roundIndex) => {
                        if (round.datetime) {
                            notificationService.scheduleInterviewNotifications(round, jobs[index], user, id, roundIndex);
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Error scheduling notifications for updated job:', err);
        }

        res.json(jobs[index]);
    } else {
        res.status(500).json({ error: 'Failed to update job' });
    }
};

exports.deleteJob = (req, res) => {
    const { id } = req.params;
    const userId = req.headers['x-user-id'];
    if (!userId) return res.status(401).json({ error: 'User ID required' });

    let jobs = readJobs();
    const initialLength = jobs.length;

    jobs = jobs.filter(j => !(j.id === id && (j.userId === userId || j.user_id === userId)));

    if (jobs.length === initialLength) {
        return res.status(404).json({ error: 'Job not found or access denied' });
    }

    if (writeJobs(jobs)) {
        // Cancel Notifications
        try {
            notificationService.cancelJobNotifications(id);
        } catch (err) {
            console.error('Error canceling notifications:', err);
        }

        res.json({ message: 'Job deleted successfully' });
    } else {
        res.status(500).json({ error: 'Failed to delete job' });
    }
};
