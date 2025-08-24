import { googlePubSubClient, type ShopifyWebhookMessage } from '../lib/google-pubsub-client.server';
import { campaignWebhookIntegration } from './campaign-webhook-integration.server';
import type { WebhookProcessingResult } from '../types/pubsub-webhook';

export class PubSubWebhookService {
  constructor() {
    // Initialize services when they are available
  }

  /**
   * Initialize Pub/Sub webhook listener
   */
  async initialize() {
    console.log('🚀 Initializing Pub/Sub webhook service...');
    
    // Health check first
    const isHealthy = await googlePubSubClient.healthCheck();
    if (!isHealthy) {
      throw new Error('Pub/Sub health check failed - cannot initialize webhook service');
    }

    // Start listening for webhook messages
    await googlePubSubClient.startListening(async (message: ShopifyWebhookMessage) => {
      await this.processWebhookMessage(message);
    });
    
    console.log('✅ Pub/Sub webhook service initialized successfully');
  }

  /**
   * Process incoming Shopify webhook message from Pub/Sub
   */
  private async processWebhookMessage(message: ShopifyWebhookMessage): Promise<WebhookProcessingResult> {
    const startTime = Date.now();
    
    console.log(`🔄 Processing webhook: ${message.topic} for shop: ${message.shopDomain}`);

    try {
      // Idempotent processing check using message ID
      const alreadyProcessed = await this.isMessageAlreadyProcessed(message.messageId);
      if (alreadyProcessed) {
        console.log(`⏭️  Message ${message.messageId} already processed, skipping`);
        return {
          success: true,
          messageId: message.messageId,
          processingTimeMs: Date.now() - startTime,
        };
      }

      // Log webhook receipt
      await this.logWebhookReceipt(message);

      // Route to appropriate handler based on topic
      let result: WebhookProcessingResult;
      
      switch (message.topic) {
        case 'inventory_levels/update':
        case 'inventory_items/update':
          result = await this.handleInventoryWebhook(message, startTime);
          break;
          
        case 'products/update':
        case 'products/create':
          result = await this.handleProductWebhook(message, startTime);
          break;

        case 'app/uninstalled':
          result = await this.handleAppUninstalledWebhook(message, startTime);
          break;

        case 'app/scopes_update':
          result = await this.handleAppScopesUpdateWebhook(message, startTime);
          break;
          
        default:
          console.log(`ℹ️  Ignoring unsupported webhook topic: ${message.topic}`);
          result = {
            success: true,
            messageId: message.messageId,
            processingTimeMs: Date.now() - startTime,
          };
      }

      // Mark message as processed
      await this.markMessageAsProcessed(message.messageId);

      return result;

    } catch (error) {
      console.error(`❌ Error processing webhook message ${message.messageId}:`, error);
      
      // Log the error for monitoring
      await this.logWebhookError(message, error);

      return {
        success: false,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle inventory-related webhooks
   */
  private async handleInventoryWebhook(
    message: ShopifyWebhookMessage, 
    startTime: number
  ): Promise<WebhookProcessingResult> {
    console.log(`📦 Processing inventory webhook for ${message.shopDomain}`);

    try {
      // Create campaign processing service for this shop
      // We'll need the admin client - this will need to be passed in from a session context
      // For now, we'll create a placeholder implementation
      
      console.log('📊 Inventory data received:', JSON.stringify(message.payload, null, 2));
      
      let campaignsTriggered = 0;
      let variantsUpdated = 0;

      // Process campaigns using the integration service
      const campaignResult = await campaignWebhookIntegration.processWebhookForCampaigns(message);
      campaignsTriggered = campaignResult.campaignsTriggered;
      variantsUpdated = campaignResult.variantsUpdated;
      
      if (campaignResult.errors.length > 0) {
        console.warn('⚠️  Campaign processing warnings:', campaignResult.errors);
      }
      
      console.log(`✅ Inventory webhook processed - Shop: ${message.shopDomain}, Campaigns: ${campaignsTriggered}, Variants: ${variantsUpdated}`);

      return {
        success: true,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        campaignsTriggered,
        variantsUpdated,
      };
      
    } catch (error) {
      console.error(`❌ Error processing inventory webhook:`, error);
      return {
        success: false,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle product-related webhooks
   */
  private async handleProductWebhook(
    message: ShopifyWebhookMessage, 
    startTime: number
  ): Promise<WebhookProcessingResult> {
    console.log(`🛍️  Processing product webhook for ${message.shopDomain}`);

    try {
      console.log('🛍️  Product data received:', JSON.stringify(message.payload, null, 2));
      
      let campaignsTriggered = 0;
      let variantsUpdated = 0;

      // Process campaigns using the integration service
      const campaignResult = await campaignWebhookIntegration.processWebhookForCampaigns(message);
      campaignsTriggered = campaignResult.campaignsTriggered;
      variantsUpdated = campaignResult.variantsUpdated;
      
      if (campaignResult.errors.length > 0) {
        console.warn('⚠️  Campaign processing warnings:', campaignResult.errors);
      }
      
      console.log(`✅ Product webhook processed - Shop: ${message.shopDomain}, Campaigns: ${campaignsTriggered}, Variants: ${variantsUpdated}`);
      
      return {
        success: true,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        campaignsTriggered,
        variantsUpdated,
      };
      
    } catch (error) {
      console.error(`❌ Error processing product webhook:`, error);
      return {
        success: false,
        messageId: message.messageId,
        processingTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle app/uninstalled webhooks
   */
  private async handleAppUninstalledWebhook(
    message: ShopifyWebhookMessage, 
    startTime: number
  ): Promise<WebhookProcessingResult> {
    console.log(`🗑️  Processing app uninstall webhook for ${message.shopDomain}`);

    // Clean up shop data when app is uninstalled
    const shopDomain = message.shopDomain;
    
    try {
      // TODO: Implement cleanup logic
      // - Remove shop from database
      // - Cancel active campaigns  
      // - Clear cached data
      console.log(`🧹 Cleaning up data for uninstalled shop: ${shopDomain}`);
      
    } catch (error) {
      console.error(`❌ Error cleaning up shop ${shopDomain}:`, error);
    }

    return {
      success: true,
      messageId: message.messageId,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Handle app/scopes_update webhooks
   */
  private async handleAppScopesUpdateWebhook(
    message: ShopifyWebhookMessage, 
    startTime: number
  ): Promise<WebhookProcessingResult> {
    console.log(`🔑 Processing scopes update webhook for ${message.shopDomain}`);

    // Handle permission changes
    const scopesData = message.payload;
    
    try {
      // TODO: Implement scope validation logic
      // - Check if required scopes are still granted
      // - Pause campaigns if critical scopes removed
      console.log(`🔍 Checking scopes for ${message.shopDomain}:`, scopesData);
      
    } catch (error) {
      console.error(`❌ Error processing scopes update for ${message.shopDomain}:`, error);
    }

    return {
      success: true,
      messageId: message.messageId,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Check if message has already been processed (idempotency)
   */
  private async isMessageAlreadyProcessed(messageId: string): Promise<boolean> {
    // Implementation would check database for processed message IDs
    // For now, return false to process all messages
    return false;
  }

  /**
   * Mark message as processed to prevent reprocessing
   */
  private async markMessageAsProcessed(messageId: string): Promise<void> {
    // Implementation would store message ID in database with timestamp
    console.log(`✅ Marked message ${messageId} as processed`);
  }

  /**
   * Log webhook receipt for monitoring
   */
  private async logWebhookReceipt(message: ShopifyWebhookMessage): Promise<void> {
    console.log(`📝 Logging webhook receipt: ${message.messageId}`);
    // Implementation would log to database webhook_logs table
  }

  /**
   * Log webhook processing errors
   */
  private async logWebhookError(message: ShopifyWebhookMessage, error: any): Promise<void> {
    console.error(`📝 Logging webhook error for message ${message.messageId}:`, error);
    // Implementation would log error to database for monitoring
  }

  /**
   * Evaluate if campaign rules should trigger based on inventory data
   */
  private async evaluateCampaignRules(campaign: any, inventoryData: any): Promise<boolean> {
    // Implementation would evaluate campaign pricing rules against inventory changes
    // For now, return true to trigger all campaigns for testing
    console.log(`🧮 Evaluating campaign rules for ${campaign.id}`);
    return true;
  }

  /**
   * Get webhook processing health status
   */
  async getHealthStatus() {
    const pubsubHealth = await googlePubSubClient.healthCheck();
    const metrics = await googlePubSubClient.getSubscriptionMetrics();
    
    return {
      pubsubHealthy: pubsubHealth,
      subscriptionMetrics: metrics,
      lastCheckedAt: new Date(),
    };
  }
}

// Create singleton instance
export const pubSubWebhookService = new PubSubWebhookService();
