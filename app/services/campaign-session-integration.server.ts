import { authenticate } from '../shopify.server';
import { campaignWebhookIntegration } from './campaign-webhook-integration.server';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

/**
 * Service to integrate campaign processing with Shopify admin sessions
 * Automatically registers admin clients for campaign webhook processing
 */
export class CampaignSessionIntegrationService {
  
  /**
   * Initialize campaign processing for a loader with admin authentication
   * Call this in loaders that need campaign processing enabled
   */
  static async initializeCampaignProcessingFromLoader(args: LoaderFunctionArgs) {
    try {
      const { admin, session } = await authenticate.admin(args.request);
      
      if (session?.shop) {
        // Register the admin client for campaign processing
        campaignWebhookIntegration.registerShop(session.shop, admin);
        console.log(`✅ Campaign processing enabled for shop: ${session.shop}`);
      }
      
      return { admin, session };
    } catch (error) {
      console.error('❌ Failed to initialize campaign processing:', error);
      throw error;
    }
  }

  /**
   * Initialize campaign processing for an action with admin authentication
   * Call this in actions that need campaign processing enabled
   */
  static async initializeCampaignProcessingFromAction(args: ActionFunctionArgs) {
    try {
      const { admin, session } = await authenticate.admin(args.request);
      
      if (session?.shop) {
        // Register the admin client for campaign processing
        campaignWebhookIntegration.registerShop(session.shop, admin);
        console.log(`✅ Campaign processing enabled for shop: ${session.shop}`);
      }
      
      return { admin, session };
    } catch (error) {
      console.error('❌ Failed to initialize campaign processing:', error);
      throw error;
    }
  }

  /**
   * Get campaign processing statistics
   */
  static getCampaignProcessingStats() {
    return campaignWebhookIntegration.getRegistrationStats();
  }

  /**
   * Check if a shop has campaign processing enabled
   */
  static isCampaignProcessingEnabled(shopDomain: string): boolean {
    return campaignWebhookIntegration.isShopReady(shopDomain);
  }

  /**
   * Manually register admin client (for special cases)
   */
  static registerAdminClient(shopDomain: string, adminClient: any): void {
    campaignWebhookIntegration.registerShop(shopDomain, adminClient);
  }

  /**
   * Unregister shop (useful for testing or cleanup)
   */
  static unregisterShop(shopDomain: string): void {
    campaignWebhookIntegration.unregisterShop(shopDomain);
  }
}

// Export convenience functions for easier usage
export const initializeCampaignProcessing = CampaignSessionIntegrationService;
export const campaignProcessingStats = () => CampaignSessionIntegrationService.getCampaignProcessingStats();
