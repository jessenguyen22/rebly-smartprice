# Fix Domain Restriction via Google Cloud Console UI

## Method 1: Organization Policies Console

### Step 1: Access Organization Policies
1. Go to: https://console.cloud.google.com/iam-admin/orgpolicies
2. Make sure you're in **Rebly.io** organization context
3. Find policy: **Domain restricted sharing (iam.allowedPolicyMemberDomains)**

### Step 2: Edit Policy
1. Click on the policy name
2. Click **Edit Policy**
3. Choose **Replace** (not inherit from parent)
4. Add these allowed values:
   - `rebly.io` (your existing domain)
   - `shopify-pubsub-webhooks.iam.gserviceaccount.com` (Shopify domain)
5. Click **Save**

### Step 3: Wait & Test
1. Wait 1-2 minutes for propagation
2. Go back to Pub/Sub topic permissions
3. Try adding `delivery@shopify-pubsub-webhooks.iam.gserviceaccount.com` again

## Method 2: Project-Level Override (Recommended)
1. Go to: https://console.cloud.google.com/iam-admin/orgpolicies?project=rebly-smart-pricing
2. Find **Domain restricted sharing** policy
3. Click **Manage Policy**
4. Choose **Replace** policy for this project
5. Add both domains as above
6. Save

## Verification
After policy update, you should be able to:
- Add Shopify service account to Pub/Sub topic permissions
- No more "Domain Restricted Sharing" error
- Webhooks will flow from Shopify → Pub/Sub → Your app
