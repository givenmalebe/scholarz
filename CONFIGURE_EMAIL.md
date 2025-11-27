# Quick Email Configuration Guide

## Step 1: Get Your Email Credentials

### If using Gmail:
1. Go to https://myaccount.google.com/apppasswords
2. Sign in to your Google account
3. Enable 2-Step Verification if you haven't already
4. Select "Mail" and "Other (Custom name)"
5. Enter "Scholarz" as the app name
6. Click "Generate"
7. Copy the 16-character app password (you'll need this)

### If using another email provider:
- Use your SMTP server settings
- Common providers:
  - Outlook: smtp-mail.outlook.com, port 587
  - Custom SMTP: Check with your email provider

## Step 2: Configure Firebase

Run this command with your actual credentials:

```bash
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password" email.host="smtp.gmail.com" email.port="587"
```

**Important:** 
- Replace `your-email@gmail.com` with your actual email
- Replace `your-app-password` with the 16-character app password from Gmail
- For Gmail, use `smtp.gmail.com` and port `587`
- For other providers, adjust the host and port accordingly

## Step 3: Verify Configuration

After running the command, verify it was set correctly:

```bash
firebase functions:config:get
```

You should see your email configuration (password will be hidden for security).

## Step 4: Test

Create a notification in the system and check if the email is sent. You can also check the Firebase Functions logs:

```bash
firebase functions:log
```

## Troubleshooting

- **"Authentication failed"**: Make sure you're using an App Password for Gmail, not your regular password
- **"Connection timeout"**: Check your SMTP host and port settings
- **No emails sent**: Check Firebase Functions logs for error messages

