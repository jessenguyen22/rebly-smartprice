# Setup Instructions for Google Cloud Pub/Sub

## Prerequisites
✅ Google Cloud account (you have this)
✅ Google Cloud Pub/Sub library installed (you completed this)

## Step 1: Find or Create Google Cloud Project

### Option A: Use Existing Project
1. Go to: https://console.cloud.google.com/
2. Click project dropdown (top-left corner)
3. Copy your Project ID (format: project-name-123456)

### Option B: Create New Project
1. Go to: https://console.cloud.google.com/projectcreate
2. Enter project name: "rebly-smartprice" (or similar)
3. Note down the generated Project ID
4. Click "Create"

## Step 2: Enable Pub/Sub API (Manual Console Method)
1. Go to: https://console.cloud.google.com/apis/library/pubsub.googleapis.com
2. Make sure your project is selected
3. Click "Enable"

## Step 3: Create Pub/Sub Topic (CRITICAL STEP)
1. Go to: https://console.cloud.google.com/cloudpubsub/topic/list
2. Make sure your project is selected
3. Click "Create a topic" button
4. Enter topic name: `shopify-webhooks`
5. Keep remaining defaults and click "Create"

## Step 4: 🚨 GRANT SHOPIFY ACCESS (REQUIRED!)
**This is the most important step - Shopify cannot send webhooks without this:**

1. In the Pub/Sub Topics list, find your `shopify-webhooks` topic
2. Click the **⋮** (three dots) next to your topic → **View permissions**
3. Click **ADD PRINCIPAL**
4. In "New principals" text box, paste exactly:
   ```
   delivery@shopify-pubsub-webhooks.iam.gserviceaccount.com
   ```
5. In "Role" dropdown:
   - Select **Pub/Sub** as the type
   - Choose **Pub/Sub Publisher** role
6. Click **Save**

**Without this step, Shopify webhooks will fail!**

## Step 5: Create Service Account for Your App
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Click "Create Service Account"
3. Service account name: `shopify-webhook-processor`
4. Click "Create and Continue"
5. Grant these roles:
   - **Pub/Sub Subscriber**
   - **Pub/Sub Viewer**
6. Click "Continue" → "Done"

## Step 6: Setup Workload Identity (Recommended - No JSON Keys!)
**Google now recommends Workload Identity Federation instead of downloading JSON keys.**

### Option A: For Local Development (ADC)
```bash
# Authenticate your local environment
gcloud auth application-default login

# Grant your user account the same permissions for testing
gcloud projects add-iam-policy-binding rebly-smart-pricing \
    --member="user:YOUR_EMAIL@rebly.io" \
    --role="roles/pubsub.subscriber"

gcloud projects add-iam-policy-binding rebly-smart-pricing \
    --member="user:YOUR_EMAIL@rebly.io" \
    --role="roles/pubsub.viewer"
```

### Option B: Grant Service Account Permissions (For Production)
```bash
# Grant service account permissions to read from Pub/Sub
gcloud projects add-iam-policy-binding rebly-smart-pricing \
    --member="serviceAccount:shopify-webhook-processor@rebly-smart-pricing.iam.gserviceaccount.com" \
    --role="roles/pubsub.subscriber"

gcloud projects add-iam-policy-binding rebly-smart-pricing \
    --member="serviceAccount:shopify-webhook-processor@rebly-smart-pricing.iam.gserviceaccount.com" \
    --role="roles/pubsub.viewer"
```

**Benefits of Workload Identity:**
- ✅ No JSON key files to manage
- ✅ More secure (no credentials in code/files)
- ✅ Automatic credential rotation
- ✅ Supported by Shopify CLI and Remix

## Step 7: Create Subscription (after creating topic)
1. Go to: https://console.cloud.google.com/cloudpubsub/subscription/list
2. Click "Create Subscription"
3. Subscription ID: `shopify-webhooks-subscription`
4. Select topic: `shopify-webhooks`
5. Leave other settings as default
6. Click "Create"

## Step 8: Update Environment Variables
Create `.env.local` file (NO JSON key needed with Workload Identity):
```
GOOGLE_CLOUD_PROJECT_ID=rebly-smart-pricing
PUBSUB_TOPIC_NAME=shopify-webhooks
PUBSUB_SUBSCRIPTION_NAME=shopify-webhooks-subscription
# No GOOGLE_APPLICATION_CREDENTIALS needed! Uses Application Default Credentials
```

## Step 9: Update shopify.app.toml
Replace "YOUR_GCP_PROJECT_ID" with your actual Project ID in shopify.app.toml

## Step 10: Test Webhook Delivery
After setup, test with:
```bash
shopify app webhook trigger --address=pubsub://rebly-smart-pricing:shopify-webhooks --topic=INVENTORY_LEVELS_UPDATE
```

## Summary of Steps ✅
1. ✅ Enable Pub/Sub API  
2. ✅ Create topic: `shopify-webhooks`
3. 🚨 **GRANT SHOPIFY ACCESS**: Add `delivery@shopify-pubsub-webhooks.iam.gserviceaccount.com` as Pub/Sub Publisher
4. ✅ Create service account for your app
5. ✅ Download service account JSON key
6. ✅ Create subscription: `shopify-webhooks-subscription` 
7. ✅ Update environment variables
8. ✅ Update shopify.app.toml with Project ID
9. ✅ Test webhook delivery
