require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('Testing SMTP Configuration...\n');
console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***SET***' : 'NOT SET');
console.log('\n---\n');

const port = parseInt(process.env.EMAIL_PORT) || 587;
const config = {
    host: 'smtp.gmail.com',
    port: port,
    secure: port === 465,
    requireTLS: port === 587,
    auth: {
        user: process.env.EMAIL_USER,
        pass: (process.env.EMAIL_PASS || '').replace(/\s/g, '')
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    family: 4, // Force IPv4
    dnsTimeout: 10000,
    tls: {
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2'
    },
    logger: true,
    debug: true
};

console.log('Creating transporter with config:', JSON.stringify({
    ...config,
    auth: { user: config.auth.user, pass: '***' }
}, null, 2));
console.log('\n---\n');

const transporter = nodemailer.createTransport(config);

console.log('Verifying SMTP connection...\n');

transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Connection FAILED:');
        console.error('Error:', error.message);
        console.error('Code:', error.code);
        console.error('Command:', error.command);
        console.error('\nFull error:', error);
        process.exit(1);
    } else {
        console.log('✅ SMTP Connection SUCCESSFUL!');
        console.log('Server is ready to send emails');
        process.exit(0);
    }
});
