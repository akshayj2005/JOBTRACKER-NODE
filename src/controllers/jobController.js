const Job = require('../models/Job');
const User = require('../models/User');
const notificationService = require('../services/notificationService');

exports.getAllJobs = async (req, res) => {
    try {
        const userId = req.user?.userId || req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        const jobs = await Job.find({ userId });
        res.json(jobs);
    } catch (error) {
        console.error('Error fetching jobs:', error);
        res.status(500).json({ error: 'Failed to fetch jobs' });
    }
};

exports.createJob = async (req, res) => {
    try {
        const userId = req.user?.userId || req.headers['x-user-id'] || req.body.user_id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        const jobData = req.body;

        // Ensure rounds is a string for consistency with schema
        const rounds = typeof jobData.rounds === 'object' ? JSON.stringify(jobData.rounds) : jobData.rounds || '[]';

        const newJob = new Job({
            userId,
            company: jobData.company,
            position: jobData.position,
            status: jobData.status,
            appliedDate: jobData.appliedDate || jobData.applied_date || null,
            applicationType: jobData.applicationType || 'Off Campus',
            notes: jobData.notes || '',
            rounds: rounds
        });

        await newJob.save();

        // Schedule Notifications
        try {
            let user = await User.findOne({ userId });

            if (!user && userId) {
                user = { userId, email: '', notificationPreferences: { email: true, intervals: ['1day', '6hrs', '1hr', 'exact'] } };
            }

            if (user && newJob.rounds) {
                let roundsArr = [];
                try {
                    if (typeof newJob.rounds === 'string') {
                        roundsArr = JSON.parse(newJob.rounds);
                    } else if (Array.isArray(newJob.rounds)) {
                        roundsArr = newJob.rounds;
                    }
                } catch (e) {
                    console.error('Error parsing rounds for notification:', e);
                    roundsArr = [];
                }

                if (Array.isArray(roundsArr)) {
                    roundsArr.forEach((round, index) => {
                        if (round.datetime) {
                            notificationService.scheduleInterviewNotifications(round, newJob, user, newJob._id.toString(), index);
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Error scheduling notifications for new job:', err);
        }

        res.status(201).json(newJob);
    } catch (error) {
        console.error('Error creating job:', error);
        res.status(500).json({ error: 'Failed to save job' });
    }
};

exports.updateJob = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId || req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        const updatedJobData = req.body;

        // Handle rounds as string if provided as object
        if (updatedJobData.rounds && typeof updatedJobData.rounds === 'object') {
            updatedJobData.rounds = JSON.stringify(updatedJobData.rounds);
        }

        const job = await Job.findOneAndUpdate(
            { _id: id, userId },
            { $set: updatedJobData },
            { new: true }
        );

        if (!job) {
            return res.status(404).json({ error: 'Job not found or access denied' });
        }

        // Update Notifications
        try {
            notificationService.cancelJobNotifications(id);

            let user = await User.findOne({ userId });
            if (!user && userId) {
                user = { userId, email: '', notificationPreferences: { email: true, intervals: ['1day', '6hrs', '1hr', 'exact'] } };
            }

            if (user && job.rounds) {
                let roundsArr = [];
                try {
                    if (typeof job.rounds === 'string') {
                        roundsArr = JSON.parse(job.rounds);
                    } else if (Array.isArray(job.rounds)) {
                        roundsArr = job.rounds;
                    }
                } catch (e) {
                    console.error('Error parsing rounds for notification update:', e);
                    roundsArr = [];
                }

                if (Array.isArray(roundsArr)) {
                    roundsArr.forEach((round, roundIndex) => {
                        if (round.datetime) {
                            notificationService.scheduleInterviewNotifications(round, job, user, id, roundIndex);
                        }
                    });
                }
            }
        } catch (err) {
            console.error('Error scheduling notifications for updated job:', err);
        }

        res.json(job);
    } catch (error) {
        console.error('Error updating job:', error);
        res.status(500).json({ error: 'Failed to update job' });
    }
};

exports.deleteJob = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?.userId || req.headers['x-user-id'];
        if (!userId) return res.status(401).json({ error: 'User ID required' });

        const job = await Job.findOneAndDelete({ _id: id, userId });

        if (!job) {
            return res.status(404).json({ error: 'Job not found or access denied' });
        }

        // Cancel Notifications
        try {
            notificationService.cancelJobNotifications(id);
        } catch (err) {
            console.error('Error canceling notifications:', err);
        }

        res.json({ message: 'Job deleted successfully' });
    } catch (error) {
        console.error('Error deleting job:', error);
        res.status(500).json({ error: 'Failed to delete job' });
    }
};
