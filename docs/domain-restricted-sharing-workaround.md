# Workaround for Domain Restricted Sharing

## Problem
Organization policy `constraints/iam.allowedPolicyMemberDomains` prevents adding Shopify's service account `delivery@shopify-pubsub-webhooks.iam.gserviceaccount.com` as Pub/Sub Publisher.

## Solution: Use Cloud Functions as Webhook Proxy

### Step 1: Create Cloud Function to receive HTTP webhooks
```javascript
// index.js for Cloud Function
const {PubSub} = require('@google-cloud/pubsub');

const pubsub = new PubSub();
const topicName = 'shopify-webhooks';

exports.shopifyWebhookProxy = async (req, res) => {
  try {
    // Verify Shopify HMAC (optional but recommended)
    const hmac = req.get('X-Shopify-Hmac-Sha256');
    
    // Forward webhook to Pub/Sub
    const dataBuffer = Buffer.from(JSON.stringify({
      headers: req.headers,
      body: req.body,
      timestamp: new Date().toISOString()
    }));
    
    await pubsub.topic(topicName).publish(dataBuffer);
    
    res.status(200).send('Webhook forwarded to Pub/Sub');
  } catch (error) {
    console.error('Error forwarding webhook:', error);
    res.status(500).send('Error processing webhook');
  }
};
```

### Step 2: Deploy Cloud Function
```bash
gcloud functions deploy shopify-webhook-proxy \
  --runtime nodejs18 \
  --trigger-http \
  --allow-unauthenticated \
  --entry-point shopifyWebhookProxy
```

### Step 3: Update shopify.app.toml to use Cloud Function URL
```toml
# Replace Pub/Sub with HTTP webhook to Cloud Function
[[webhooks.subscriptions]]
topics = [ "inventory_levels/update", "inventory_items/update" ]
uri = "https://YOUR_REGION-YOUR_PROJECT.cloudfunctions.net/shopify-webhook-proxy"
```

## Alternative: Switch to HTTP Webhooks Temporarily
Use direct HTTP webhooks to your app during development:

```toml
[[webhooks.subscriptions]]
topics = [ "inventory_levels/update", "inventory_items/update" ]
uri = "/webhooks/inventory"
```
