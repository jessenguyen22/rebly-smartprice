import { authenticate } from '../shopify.server';
import { campaignWebhookIntegration } from './campaign-webhook-integration.server';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';

/**
 * Enhanced Campaign Session Integration with better session management
 * Separates user session from webhook processing session
 */
export class EnhancedCampaignSessionIntegration {
  
  /**
   * Initialize campaign processing for a loader with enhanced authentication
   */
  static async initializeCampaignProcessingFromLoader(args: LoaderFunctionArgs) {
    try {
      console.log('🔐 Initializing campaign processing from loader');
      
      // Use standard authenticate for session management
      const { admin, session } = await authenticate.admin(args.request);
      
      if (session?.shop) {
        console.log(`🔗 Registering shop for campaign processing: ${session.shop}`);
        
        // Create a separate admin client for webhook processing
        // This prevents session conflicts between user actions and webhook processing
        const webhookAdmin = await this.createWebhookAdminClient(session.shop, session.accessToken);
        
        if (webhookAdmin) {
          campaignWebhookIntegration.registerShop(session.shop, webhookAdmin);
          console.log(`✅ Campaign processing enabled for shop: ${session.shop}`);
        } else {
          console.warn(`⚠️ Failed to create webhook admin client for: ${session.shop}`);
        }
      }
      
      return { admin, session };
    } catch (error) {
      console.error('❌ Failed to initialize campaign processing:', error);
      
      // Enhanced error handling - simplified since App Bridge handles authentication
      console.log('🔄 Authentication error, allowing standard Remix error handling');
      
      throw error;
    }
  }

  /**
   * Initialize campaign processing for an action with enhanced authentication
   */
  static async initializeCampaignProcessingFromAction(args: ActionFunctionArgs) {
    try {
      console.log('🔐 Initializing campaign processing from action');
      
      // Use standard authenticate for session management
      const { admin, session } = await authenticate.admin(args.request);
      
      if (session?.shop) {
        console.log(`🔗 Registering shop for campaign processing: ${session.shop}`);
        
        // Create a separate admin client for webhook processing
        const webhookAdmin = await this.createWebhookAdminClient(session.shop, session.accessToken);
        
        if (webhookAdmin) {
          campaignWebhookIntegration.registerShop(session.shop, webhookAdmin);
          console.log(`✅ Campaign processing enabled for shop: ${session.shop}`);
        } else {
          console.warn(`⚠️ Failed to create webhook admin client for: ${session.shop}`);
        }
      }
      
      return { admin, session };
    } catch (error) {
      console.error('❌ Failed to initialize campaign processing:', error);
      
      // Enhanced error handling - simplified since App Bridge handles authentication
      console.log('🔄 Authentication error in action');
      
      throw error;
    }
  }

  /**
   * Create a dedicated admin client for webhook processing
   * This separates webhook processing from user session to avoid conflicts
   */
  private static async createWebhookAdminClient(shopDomain: string, accessToken?: string) {
    try {
      if (!accessToken) {
        console.warn('⚠️ No access token available for webhook admin client');
        return null;
      }

      // Create a mock session-like object for webhook processing
      const webhookSession = {
        shop: shopDomain,
        accessToken,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        scope: process.env.SCOPES || '',
        id: `webhook_${shopDomain}_${Date.now()}`,
        userId: 'webhook',
        firstName: 'Webhook',
        lastName: 'Client',
        email: '',
        accountOwner: true,
        locale: 'en',
        collaborator: false,
        emailVerified: true
      };

      // Use the same authenticate method but with webhook context
      const webhookAdmin = {
        graphql: async (query: string, options?: { variables?: any }) => {
          const response = await fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': accessToken,
            },
            body: JSON.stringify({
              query,
              variables: options?.variables || {}
            })
          });
          
          if (!response.ok) {
            console.error(`GraphQL request failed: ${response.status} ${response.statusText}`);
          }
          
          return response;
        }
      };

      console.log(`✅ Created webhook admin client for: ${shopDomain}`);
      return webhookAdmin;
    } catch (error) {
      console.error('❌ Failed to create webhook admin client:', error);
      return null;
    }
  }

  /**
   * Clean up expired webhook admin clients
   */
  static cleanupExpiredClients() {
    console.log('🧹 Cleaning up expired webhook admin clients');
    // Implement cleanup logic if needed
  }
}

// Export for compatibility
export const initializeCampaignProcessing = EnhancedCampaignSessionIntegration;
