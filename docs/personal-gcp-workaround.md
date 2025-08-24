# Personal GCP Account Workaround for Domain Restriction

## Problem
Corporate/Enterprise Google Cloud has Domain Restricted Sharing policy preventing adding Shopify service account.

## Solution: Use Personal Google Account

### Step 1: Create New Personal GCP Project
1. Sign out of corporate Google account
2. Sign in with **personal Gmail account**
3. Go to: https://console.cloud.google.com/projectcreate
4. Create project: `rebly-smartprice-personal`
5. Note the new Project ID

### Step 2: Setup Pub/Sub in Personal Account
1. Enable Pub/Sub API
2. Create topic: `shopify-webhooks`
3. **Grant Shopify Access** (this will work in personal account):
   - Add principal: `delivery@shopify-pubsub-webhooks.iam.gserviceaccount.com`
   - Role: **Pub/Sub Publisher**

### Step 3: Create Service Account in Personal Project
1. Create service account: `shopify-webhook-processor`
2. Grant roles: **Pub/Sub Subscriber**, **Pub/Sub Viewer**
3. Download JSON key

### Step 4: Update Config
```env
GOOGLE_CLOUD_PROJECT_ID=rebly-smartprice-personal
```

```toml
pub_sub_project = "rebly-smartprice-personal"
```

## Benefits:
- ✅ No domain restrictions
- ✅ Full control over permissions
- ✅ Works immediately
- ✅ Can still use corporate account for other resources
