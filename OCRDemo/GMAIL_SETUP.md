# Gmail API Setup Guide

This guide will help you set up Gmail API credentials for the OCR Demo system.

## Step 1: Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown and select "New Project"
3. Enter a project name (e.g., "OCR Demo Gmail Integration")
4. Click "Create"

## Step 2: Enable Gmail API

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API" and then click "Enable"

## Step 3: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type (unless you have Google Workspace)
   - Fill in the application name: "OCR Demo"
   - Add your email as a developer email
   - Add scopes: 
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
   - **IMPORTANT**: In the "Test users" section, add your email address (e.g., `st7ma784@gmail.com`)
4. For Application type, select "Web application"
5. Add authorized redirect URIs:
   - `http://localhost:5001/auth/gmail/callback`
   - `http://127.0.0.1:5001/auth/gmail/callback`
6. Click "Create"

## Step 4: Download Credentials

1. After creating the OAuth client, click the download button (📥) next to your client ID
2. Save the file as `credentials.json` in the `OCRDemo/credentials/` directory
3. The file should look like this:

```json
{
  "web": {
    "client_id": "your-client-id.googleusercontent.com",
    "project_id": "your-project-id",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
    "client_secret": "your-client-secret",
    "redirect_uris": ["http://localhost:5001/auth/gmail/callback"]
  }
}
```

## Step 5: Update Environment Variables

1. Edit your `.env` file and add the following:

```bash
# Gmail API Configuration
GMAIL_CLIENT_ID=your-client-id.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REDIRECT_URI=http://localhost:5001/auth/gmail/callback
GMAIL_TARGET_EMAIL=+RMA@gmail.com
```

## Step 6: Initial Authentication

1. Start the OCR Demo application:
   ```bash
   docker-compose up -d
   ```

2. Open your browser and go to: `http://localhost:5001/auth/gmail`

3. You'll be redirected to Google's OAuth consent screen
4. Grant permission to access your Gmail account
5. After successful authentication, you'll be redirected back to the dashboard

## Step 7: Verify Authentication

1. On the dashboard, click "Test API Connection"
2. You should see a success message indicating Gmail API is working
3. The system will now monitor your Gmail for emails sent to the target address

## Token Storage

After successful authentication, the system will create a `token.json` file in the `credentials/` directory. This file contains the refresh token and should be kept secure.

## Setting Up Email Monitoring

To test the email monitoring:

1. Send an email to your Gmail account with `+RMA` in the address (e.g., if your email is `user@gmail.com`, send to `user+RMA@gmail.com`)
2. Attach a PDF or image file containing debt information
3. The system should automatically process the email within 5 minutes (configurable)

## Troubleshooting

### "Invalid redirect URI" Error
- Make sure the redirect URI in your OAuth client matches exactly: `http://localhost:5001/auth/gmail/callback`
- Check that you're accessing the application on the correct port

### "Access blocked" Error
- Make sure you've added your email as a test user in the OAuth consent screen (APIs & Services → OAuth consent screen → Test users)
- If using a Google Workspace account, contact your admin
- For development, ensure the app is in "Testing" mode and you're listed as a test user
- Alternatively, you can publish the app, but this may require Google verification for sensitive scopes

### "Insufficient permissions" Error
- Verify that the Gmail API is enabled in your project
- Check that the OAuth consent screen includes the Gmail readonly scope

### Token Refresh Issues
- Delete the `credentials/token.json` file and re-authenticate
- Check that your OAuth client is still active in the Google Cloud Console

## Security Notes

- Keep your `credentials.json` and `token.json` files secure
- Don't commit these files to version control
- Use environment variables for sensitive configuration
- Consider using a service account for production deployments

## Directory Structure

After setup, your credentials directory should look like:

```
OCRDemo/credentials/
├── credentials.json    # OAuth client configuration
└── token.json         # Access/refresh tokens (created after auth)
```

## Testing Email Processing

Create a test email with:
- **To:** your-email+RMA@gmail.com
- **Subject:** Test Debt Document
- **Attachment:** A PDF or image with debt information

The system will:
1. Detect the email
2. Extract the attachment
3. Perform OCR
4. Extract debt information
5. Look up the client in Catalyst CMA
6. Upload the document and create debt records

Monitor the dashboard for processing status and results.