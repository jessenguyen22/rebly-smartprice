# Google Cloud Pub/Sub Setup Script for Shopify Webhooks
# Run this script after installing Google Cloud SDK

param(
    [Parameter(Mandatory=$true)]
    [string]$ProjectId,
    
    [Parameter(Mandatory=$false)]
    [string]$TopicName = "shopify-webhooks",
    
    [Parameter(Mandatory=$false)]
    [string]$SubscriptionName = "shopify-webhooks-subscription",
    
    [Parameter(Mandatory=$false)]
    [string]$DeadLetterTopicName = "shopify-webhooks-dead-letter"
)

Write-Host "🚀 Setting up Google Pub/Sub for Shopify Webhooks..." -ForegroundColor Green

# Set the project
Write-Host "📋 Setting project: $ProjectId" -ForegroundColor Yellow
gcloud config set project $ProjectId

# Enable Pub/Sub API
Write-Host "🔧 Enabling Pub/Sub API..." -ForegroundColor Yellow
gcloud services enable pubsub.googleapis.com

# Create main topic for webhooks
Write-Host "📨 Creating topic: $TopicName" -ForegroundColor Yellow
gcloud pubsub topics create $TopicName

# Create dead letter topic
Write-Host "💀 Creating dead letter topic: $DeadLetterTopicName" -ForegroundColor Yellow
gcloud pubsub topics create $DeadLetterTopicName

# Create dead letter subscription
Write-Host "📮 Creating dead letter subscription..." -ForegroundColor Yellow
gcloud pubsub subscriptions create "$DeadLetterTopicName-subscription" --topic=$DeadLetterTopicName

# Create main subscription with dead letter queue
Write-Host "📬 Creating subscription: $SubscriptionName" -ForegroundColor Yellow
gcloud pubsub subscriptions create $SubscriptionName `
    --topic=$TopicName `
    --dead-letter-topic=$DeadLetterTopicName `
    --max-delivery-attempts=5 `
    --ack-deadline=60 `
    --message-retention-duration=7d

# Create service account for the application
$ServiceAccountName = "shopify-webhook-processor"
$ServiceAccountEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"

Write-Host "🔐 Creating service account: $ServiceAccountEmail" -ForegroundColor Yellow
gcloud iam service-accounts create $ServiceAccountName `
    --display-name="Shopify Webhook Processor" `
    --description="Service account for processing Shopify webhooks via Pub/Sub"

# Grant necessary permissions
Write-Host "🎯 Granting Pub/Sub permissions..." -ForegroundColor Yellow
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/pubsub.subscriber"

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/pubsub.viewer"

gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/monitoring.metricWriter"

# Create and download service account key
$KeyFileName = "service-account-key.json"
Write-Host "🔑 Creating service account key: $KeyFileName" -ForegroundColor Yellow
gcloud iam service-accounts keys create $KeyFileName `
    --iam-account=$ServiceAccountEmail

Write-Host "✅ Google Pub/Sub setup completed!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:" -ForegroundColor Cyan
Write-Host "1. Move $KeyFileName to your project root (and add to .gitignore)" -ForegroundColor White
Write-Host "2. Set GOOGLE_APPLICATION_CREDENTIALS environment variable" -ForegroundColor White
Write-Host "3. Update your .env file with the following:" -ForegroundColor White
Write-Host ""
Write-Host "GOOGLE_CLOUD_PROJECT_ID=$ProjectId" -ForegroundColor Gray
Write-Host "PUBSUB_TOPIC_NAME=$TopicName" -ForegroundColor Gray
Write-Host "PUBSUB_SUBSCRIPTION_NAME=$SubscriptionName" -ForegroundColor Gray
Write-Host "PUBSUB_DEAD_LETTER_TOPIC=$DeadLetterTopicName" -ForegroundColor Gray
Write-Host "GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json" -ForegroundColor Gray
Write-Host ""
Write-Host "🏷️  Pub/Sub URI for Shopify webhook: pubsub://$ProjectId`:$TopicName" -ForegroundColor Green
