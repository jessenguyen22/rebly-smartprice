// Background service to start Google Pub/Sub webhook listener
import { googlePubSubClient } from './lib/google-pubsub-client.server';
import { PubSubWebhookService } from './services/pubsub-webhook-service.server';

// Global flag to ensure listener starts only once
let pubsubListenerStarted = false;

export async function startPubSubWebhookListener() {
  if (pubsubListenerStarted) {
    console.log('🔄 Pub/Sub listener already started, skipping...');
    return;
  }

  try {
    console.log('🚀 Starting Google Pub/Sub webhook listener...');
    
    // Health check first
    const isHealthy = await googlePubSubClient.healthCheck();
    if (!isHealthy) {
      console.log('❌ Pub/Sub health check failed - skipping listener start');
      console.log('📋 App will continue running normally with manual webhook testing available');
      return;
    }

    // Initialize webhook service and start listening
    const webhookService = new PubSubWebhookService();
    await webhookService.initialize();

    pubsubListenerStarted = true;
    console.log('✅ Google Pub/Sub webhook listener started successfully');

  } catch (error) {
    console.error('❌ Failed to start Pub/Sub listener:', error);
    
    // Don't throw error to prevent app startup failure
    // Just log and continue - webhooks will be missed but app will work
  }
}

// Auto-start listener in development (only if credentials available)
if (process.env.NODE_ENV !== 'production' && process.env.GOOGLE_CLOUD_PROJECT_ID) {
  // Use setImmediate to avoid blocking app startup
  setImmediate(() => {
    startPubSubWebhookListener().catch(error => {
      console.log('ℹ️  Pub/Sub listener not started:', error.message);
      console.log('💡 This is expected in development without Google Cloud credentials');
      console.log('🔄 Campaign processing will work once credentials are configured');
    });
  });
}
