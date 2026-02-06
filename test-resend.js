const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
    console.log('Testing Resend with Key:', process.env.RESEND_API_KEY.substring(0, 10) + '...');
    try {
        const { data, error } = await resend.emails.send({
            from: 'JobTracker <onboarding@resend.dev>',
            to: ['bbpsgrakshayj2005@gmail.com'],
            subject: 'Diagnostic Test',
            html: '<strong>Resend testing...</strong>',
        });

        if (error) {
            console.error('Resend API Error:', JSON.stringify(error, null, 2));
        } else {
            console.log('Success! Data:', data);
        }
    } catch (err) {
        console.error('Fatal Exception:', err);
    }
}

test();
