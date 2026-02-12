const notificationService = require('../services/notificationService');

/**
 * Schedule notifications for a job's interview rounds
 * POST /api/notifications/schedule
 */
exports.scheduleJobNotifications = async (req, res) => {
    try {
        const { job, user } = req.body;

        if (!job || !user) {
            return res.status(400).json({ error: 'Job and user data required' });
        }

        if (!job.rounds || job.rounds.length === 0) {
            return res.json({ message: 'No interview rounds to schedule', scheduled: 0 });
        }

        let scheduledCount = 0;

        // Cancel existing notifications for this job first to avoid duplicates
        if (job._id || job.id || job.__backendId) {
            notificationService.cancelJobNotifications(job._id || job.id || job.__backendId);
        }

        // Schedule notifications for each round
        job.rounds.forEach((round, index) => {
            if (round.datetime) {
                const notifications = notificationService.scheduleInterviewNotifications(
                    round,
                    job,
                    user,
                    job._id || job.id,
                    index
                );

                // Update round with scheduled notification IDs
                round.scheduledNotifications = notifications;
                scheduledCount += Object.keys(notifications).length;
            }
        });

        res.json({
            message: `Scheduled ${scheduledCount} notifications for ${job.rounds.length} interview rounds`,
            scheduled: scheduledCount,
            job: job
        });

    } catch (error) {
        console.error('Error scheduling notifications:', error);
        res.status(500).json({ error: 'Failed to schedule notifications' });
    }
};

/**
 * Cancel notifications for a specific job
 * DELETE /api/notifications/job/:jobId
 */
exports.cancelJobNotifications = (req, res) => {
    try {
        const { jobId } = req.params;
        const canceledCount = notificationService.cancelJobNotifications(jobId);

        res.json({
            message: `Canceled ${canceledCount} notifications for job ${jobId}`,
            canceled: canceledCount
        });

    } catch (error) {
        console.error('Error canceling notifications:', error);
        res.status(500).json({ error: 'Failed to cancel notifications' });
    }
};

/**
 * Get all scheduled notifications
 * GET /api/notifications/scheduled
 */
exports.getScheduledNotifications = (req, res) => {
    try {
        const notifications = notificationService.getScheduledNotifications();

        res.json({
            count: notifications.length,
            notifications: notifications
        });

    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
};

/**
 * Test email notification
 * POST /api/notifications/test
 */
exports.testNotification = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email required' });
        }

        const testInterview = {
            name: 'Test Interview Round',
            datetime: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour from now
        };

        const testJob = {
            company: 'Test Company',
            position: 'Test Position'
        };

        const testUser = {
            email: email,
            notificationPreferences: {
                email: true,
                intervals: ['exact']
            }
        };

        await notificationService.sendInterviewReminder(testInterview, testJob, testUser, 'exact');

        res.json({ message: 'Test email sent successfully' });

    } catch (error) {
        console.error('Error sending test email:', error);
        res.status(500).json({ error: 'Failed to send test email', details: error.message });
    }
};
