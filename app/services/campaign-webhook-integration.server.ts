import { CampaignProcessingService } from './campaign-processing-service.server';
import type { ShopifyWebhookMessage, WebhookProcessingResult } from '../types/pubsub-webhook';

/**
 * Integration service that provides admin client context to campaign processing
 * This service bridges the gap between webhook processing and campaign execution
 */
export class CampaignWebhookIntegrationService {
  private campaignProcessors: Map<string, CampaignProcessingService> = new Map();

  /**
   * Register a shop's admin client for campaign processing
   */
  registerShop(shopDomain: string, adminClient: any): void {
    console.log(`🔗 Registering shop for campaign processing: ${shopDomain}`);
    
    const campaignProcessor = new CampaignProcessingService(shopDomain, adminClient);
    this.campaignProcessors.set(shopDomain, campaignProcessor);
  }

  /**
   * Unregister a shop (e.g., when app is uninstalled)
   */
  unregisterShop(shopDomain: string): void {
    console.log(`🗑️  Unregistering shop: ${shopDomain}`);
    this.campaignProcessors.delete(shopDomain);
  }

  /**
   * Process webhook for campaign triggers
   */
  async processWebhookForCampaigns(webhookMessage: ShopifyWebhookMessage): Promise<{
    campaignsTriggered: number;
    variantsUpdated: number;
    errors: string[];
    processingTimeMs: number;
  }> {
    const startTime = Date.now();
    
    const processor = this.campaignProcessors.get(webhookMessage.shopDomain);
    if (!processor) {
      console.log(`⚠️  No campaign processor registered for shop: ${webhookMessage.shopDomain}`);
      return {
        campaignsTriggered: 0,
        variantsUpdated: 0,
        errors: [`No admin client registered for shop: ${webhookMessage.shopDomain}`],
        processingTimeMs: Date.now() - startTime
      };
    }

    try {
      // Only process inventory-related webhooks for campaigns
      if (this.isInventoryWebhook(webhookMessage.topic)) {
        const results = await processor.processInventoryWebhook(webhookMessage);
        
        const campaignsTriggered = results.length;
        const variantsUpdated = results.reduce((sum, r) => sum + r.variantsUpdated, 0);
        const errors = results.flatMap(r => r.errors);

        console.log(`🎯 Campaign processing complete: ${campaignsTriggered} campaigns, ${variantsUpdated} variants updated`);

        return {
          campaignsTriggered,
          variantsUpdated,
          errors,
          processingTimeMs: Date.now() - startTime
        };
      } else {
        console.log(`⏭️  Webhook ${webhookMessage.topic} not applicable for campaign processing`);
        return {
          campaignsTriggered: 0,
          variantsUpdated: 0,
          errors: [],
          processingTimeMs: Date.now() - startTime
        };
      }

    } catch (error) {
      console.error(`❌ Error in campaign webhook integration:`, error);
      return {
        campaignsTriggered: 0,
        variantsUpdated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        processingTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Check if webhook topic is relevant for campaign processing
   */
  private isInventoryWebhook(topic: string): boolean {
    const inventoryTopics = [
      'inventory_levels/update',
      'inventory_items/update',
      'products/update', // Product updates may include inventory changes
      'products/create'  // New products may trigger campaigns
    ];
    
    return inventoryTopics.includes(topic);
  }

  /**
   * Get statistics about registered shops
   */
  getRegistrationStats(): {
    registeredShops: number;
    shopDomains: string[];
  } {
    return {
      registeredShops: this.campaignProcessors.size,
      shopDomains: Array.from(this.campaignProcessors.keys())
    };
  }

  /**
   * Health check for campaign processing readiness
   */
  isShopReady(shopDomain: string): boolean {
    return this.campaignProcessors.has(shopDomain);
  }
}

// Global instance for sharing across the application
export const campaignWebhookIntegration = new CampaignWebhookIntegrationService();
