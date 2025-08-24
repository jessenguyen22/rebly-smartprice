# Fix Domain Restricted Sharing for Rebly.io Organization

Since you're admin of Rebly.io organization, you can fix this policy issue.

## Quick Fix Commands

### Step 1: Get Your Organization ID
```bash
# Find your organization ID
gcloud organizations list
```
Look for Rebly.io in the output and note the `ORGANIZATION_ID`.

### Step 2: Add Shopify Service Account to Allowed Domains
Create policy file to allow Shopify's service account:

```bash
# Create policy.yaml file
cat > policy.yaml << EOF
constraint: constraints/iam.allowedPolicyMemberDomains
listPolicy:
  allowedValues:
    - "rebly.io"  # Your existing domain
    - "shopify-pubsub-webhooks.iam.gserviceaccount.com"  # Add Shopify domain
EOF
```

### Step 3: Apply the Policy
```bash
# Apply policy to your organization (replace YOUR_ORG_ID with actual ID)
gcloud resource-manager org-policies set-policy policy.yaml --organization=YOUR_ORG_ID
```

### Step 4: Verify Policy Update
```bash
# Check if policy is updated
gcloud resource-manager org-policies describe constraints/iam.allowedPolicyMemberDomains --organization=YOUR_ORG_ID
```

## Alternative: Project-Level Override (Faster)
If you prefer project-level fix instead of org-level:

```bash
# Create project-level policy override with correct format
cat > project-policy.yaml << EOF
constraint: constraints/iam.allowedPolicyMemberDomains
listPolicy:
  inheritFromParent: false
  allowedValues:
    - "C01wb5hsu"  # Your Rebly.io Customer ID from gcloud organizations list
    - "is:shopify-pubsub-webhooks.iam.gserviceaccount.com"  # Shopify service account
EOF

# Apply to your project only
gcloud resource-manager org-policies set-policy project-policy.yaml --project=rebly-smart-pricing
```

**FIXED VERSION:** Use Customer ID `C01wb5hsu` and prefix `is:` for service accounts!

## After Policy Fix
1. Wait 1-2 minutes for policy propagation
2. Go back to Pub/Sub topic permissions
3. Add `delivery@shopify-pubsub-webhooks.iam.gserviceaccount.com` as **Pub/Sub Publisher**
4. Should work without Domain Restricted error!
