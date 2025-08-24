import { PubSub, Message } from '@google-cloud/pubsub';

// Google Cloud Pub/Sub client for Shopify webhook processing
export class GooglePubSubClient {
  private pubsub: PubSub;
  private subscriptionName: string;
  private projectId: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!;
    this.subscriptionName = process.env.PUBSUB_SUBSCRIPTION_NAME || 'shopify-webhooks-subscription';
    
    if (!this.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID environment variable is required');
    }

    // Initialize Pub/Sub client with Application Default Credentials (Workload Identity)
    this.pubsub = new PubSub({
      projectId: this.projectId,
      // Uses Application Default Credentials - no keyFilename needed!
      // Automatically detects: gcloud ADC, service account, or Workload Identity
    });
  }

  /**
   * Start listening for Shopify webhook messages
   * @param messageHandler Function to handle incoming webhook messages
   */
  async startListening(messageHandler: (message: ShopifyWebhookMessage) => Promise<void>) {
    console.log(`🎧 Starting Pub/Sub listener for subscription: ${this.subscriptionName}`);
    
    const subscription = this.pubsub.subscription(this.subscriptionName);

    // Message event handler
    subscription.on('message', async (message: Message) => {
      try {
        console.log(`📨 Received Pub/Sub message: ${message.id}`);
        
        // Parse message data
        const webhookData = this.parseShopifyWebhookMessage(message);
        
        // Process the webhook
        await messageHandler(webhookData);
        
        // Acknowledge successful processing
        message.ack();
        console.log(`✅ Successfully processed message: ${message.id}`);
        
      } catch (error) {
        console.error(`❌ Error processing message ${message.id}:`, error);
        
        // Nack the message to trigger retry or dead letter queue
        message.nack();
      }
    });

    // Error handling
    subscription.on('error', (error) => {
      console.error('🚨 Pub/Sub subscription error:', error);
    });

    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('🛑 Shutting down Pub/Sub listener...');
      subscription.close();
    });

    return subscription;
  }

  /**
   * Parse Shopify webhook message from Pub/Sub format
   */
  private parseShopifyWebhookMessage(message: Message): ShopifyWebhookMessage {
    const data = JSON.parse(message.data.toString());
    const attributes = message.attributes;

    return {
      messageId: message.id,
      publishTime: message.publishTime,
      topic: attributes['X-Shopify-Topic'] || '',
      shopDomain: attributes['X-Shopify-Shop-Domain'] || '',
      apiVersion: attributes['X-Shopify-API-Version'] || '',
      webhookId: attributes['X-Shopify-Webhook-Id'] || '',
      eventId: attributes['X-Shopify-Event-Id'] || '',
      triggeredAt: attributes['X-Shopify-Triggered-At'] || '',
      payload: data,
      attributes,
    };
  }

  /**
   * Health check for Pub/Sub connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      console.log('🔍 Checking Google Cloud credentials...');
      
      // Try to access the subscription directly to test credentials
      const subscription = this.pubsub.subscription(this.subscriptionName);
      const [exists] = await subscription.exists();
      
      if (!exists) {
        console.warn(`⚠️  Subscription ${this.subscriptionName} does not exist`);
        console.log('📋 You may need to create the subscription in Google Cloud Console');
        return false;
      }

      console.log(`✅ Pub/Sub health check passed for subscription: ${this.subscriptionName}`);
      return true;
      
    } catch (error: any) {
      console.error('❌ Pub/Sub health check failed:', error.message);
      
      if (error.message.includes('Could not load the default credentials')) {
        console.log('💡 Quick fix for local development:');
        console.log('   1. Install Google Cloud CLI: https://cloud.google.com/sdk/docs/install');
        console.log('   2. Run: gcloud auth application-default login');
        console.log('   3. Or download service account key and set GOOGLE_APPLICATION_CREDENTIALS');
        console.log('🔄 App will continue running without Pub/Sub integration');
      } else if (error.message.includes('permission')) {
        console.log('💡 Permission issue detected:');
        console.log('   1. Make sure you have Pub/Sub Subscriber permissions');
        console.log('   2. Check if the subscription exists and is accessible');
      } else {
        console.log('💡 Unknown Pub/Sub error - continuing without webhook integration');
      }
      
      return false;
    }
  }

  /**
   * Get subscription metrics for monitoring
   */
  async getSubscriptionMetrics() {
    try {
      const subscription = this.pubsub.subscription(this.subscriptionName);
      const [metadata] = await subscription.getMetadata();
      
      return {
        name: metadata.name,
        topic: metadata.topic,
        ackDeadlineSeconds: metadata.ackDeadlineSeconds,
        messageRetentionDuration: metadata.messageRetentionDuration,
        deliveryAttempts: metadata.deadLetterPolicy?.maxDeliveryAttempts || 0,
      };
    } catch (error) {
      console.error('❌ Failed to get subscription metrics:', error);
      return null;
    }
  }
}

// TypeScript interfaces for Shopify webhook messages via Pub/Sub
export interface ShopifyWebhookMessage {
  messageId: string;
  publishTime: any;
  topic: string;
  shopDomain: string;
  apiVersion: string;
  webhookId: string;
  eventId: string;
  triggeredAt: string;
  payload: any;
  attributes: { [key: string]: string };
}

// Create singleton instance
export const googlePubSubClient = new GooglePubSubClient();
