const schedule = require('node-schedule');
const { google } = require('googleapis');
require('dotenv').config();

class NotificationService {
    constructor() {
        this.scheduledJobs = new Map(); // Store scheduled jobs by ID

        const clientId = process.env.GMAIL_CLIENT_ID;
        const clientSecret = process.env.GMAIL_CLIENT_SECRET;
        const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
        const redirectUri = process.env.GMAIL_REDIRECT_URI || 'https://developers.google.com/oauthplayground';

        if (clientId && clientSecret && refreshToken) {
            const oauth2Client = new google.auth.OAuth2(
                clientId,
                clientSecret,
                redirectUri
            );

            oauth2Client.setCredentials({ refresh_token: refreshToken });
            this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
            console.log('Gmail API Service initialized (OAuth2 Mode)');
        } else {
            this.gmail = null;
            console.warn('CRITICAL: Gmail API credentials missing. Emails will NOT be sent.');
            console.log('Required: GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN');
        }
    }

    /**
     * Internal helper to send email using Gmail REST API
     */
    async sendEmail(to, subject, html, fromName = 'JobTracker') {
        if (!this.gmail) {
            console.error('Cannot send email: Gmail API is not configured.');
            return null;
        }

        try {
            const fromEmail = process.env.EMAIL_USER || 'me';

            // Build RFC822/MIME message
            const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
            const messageParts = [
                `From: ${fromName} <${fromEmail}>`,
                `To: ${to}`,
                'Content-Type: text/html; charset=utf-8',
                'MIME-Version: 1.0',
                `Subject: ${utf8Subject}`,
                '',
                html,
            ];
            const message = messageParts.join('\n');

            // Encode to Base64URL
            const encodedMessage = Buffer.from(message)
                .toString('base64')
                .replace(/\+/g, '-')
                .replace(/\//g, '_')
                .replace(/=+$/, '');

            const res = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: encodedMessage,
                },
            });

            console.log('Email sent successfully via Gmail API:', res.data.id);
            return res.data;
        } catch (err) {
            console.error('Gmail API Exception:', err);
            throw err;
        }
    }

    /**
     * Schedule notifications for an interview round
     */
    scheduleInterviewNotifications(interview, jobData, user, jobId, roundIndex) {
        if (!user.notificationPreferences.email || !user.email) {
            console.log('Email notifications disabled or no email provided');
            return {};
        }

        const interviewDate = new Date(interview.datetime);
        const now = new Date();

        if (interviewDate <= now) {
            console.log('Interview date is in the past, skipping notifications');
            return {};
        }

        const scheduledNotifications = {};
        const intervals = user.notificationPreferences.intervals || ['1day', '6hrs', '1hr', 'exact'];

        // Define notification intervals in milliseconds
        const notificationTimes = {
            '1day': 24 * 60 * 60 * 1000,  // 1 day
            '6hrs': 6 * 60 * 60 * 1000,   // 6 hours
            '1hr': 60 * 60 * 1000,        // 1 hour
            'exact': 0                     // Exact time
        };

        intervals.forEach(interval => {
            const notificationTime = new Date(interviewDate.getTime() - notificationTimes[interval]);

            if (notificationTime > now) {
                const jobKey = `${jobId}-${roundIndex}-${interval}`;

                const scheduledJob = schedule.scheduleJob(notificationTime, () => {
                    this.sendInterviewReminder(interview, jobData, user, interval);
                });

                this.scheduledJobs.set(jobKey, scheduledJob);
                scheduledNotifications[interval] = jobKey;

                console.log(`Scheduled ${interval} notification for ${interview.round || interview.name || 'Interview'} at ${notificationTime}`);
            } else {
                console.log(`Skipping ${interval} notification (time has passed)`);
            }
        });

        return scheduledNotifications;
    }

    /**
     * Send forgot password email
     */
    async sendForgotPasswordEmail(email, password) {
        const subject = '🔐 Password Recovery - JobTracker';
        const html = `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { padding: 30px; text-align: center; }
        .password-box { background-color: #f0f4ff; border: 1px solid #c3dafe; padding: 20px; border-radius: 8px; font-size: 24px; font-weight: bold; color: #4c51bf; letter-spacing: 2px; margin: 25px 0; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Recovery</h1>
        </div>
        <div class="content">
            <p>Hi there,</p>
            <p>We received a request to recover your password. Here is your current password:</p>
            <div class="password-box">${password}</div>
            <p>If you didn't request this, please ignore this email or change your password in the app for security.</p>
        </div>
        <div class="footer">
            <p>This is an automated message from JobTracker</p>
        </div>
    </div>
</body>
</html>
        `;

        return await this.sendEmail(email, subject, html, 'JobTracker Security');
    }

    /**
     * Send interview reminder email
     */
    async sendInterviewReminder(interview, jobData, user, interval) {
        const interviewDate = new Date(interview.datetime);
        const timeLabels = {
            '1day': '1 day',
            '6hrs': '6 hours',
            '1hr': '1 hour',
            'exact': 'now'
        };

        const subject = interval === 'exact'
            ? `🔔 Your interview is starting now!`
            : `🔔 Interview Reminder: ${timeLabels[interval]} to go`;

        const html = this.generateEmailTemplate(interview, jobData, user, interval, interviewDate);

        return await this.sendEmail(user.email, subject, html);
    }

    /**
     * Generate email HTML template
     */
    generateEmailTemplate(interview, jobData, user, interval, interviewDate) {
        const timeLabels = {
            '1day': 'in 1 day',
            '6hrs': 'in 6 hours',
            '1hr': 'in 1 hour',
            'exact': 'right now'
        };

        const isStartingNow = interval === 'exact';
        const roundName = interview.round || interview.name || 'Interview';
        const mainMessage = isStartingNow
            ? `Your <strong>${roundName}</strong> is starting now, good luck!`
            : `Your <strong>${roundName}</strong> will be starting soon.`;

        const formattedDate = interviewDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const formattedTime = interviewDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
            .header h1 { margin: 0; font-size: 24px; }
            .content { padding: 30px; }
            .message-box { background-color: ${isStartingNow ? '#fff5f5' : '#f0f4ff'}; border: 1px solid ${isStartingNow ? '#feb2b2' : '#c3dafe'}; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 25px; }
            .interview-details { background-color: #f8f9fa; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0; border-radius: 5px; }
            .detail-row { margin: 10px 0; }
            .label { font-weight: bold; color: #555; }
            .value { color: #333; }
            .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔔 Interview Reminder</h1>
                <p style="margin: 10px 0 0 0;">${isStartingNow ? 'Starting Now' : 'Upcoming Interview'}</p>
            </div>
            <div class="content">
                <div class="message-box">
                    <p style="margin: 0; font-size: 18px; color: #2d3748;">${mainMessage}</p>
                    ${!isStartingNow ? `<p style="margin: 10px 0 0 0; color: #4a5568; font-size: 14px;">(Time left: ${timeLabels[interval]})</p>` : ''}
                </div>
                
                <p>Hi there,</p>
                <p>Here are the details for your interview:</p>
                
                <div class="interview-details">
                    <div class="detail-row">
                        <span class="label">Round:</span>
                        <span class="value">${roundName}</span>
                    </div>
                <div class="detail-row">
                    <span class="label">Company:</span>
                    <span class="value">${jobData.company}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Position:</span>
                    <span class="value">${jobData.position}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Date:</span>
                    <span class="value">${formattedDate}</span>
                </div>
                <div class="detail-row">
                    <span class="label">Time:</span>
                    <span class="value">${formattedTime}</span>
                </div>
            </div>

            <p>Good luck! You've got this! 🍀</p>
        </div>
        <div class="footer">
            <p>This is an automated reminder from JobTracker</p>
            <p>Manage your notification preferences in your profile settings</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Cancel all notifications for a specific job
     */
    cancelJobNotifications(jobId) {
        let canceledCount = 0;

        for (const [key, job] of this.scheduledJobs.entries()) {
            if (key.startsWith(jobId)) {
                job.cancel();
                this.scheduledJobs.delete(key);
                canceledCount++;
            }
        }

        console.log(`Canceled ${canceledCount} notifications for job ${jobId}`);
        return canceledCount;
    }

    /**
     * Cancel specific round notifications
     */
    cancelRoundNotifications(jobId, roundIndex) {
        let canceledCount = 0;
        const prefix = `${jobId}-${roundIndex}`;

        for (const [key, job] of this.scheduledJobs.entries()) {
            if (key.startsWith(prefix)) {
                job.cancel();
                this.scheduledJobs.delete(key);
                canceledCount++;
            }
        }

        console.log(`Canceled ${canceledCount} notifications for round ${roundIndex} of job ${jobId}`);
        return canceledCount;
    }

    /**
     * Get all scheduled notifications
     */
    getScheduledNotifications() {
        const notifications = [];

        for (const [key, job] of this.scheduledJobs.entries()) {
            notifications.push({
                key,
                nextInvocation: job.nextInvocation()
            });
        }

        return notifications;
    }
}

// Export singleton instance
module.exports = new NotificationService();
