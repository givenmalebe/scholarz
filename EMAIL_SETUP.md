                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # Email Notification Setup

This application sends email notifications to users when they receive notifications in the system. The email functionality is implemented using Firebase Cloud Functions with Nodemailer.

## Configuration

To enable email notifications, you need to configure email credentials. You can do this in two ways:

### Opti                                                                                                        on                                                                                                                                                                                                                                                                                                                                  1:                                                                                                                                                                                                                                                                                                                                                  Using Firebase Functions Config (Recommended)                                                                                                                                                                                                                   

```bash
firebase functions:config:set email.user="your-email@gmail.com" email.password="your-app-password" email.host="smtp.gmail.com" email.port="587"
```

For Gmail, you'll need to:
1. Enable 2-Step Verification on your Google account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the App Password (not your regular password) in the config

### Option 2: Using Environment Variables

Set these environment variables in your Firebase Functions environment:

- `EMAIL_USER`: Your email address
- `EMAIL_PASSWORD`: Your email password or app password
- `EMAIL_HOST`: SMTP host (default: smtp.gmail.com)
- `EMAIL_PORT`: SMTP port (default: 587)

## Supported Email Providers

The system works with any SMTP provider. Common configurations:

### Gmail
- Host: `smtp.gmail.com`
- Port: `587` (TLS) or `465` (SSL)
- Requires App Password (not regular password)

### Outlook/Hotmail
- Host: `smtp-mail.outlook.com`
- Port: `587`

### Custom SMTP Server
- Configure your own SMTP server details

## Email Features

- **Automatic sending**: Emails are sent automatically when notifications are created
- **HTML formatting**: Beautiful, responsive HTML emails with:
  - Color-coded headers based on notification type
  - Icons for different notification types
  - Clickable "View Details" buttons
  - Professional styling
- **Plain text fallback**: Plain text version included for email clients that don't support HTML
- **Error handling**: Gracefully handles errors without breaking the notification system

## Notification Types

The email system supports all notification types:
- 📋 Engagement notifications
- 💬 Message notifications
- 💰 Payment notifications
- ⭐ Rating notifications
- 📄 Document notifications
- 🔔 System notifications
- ❌ Rejection notifications
- ✅ Verification notifications

## Testing

After deploying the functions, test by creating a notification in the system. The email will be sent automatically to the user's registered email address.

## Troubleshooting

1. **Emails not sending**: Check Firebase Functions logs:
   ```bash
   firebase functions:log
   ```

2. **Gmail authentication errors**: Make sure you're using an App Password, not your regular password

3. **Email credentials not found**: The function will log a warning and skip email sending if credentials aren't configured. This won't break the notification system.

## Deployment

After configuring email credentials, deploy the functions:

```bash
firebase deploy --only functions
```

