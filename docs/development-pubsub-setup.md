# Google Cloud Setup for Development

## Quick Setup for Local Development

To enable Google Pub/Sub webhooks in your local development environment:

### Option 1: Install Google Cloud CLI (Recommended)

1. **Install Google Cloud CLI:**
   - Windows: Download from https://cloud.google.com/sdk/docs/install-windows
   - Or use PowerShell: `(New-Object Net.WebClient).DownloadFile("https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe", "$env:Temp\GoogleCloudSDKInstaller.exe"); & $env:Temp\GoogleCloudSDKInstaller.exe`

2. **Authenticate with your Google account:**
   ```bash
   gcloud auth application-default login
   ```

3. **Set the project:**
   ```bash
   gcloud config set project rebly-smart-pricing
   ```

4. **Restart the app** - Pub/Sub should now work!

### Option 2: Service Account Key (Alternative)

1. **Download service account key:**
   - Go to Google Cloud Console > IAM & Admin > Service Accounts
   - Find the Shopify service account
   - Create and download JSON key

2. **Set environment variable:**
   ```bash
   # Add to .env.local
   GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json
   ```

3. **Restart the app**

## Verification

When properly configured, you should see:
```
✅ Pub/Sub health check passed for subscription: shopify-webhooks-subscription
✅ Google Pub/Sub webhook listener started successfully
```

Instead of:
```
❌ Pub/Sub health check failed: Error: Could not load the default credentials
```

## Development Without Google Cloud

The app will work fine without Google Cloud credentials! You'll just see:
```
ℹ️  This is expected in development without Google Cloud credentials
🔄 Campaign processing will work once credentials are configured
```

**Webhooks can still be tested using:**
- Manual webhook triggers via Shopify Partner Dashboard
- Local webhook testing with ngrok (for HTTP webhooks)
- Campaign processing can be tested independently

## Production Deployment

For production, use Workload Identity Federation (already configured):
- No JSON key files needed
- Automatic credential detection
- Secure and scalable authentication
