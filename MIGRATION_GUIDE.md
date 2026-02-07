# Gmail API Migration Guide

## 1. Credentials Setup (REQUIRED)
The application now uses the Gmail API (OAuth2) instead of Resend or SMTP.
This ensures strict compliance with Render's network policies and prevents blocking.

### Action Required:
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Enable the **Gmail API**.
3.  Create OAuth 2.0 Credentials:
    - **Authorized Redirect URI**: `https://developers.google.com/oauthplayground`
4.  Use the [OAuth 2.0 Playground](https://developers.google.com/oauthplayground) to get your **Refresh Token**.
    - Configure OAuth 2.0 Configuration (top right gear icon) with your Client ID & Secret.
    - Scope: `https://mail.google.com`

### Update `.env`:
Add the following keys to your `.env` file:
```env
# Gmail API Configuration
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here
GMAIL_REDIRECT_URI=https://developers.google.com/oauthplayground

# From Address (Must match the account used for OAuth)
EMAIL_USER=your_email@gmail.com
```

## 2. Install Dependencies
Run this command in your terminal to finalize the switch:

```bash
npm uninstall resend && npm install googleapis
```

## 3. Verify
Once installed and configured, visit:
`http://localhost:3001/api/auth/test-email`
It should now show `provider: 'Gmail API (OAuth2)'` with status `initialized`.

## 4. Troubleshooting: "Error 403: access_denied"
If you see a screen saying **"JobTracker has not completed the Google verification process"**:

1.  Go to the **[Google Cloud Console - OAuth Consent Screen](https://console.cloud.google.com/apis/credentials/consent)**.
2.  Scroll down to **Test users**.
3.  Click **+ ADD USERS**.
4.  Enter your email (e.g., `akshayj2005@gmail.com` and `bbpsgrakshayj2005@gmail.com`).
5.  Click **Save**.
6.  Try the **OAuth 2.0 Playground** authorization again.
