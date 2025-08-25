import { CampaignRepository } from '../models/campaign.server';
import { PricingJobRepository } from '../models/pricing-job.server';
import { prisma } from '../db.server';
import type { ShopifyWebhookMessage } from '../types/pubsub-webhook';
import type { PricingRule } from '@prisma/client';

interface VariantInventoryUpdate {
  variantId: string;
  productId: string;
  inventoryQuantity: number;
  priceChange?: {
    oldPrice: string;
    newPrice: string;
    oldCompareAt?: string;
    newCompareAt?: string;
  };
}

interface CampaignTriggerResult {
  campaignId: string;
  campaignName: string;
  variantsProcessed: number;
  variantsUpdated: number;
  errors: string[];
  processingTimeMs: number;
}

// Admin client interface matching Shopify app structure
interface ShopifyAdminClient {
  graphql: (query: string, options?: { variables?: any }) => Promise<any>;
}

export class CampaignProcessingService {
  private static recentPriceUpdates = new Map<string, number>(); // variantId -> timestamp
  private static campaignCooldowns = new Map<string, number>(); // campaignId -> timestamp
  
  private shopId: string;

  // Constants for rate limiting
  private static readonly PRICE_UPDATE_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes (reduced from 10)
  private static readonly CAMPAIGN_COOLDOWN_MS = 1 * 60 * 1000; // 1 minute (reduced from 2)

  constructor(
    private shopDomain: string,
    private adminClient: ShopifyAdminClient
  ) {
    // Convert shopDomain to shopId for repository compatibility
    this.shopId = shopDomain;
  }

  /**
   * Process inventory webhook message and trigger applicable campaigns
   */
  async processInventoryWebhook(webhookMessage: ShopifyWebhookMessage): Promise<CampaignTriggerResult[]> {
    console.log('🎯 Starting campaign processing for inventory webhook:', webhookMessage.topic);
    
    const startTime = Date.now();
    const results: CampaignTriggerResult[] = [];
    const lockKey = `webhook_${webhookMessage.messageId}`;
    let variantLockKey: string | null = null;
    let preProcessingCooldownSet = false;
    let variantId: string | null = null;

    try {
      // Acquire processing lock to prevent duplicate processing
      const lockAcquired = await this.acquireProcessingLock(lockKey, 'WEBHOOK_PROCESSING', 60); // 60 second lock
      if (!lockAcquired) {
        console.log('⏭️ Webhook already being processed by another instance:', webhookMessage.messageId);
        return results;
      }

      // Clean up expired locks periodically
      if (Math.random() < 0.1) { // 10% chance to clean up
        await this.cleanupExpiredLocks();
      }

      // Check if this is a webhook triggered by our own price update
      if (await this.isWebhookFromOwnPriceUpdate(webhookMessage)) {
        console.log('⏭️ Skipping webhook processing - triggered by our own price update');
        return results;
      }

      // Get active campaigns
      const campaignRepo = new CampaignRepository(this.shopId);
      const activeCampaigns = await campaignRepo.findActive();
      
      if (activeCampaigns.length === 0) {
        console.log('📋 No active campaigns found for shop:', this.shopId);
        return results;
      }

      console.log(`📋 Found ${activeCampaigns.length} active campaigns to evaluate`);

      // Extract variant information from webhook payload
      const variantData = await this.extractVariantDataFromWebhook(webhookMessage);
      
      if (!variantData) {
        console.log('⚠️ Could not extract variant data from webhook payload');
        return results;
      }

      // Acquire variant-level processing lock to prevent duplicate processing of same variant
      variantLockKey = `variant_processing_${variantData.variantId}`;
      const variantLockAcquired = await this.acquireProcessingLock(variantLockKey, 'CAMPAIGN_EXECUTION', 120); // 2 minute lock
      if (!variantLockAcquired) {
        console.log(`⏭️ Variant ${variantData.variantId} already being processed by another webhook`);
        return results;
      }

      // Check if this variant was recently updated by us
      if (await this.isVariantOnPriceCooldown(variantData.variantId)) {
        console.log(`⏳ Skipping variant ${variantData.variantId} - on price update cooldown`);
        return results;
      }

      // 🔒 PRE-PROCESSING COOLDOWN: Set cooldown immediately to prevent concurrent webhooks
      // This is the key fix - we set cooldown BEFORE processing, not after
      variantId = variantData.variantId;
      await this.setVariantPriceCooldown(variantData.variantId);
      preProcessingCooldownSet = true;
      console.log(`🔒 Pre-processing cooldown set for variant: ${variantData.variantId}`);

      // Process each campaign with cooldown check
      for (const campaign of activeCampaigns) {
        const campaignStartTime = Date.now();
        
        try {
          // Check campaign cooldown
          if (await this.isCampaignOnCooldown(campaign.id)) {
            console.log(`⏳ Skipping campaign ${campaign.name} - on cooldown`);
            continue;
          }

          console.log(`🎯 Processing campaign: ${campaign.name} (${campaign.id})`);
          
          const result = await this.processCampaignRules(
            campaign,
            variantData,
            webhookMessage
          );
          
          result.processingTimeMs = Date.now() - campaignStartTime;
          results.push(result);
          
          // Increment campaign trigger count if any variants were processed
          if (result.variantsProcessed > 0) {
            await campaignRepo.incrementTriggerCount(campaign.id);
            
            // Set campaign cooldown if variants were updated
            if (result.variantsUpdated > 0) {
              await this.setCampaignCooldown(campaign.id);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error processing campaign ${campaign.name}:`, error);
          results.push({
            campaignId: campaign.id,
            campaignName: campaign.name,
            variantsProcessed: 0,
            variantsUpdated: 0,
            errors: [`Campaign processing failed: ${error instanceof Error ? error.message : String(error)}`],
            processingTimeMs: Date.now() - campaignStartTime
          });
        }
      }

      const totalTime = Date.now() - startTime;
      const warningsArray = results.flatMap(r => r.errors).filter(e => e.includes('Could not fetch'));
      if (warningsArray.length > 0) {
        console.log('⚠️ Campaign processing warnings:', warningsArray);
      }
      console.log(`✅ Campaign processing completed in ${totalTime}ms. Processed ${results.length} campaigns`);
      
      return results;

    } catch (error) {
      console.error('❌ Fatal error in campaign processing:', error);
      throw error;
    } finally {
      // Always release both locks
      await this.releaseProcessingLock(lockKey);
      
      // Release variant lock if it was set
      if (variantLockKey) {
        await this.releaseProcessingLock(variantLockKey);
      }

      // Rollback pre-processing cooldown if no successful price updates occurred
      if (preProcessingCooldownSet && variantId) {
        const hasSuccessfulUpdates = results.some(r => r.variantsUpdated > 0);
        if (!hasSuccessfulUpdates) {
          console.log(`🔄 Rolling back pre-processing cooldown for variant: ${variantId}`);
          await this.clearVariantPriceCooldown(variantId);
        }
      }
    }
  }

  /**
   * Check if webhook was triggered by our own price update
   */
  private async isWebhookFromOwnPriceUpdate(webhookMessage: ShopifyWebhookMessage): Promise<boolean> {
    try {
      // For products/update webhook, check if we recently updated any variants in the product
      if (webhookMessage.topic === 'products/update') {
        const payload = webhookMessage.payload;
        if (payload.variants && Array.isArray(payload.variants)) {
          for (const variant of payload.variants) {
            const variantGid = `gid://shopify/ProductVariant/${variant.id}`;
            
            // Check both price cooldown and recent price change
            const isOnCooldown = await this.isVariantOnPriceCooldown(variantGid);
            
            // Also check if price was just updated (compare timestamps)
            const now = new Date();
            const variantUpdatedAt = new Date(variant.updated_at || '1970-01-01');
            const timeDifference = now.getTime() - variantUpdatedAt.getTime();
            const wasRecentlyUpdated = timeDifference < 60000; // Within 1 minute
            
            if (isOnCooldown || wasRecentlyUpdated) {
              console.log(`🔄 Webhook from own price update detected for variant: ${variantGid} (cooldown: ${isOnCooldown}, recent: ${wasRecentlyUpdated})`);
              return true;
            }
          }
        }
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error checking webhook origin:', error);
      return false;
    }
  }

  /**
   * Check if variant is on price update cooldown
   */
  private async isVariantOnPriceCooldown(variantId: string): Promise<boolean> {
    try {
      const cooldown = await prisma.priceCooldown.findFirst({
        where: {
          variantId,
          type: 'PRICE_UPDATE',
          expiresAt: { gt: new Date() }
        }
      });
      
      return cooldown !== null;
    } catch (error) {
      console.error('❌ Error checking variant cooldown:', error);
      return false; // If error, don't block processing
    }
  }

  /**
   * Check if campaign is on cooldown
   */
  private async isCampaignOnCooldown(campaignId: string): Promise<boolean> {
    try {
      const cooldown = await prisma.priceCooldown.findFirst({
        where: {
          variantId: `campaign_${campaignId}`, // Campaign cooldowns use prefixed variant field
          type: 'CAMPAIGN_TRIGGER',
          expiresAt: { gt: new Date() }
        }
      });
      
      return cooldown !== null;
    } catch (error) {
      console.error('❌ Error checking campaign cooldown:', error);
      return false; // If error, don't block processing
    }
  }

  /**
   * Set campaign cooldown after successful trigger
   */
  private async setCampaignCooldown(campaignId: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CampaignProcessingService.CAMPAIGN_COOLDOWN_MS);
      
      // Find shop for the cooldown record
      const shop = await prisma.shopifyShop.findFirst({
        where: { shopDomain: this.shopDomain }
      });
      
      if (!shop) {
        console.warn('⚠️ Shop not found for cooldown, skipping');
        return;
      }

      await prisma.priceCooldown.upsert({
        where: {
          variantId_type: {
            variantId: `campaign_${campaignId}`,
            type: 'CAMPAIGN_TRIGGER'
          }
        },
        update: {
          expiresAt,
          updatedAt: new Date(),
          campaignId
        },
        create: {
          variantId: `campaign_${campaignId}`,
          campaignId,
          type: 'CAMPAIGN_TRIGGER',
          expiresAt,
          shopifyShopId: shop.id
        }
      });
      
      console.log(`⏳ Set campaign cooldown for: ${campaignId} (${CampaignProcessingService.CAMPAIGN_COOLDOWN_MS / 1000}s)`);
    } catch (error) {
      console.error('❌ Error setting campaign cooldown:', error);
    }
  }

  /**
   * Set variant price update cooldown
   */
  private async setVariantPriceCooldown(variantId: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + CampaignProcessingService.PRICE_UPDATE_COOLDOWN_MS);
      
      // Find shop for the cooldown record
      const shop = await prisma.shopifyShop.findFirst({
        where: { shopDomain: this.shopDomain }
      });
      
      if (!shop) {
        console.warn('⚠️ Shop not found for variant cooldown, skipping');
        return;
      }

      await prisma.priceCooldown.upsert({
        where: {
          variantId_type: {
            variantId,
            type: 'PRICE_UPDATE'
          }
        },
        update: {
          expiresAt,
          updatedAt: new Date()
        },
        create: {
          variantId,
          type: 'PRICE_UPDATE',
          expiresAt,
          shopifyShopId: shop.id
        }
      });
      
      console.log(`⏳ Set price cooldown for variant: ${variantId} (${CampaignProcessingService.PRICE_UPDATE_COOLDOWN_MS / 1000}s)`);
    } catch (error) {
      console.error('❌ Error setting variant price cooldown:', error);
    }
  }

  /**
   * Clear variant price update cooldown (rollback mechanism)
   */
  private async clearVariantPriceCooldown(variantId: string): Promise<void> {
    try {
      await prisma.priceCooldown.deleteMany({
        where: {
          variantId,
          type: 'PRICE_UPDATE'
        }
      });
      
      console.log(`🧹 Cleared price cooldown for variant: ${variantId}`);
    } catch (error) {
      console.error('❌ Error clearing variant price cooldown:', error);
    }
  }

  /**
   * Extract variant data from webhook payload
   */
  private async extractVariantDataFromWebhook(webhookMessage: ShopifyWebhookMessage): Promise<VariantInventoryUpdate | null> {
    try {
      const payload = webhookMessage.payload; // Use 'payload' instead of 'data'
      console.log('🔍 Extracting variant data from webhook:', webhookMessage.topic);
      console.log('🔍 Payload keys:', Object.keys(payload));
      
      // Handle different webhook types
      switch (webhookMessage.topic) {
        case 'inventory_levels/update':
          // Get variant ID from inventory item
          if (!payload.inventory_item_id) {
            console.log('❌ Missing inventory_item_id in webhook payload');
            return null;
          }
          
          console.log('🔍 Getting variant from inventory_item_id:', payload.inventory_item_id);
          // Query Shopify to get variant from inventory item
          const variantFromInventory = await this.getVariantFromInventoryItem(payload.inventory_item_id);
          if (!variantFromInventory) {
            console.log('❌ Could not get variant from inventory item');
            return null;
          }
          
          console.log('✅ Found variant from inventory item:', {
            variantId: variantFromInventory.id,
            productId: variantFromInventory.product.id,
            inventoryQuantity: payload.available
          });

          return {
            variantId: variantFromInventory.id,
            productId: variantFromInventory.product.id,
            inventoryQuantity: payload.available || 0
          };

        case 'inventory_items/update':
          // Similar to inventory_levels/update but different payload structure
          const variantFromItem = await this.getVariantFromInventoryItem(payload.id);
          if (!variantFromItem) {
            return null;
          }
          
          return {
            variantId: variantFromItem.id,
            productId: variantFromItem.product.id,
            inventoryQuantity: variantFromItem.inventoryQuantity || 0
          };

        case 'products/update':
        case 'products/create':
          // For product webhooks, we need to check all variants
          // For now, just return the first variant as an example
          console.log('🔍 Processing product webhook, checking variants');
          if (payload.variants && payload.variants.length > 0) {
            const firstVariant = payload.variants[0];
            console.log('✅ Found variant in product webhook:', {
              variantId: `gid://shopify/ProductVariant/${firstVariant.id}`,
              productId: `gid://shopify/Product/${payload.id}`,
              inventoryQuantity: firstVariant.inventory_quantity
            });
            return {
              variantId: `gid://shopify/ProductVariant/${firstVariant.id}`,
              productId: `gid://shopify/Product/${payload.id}`,
              inventoryQuantity: firstVariant.inventory_quantity || 0
            };
          } else {
            console.log('❌ No variants found in product webhook');
          }
          break;
          
        default:
          console.log('⚠️ Unhandled webhook topic:', webhookMessage.topic);
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error extracting variant data from webhook:', error);
      return null;
    }
  }

  /**
   * Get variant information from inventory item ID
   */
  private async getVariantFromInventoryItem(inventoryItemId: string): Promise<any> {
    try {
      console.log('🔍 Querying variant for inventory item:', inventoryItemId);
      const response = await this.adminClient.graphql(`
        query getVariantByInventoryItem($inventoryItemId: ID!) {
          inventoryItem(id: $inventoryItemId) {
            variant {
              id
              inventoryQuantity
              price
              title
              product {
                id
                title
              }
            }
          }
        }
      `, {
        variables: {
          inventoryItemId: `gid://shopify/InventoryItem/${inventoryItemId}`
        }
      });

      // Check for authentication errors
      if (!response.ok && response.status === 302) {
        console.error('🚫 GraphQL authentication failed - session expired');
        return null;
      }

      const data = await response.json();
      console.log('🔍 GraphQL response:', JSON.stringify(data, null, 2));

      if (data.errors) {
        console.error('❌ GraphQL errors:', data.errors);
        
        // Check for authentication-related errors
        const authErrors = data.errors.filter((error: any) => 
          error.message?.includes('access') || 
          error.message?.includes('permission') ||
          error.message?.includes('unauthorized')
        );
        
        if (authErrors.length > 0) {
          console.error('🚫 GraphQL authentication errors detected');
          return null;
        }
      }

      const variant = data.data?.inventoryItem?.variant;
      if (variant) {
        console.log('✅ Found variant from inventory item:', variant.id);
      } else {
        console.log('❌ No variant found in GraphQL response');
      }
      
      return variant;
    } catch (error) {
      console.error('❌ Error getting variant from inventory item:', error);
      
      // Check if error is related to network/authentication
      if (error instanceof Error && (
        error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('timeout')
      )) {
        console.error('🌐 Network/Authentication error in GraphQL call');
      }
      
      return null;
    }
  }

  /**
   * Process campaign rules against variant data
   */
  private async processCampaignRules(
    campaign: any,
    variantData: VariantInventoryUpdate,
    webhookMessage: ShopifyWebhookMessage
  ): Promise<CampaignTriggerResult> {
    const result: CampaignTriggerResult = {
      campaignId: campaign.id,
      campaignName: campaign.name,
      variantsProcessed: 0,
      variantsUpdated: 0,
      errors: [],
      processingTimeMs: 0
    };

    try {
      // Check if variant matches campaign target criteria
      const matchesTarget = await this.checkTargetProductCriteria(campaign.targetProducts, variantData);
      console.log('🎯 Target matching result for campaign:', campaign.name, 'Result:', matchesTarget);
      console.log('🎯 Campaign targetProducts:', JSON.stringify(campaign.targetProducts, null, 2));
      console.log('🎯 Variant data:', JSON.stringify(variantData, null, 2));
      
      if (!matchesTarget) {
        console.log(`⏭️ Variant ${variantData.variantId} doesn't match campaign ${campaign.name} target criteria`);
        return result;
      }

      console.log(`✅ Variant ${variantData.variantId} matches campaign ${campaign.name} target criteria`);
      result.variantsProcessed = 1;

      // Get current variant details from Shopify
      console.log('🔍 About to fetch variant details for:', variantData.variantId);
      const currentVariant = await this.getVariantDetails(variantData.variantId);
      console.log('🔍 getVariantDetails result:', currentVariant ? 'SUCCESS' : 'FAILED');
      if (!currentVariant) {
        console.log('❌ getVariantDetails returned null for variant:', variantData.variantId);
        result.errors.push('Could not fetch current variant details');
        return result;
      }

      // Evaluate campaign rules
      const ruleResults = await this.evaluateCampaignRules(
        campaign.rules,
        currentVariant,
        variantData.inventoryQuantity,
        webhookMessage
      );

      // Process rule results in batches
      const batchResults = await this.processPricingRulesBatch(
        [currentVariant],
        ruleResults,
        campaign,
        webhookMessage
      );

      result.variantsUpdated = batchResults.filter(r => r.success).length;
      result.errors.push(...batchResults.filter(r => !r.success).map(r => r.error || 'Unknown error'));

      return result;

    } catch (error) {
      console.error(`❌ Error processing campaign rules for ${campaign.name}:`, error);
      result.errors.push(`Rule processing failed: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }
  }

  /**
   * Check if variant matches campaign target product criteria
   */
  private async checkTargetProductCriteria(targetProducts: any, variantData: VariantInventoryUpdate): Promise<boolean> {
    if (!targetProducts) {
      return true; // No criteria = match all
    }

    // Handle JSON object structure from database
    if (typeof targetProducts === 'object' && !Array.isArray(targetProducts)) {
      // Check if the product ID matches any of the target criteria
      if (targetProducts.productIds && targetProducts.productIds.length > 0) {
        const productIdMatch = targetProducts.productIds.includes(variantData.productId);
        if (productIdMatch) {
          console.log('✅ Product matches target criteria:', variantData.productId);
          return true;
        }
      }
      
      // Check collections if present
      if (targetProducts.collections && targetProducts.collections.length > 0) {
        // Would need to check if product is in these collections
        // For now, return false as we don't have collection data in webhook
        console.log('🔍 Collection targeting not implemented yet');
      }
      
      // Check tags if present  
      if (targetProducts.tags && targetProducts.tags.length > 0) {
        // Would need to check if product has these tags
        console.log('🔍 Tag targeting not implemented yet');
      }

      // Check vendors if present
      if (targetProducts.vendors && targetProducts.vendors.length > 0) {
        // Would need to check if product vendor matches
        console.log('🔍 Vendor targeting not implemented yet');  
      }

      // Check product types if present
      if (targetProducts.productTypes && targetProducts.productTypes.length > 0) {
        // Would need to check if product type matches
        console.log('🔍 Product type targeting not implemented yet');
      }

      console.log('❌ Product does not match target criteria:', variantData.productId);
      return false;
    }

    // Legacy array handling (if any old data exists)
    if (Array.isArray(targetProducts)) {
      console.log('⚠️ Legacy array-based targetProducts detected');
      for (const criteria of targetProducts) {
        if (criteria.type === 'all') {
          return true;
        }
        
        if (criteria.type === 'product' && criteria.value === variantData.productId) {
          return true;
        }
        
        if (criteria.type === 'variant' && criteria.value === variantData.variantId) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get detailed variant information from Shopify
   */
  private async getVariantDetails(variantId: string): Promise<any> {
    try {
      console.log('🔍 Querying variant details for:', variantId);
      const response = await this.adminClient.graphql(`
        query getVariantDetails($id: ID!) {
          productVariant(id: $id) {
            id
            price
            compareAtPrice
            title
            inventoryQuantity
            inventoryPolicy
            product {
              id
              title
            }
            inventoryItem {
              id
              tracked
            }
          }
        }
      `, {
        variables: { id: variantId }
      });

      // Check for authentication errors before trying to parse JSON
      if (!response.ok) {
        if (response.status === 302) {
          console.error('🚫 GraphQL authentication failed - session expired (302 redirect)');
          return null;
        } else {
          console.error(`❌ GraphQL request failed with status: ${response.status}`);
          return null;
        }
      }

      const data = await response.json();
      console.log('🔍 Variant details response:', JSON.stringify(data, null, 2));

      if (data.errors) {
        console.error('❌ GraphQL errors:', data.errors);
        
        // Check for specific authentication/permission errors
        const hasAuthError = data.errors.some((error: any) => 
          error.message?.includes('access') || 
          error.message?.includes('permission') ||
          error.message?.includes('unauthorized') ||
          error.extensions?.code === 'ACCESS_DENIED'
        );
        
        if (hasAuthError) {
          console.error('🚫 GraphQL authentication/permission errors detected');
        }
        
        return null;
      }

      const variant = data.data?.productVariant;
      if (variant) {
        console.log('✅ Found variant details:', {
          id: variant.id,
          price: variant.price,
          inventoryQuantity: variant.inventoryQuantity
        });
      } else {
        console.log('❌ No variant found in GraphQL response');
      }

      return variant;
    } catch (error) {
      console.error('❌ Error getting variant details:', error);
      if (error instanceof Error) {
        console.error('Error stack:', error.stack);
        
        // Check for specific error types
        if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
          console.error('🌐 Network error in GraphQL request - possible session timeout');
        }
      }
      return null;
    }
  }

  /**
   * Evaluate campaign rules using Enterprise Rule Engine with threshold crossing detection
   */
  private async evaluateCampaignRules(
    rules: PricingRule[],
    variant: any,
    inventoryQuantity: number,
    webhookMessage: ShopifyWebhookMessage
  ): Promise<{ rule: PricingRule; shouldApply: boolean; reason: string }[]> {
    const results: { rule: PricingRule; shouldApply: boolean; reason: string }[] = [];
    
    // Import enterprise rule engine
    const { EnterpriseRuleExecutionEngine } = await import('../lib/services/EnterpriseRuleExecutionEngine.server');

    for (const rule of rules) {
      try {
        // Get campaign data
        if (!rule.campaignId) {
          console.error(`❌ No campaign ID for rule ${rule.id}`);
          continue;
        }

        const campaign = await prisma.campaign.findUnique({
          where: { id: rule.campaignId }
        });

        if (!campaign) {
          console.error(`❌ Campaign not found for rule ${rule.id}`);
          continue;
        }

        // Capture current variant state
        await EnterpriseRuleExecutionEngine.captureVariantState(
          variant.id,
          variant.product?.id || 'unknown',
          inventoryQuantity,
          parseFloat(variant.price || '0'),
          campaign.shopifyShopId,
          `Webhook: ${webhookMessage.topic}`
        );

        // Create evaluation context
        const currentState = {
          variantId: variant.id,
          productId: variant.product?.id || 'unknown',
          inventoryQuantity,
          priceAmount: parseFloat(variant.price || '0'),
          capturedAt: new Date()
        };

        const context = {
          rule,
          campaign,
          currentState
        };

        // Evaluate rule using enterprise engine
        const evaluation = await EnterpriseRuleExecutionEngine.shouldExecuteRule(context);

        console.log(`🏢 Enterprise evaluation for rule ${rule.id}:`, {
          ruleCondition: rule.whenCondition,
          threshold: rule.whenValue,
          currentInventory: inventoryQuantity,
          shouldExecute: evaluation.shouldExecute,
          reason: evaluation.reason,
          stateTransition: evaluation.stateTransition
        });

        results.push({
          rule,
          shouldApply: evaluation.shouldExecute,
          reason: evaluation.reason
        });

      } catch (error) {
        console.error(`❌ Enterprise rule evaluation failed for rule ${rule.id}:`, error);
        
        // Fallback to basic evaluation for this rule only
        const fallbackEvaluation = this.fallbackRuleEvaluation(rule, variant, inventoryQuantity);
        results.push({
          rule,
          shouldApply: fallbackEvaluation.apply,
          reason: `Fallback: ${fallbackEvaluation.reason}`
        });
      }
    }

    return results;
  }

  /**
   * Fallback rule evaluation for when enterprise engine fails
   * Uses simple threshold checking without state management
   */
  private fallbackRuleEvaluation(
    rule: PricingRule,
    variant: any,
    inventoryQuantity: number
  ): { apply: boolean; reason: string } {
    console.warn('⚠️ Using fallback rule evaluation - enterprise engine failed');
    
    const whenValue = parseFloat(rule.whenValue) || 0;
    
    switch (rule.whenCondition) {
      case 'less_than_abs':
        return {
          apply: inventoryQuantity < whenValue,
          reason: `FALLBACK: Inventory ${inventoryQuantity} < ${whenValue}`
        };
        
      case 'more_than_abs':
        return {
          apply: inventoryQuantity > whenValue,
          reason: `FALLBACK: Inventory ${inventoryQuantity} > ${whenValue}`
        };
        
      default:
        return {
          apply: false,
          reason: `FALLBACK: Unsupported condition ${rule.whenCondition}`
        };
    }
  }

  /**
   * Process pricing rules in batches (5 variants per batch)
   */
  private async processPricingRulesBatch(
    variants: any[],
    ruleResults: { rule: PricingRule; shouldApply: boolean; reason: string }[],
    campaign: any,
    webhookMessage: ShopifyWebhookMessage
  ): Promise<Array<{ success: boolean; variantId: string; error?: string }>> {
    const results: Array<{ success: boolean; variantId: string; error?: string }> = [];
    const batchSize = 5;

    // Get applicable rules with prioritization
    const applicableRules = ruleResults.filter(r => r.shouldApply);
    
    if (applicableRules.length === 0) {
      console.log('⏭️ No applicable rules found for variants');
      return variants.map(v => ({ success: false, variantId: v.id, error: 'No applicable rules' }));
    }

    // Sort rules by priority (most specific condition first)
    const prioritizedRules = this.prioritizeRules(applicableRules);
    console.log(`🎯 Found ${applicableRules.length} applicable rules, using highest priority rule`);

    // Process variants in batches
    for (let i = 0; i < variants.length; i += batchSize) {
      const batch = variants.slice(i, i + batchSize);
      
      for (const variant of batch) {
        try {
          const batchResult = await this.updateVariantPrice(variant, prioritizedRules, campaign, webhookMessage);
          results.push(batchResult);
        } catch (error) {
          results.push({
            success: false,
            variantId: variant.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Small delay between batches to respect rate limits
      if (i + batchSize < variants.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    return results;
  }

  /**
   * Prioritize applicable rules - most specific conditions win
   * For inventory-based rules: smaller threshold = higher priority
   * Example: inventory < 10 beats inventory < 15
   */
  private prioritizeRules(
    applicableRules: { rule: PricingRule; shouldApply: boolean; reason: string }[]
  ): { rule: PricingRule; shouldApply: boolean; reason: string }[] {
    return applicableRules.sort((a, b) => {
      const ruleA = a.rule;
      const ruleB = b.rule;
      
      // Higher priority for more specific inventory conditions
      if (ruleA.whenCondition === 'less_than_abs' && ruleB.whenCondition === 'less_than_abs') {
        const valueA = parseFloat(ruleA.whenValue) || 0;
        const valueB = parseFloat(ruleB.whenValue) || 0;
        // Smaller threshold = higher priority (reverse sort)
        return valueA - valueB;
      }
      
      if (ruleA.whenCondition === 'more_than_abs' && ruleB.whenCondition === 'more_than_abs') {
        const valueA = parseFloat(ruleA.whenValue) || 0;
        const valueB = parseFloat(ruleB.whenValue) || 0;
        // Larger threshold = higher priority
        return valueB - valueA;
      }
      
      // If different condition types, maintain original order
      return 0;
    });
  }

  /**
   * Update variant price based on applicable rules
   */
  private async updateVariantPrice(
    variant: any,
    prioritizedRules: { rule: PricingRule; shouldApply: boolean; reason: string }[],
    campaign: any,
    webhookMessage: ShopifyWebhookMessage
  ): Promise<{ success: boolean; variantId: string; error?: string }> {
    try {
      const currentPrice = parseFloat(variant.price);
      const selectedRule = prioritizedRules[0]; // Use highest priority rule
      const rule = selectedRule.rule;
      
      console.log(`🎯 Applying highest priority rule: ${rule.whenCondition} ${rule.whenValue} → ${rule.thenAction} ${rule.thenValue} (${selectedRule.reason})`);
      
      // Calculate new price
      const newPrice = this.calculateNewPrice(currentPrice, rule);
      const newCompareAt = rule.changeCompareAt ? this.calculateCompareAtPrice(variant.compareAtPrice, rule, currentPrice) : variant.compareAtPrice;
      
      // Update variant price via Shopify API
      const updateResponse = await this.adminClient.graphql(`
        mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              price
              compareAtPrice
            }
            userErrors {
              field
              message
            }
          }
        }
      `, {
        variables: {
          productId: variant.product.id,
          variants: [{
            id: variant.id,
            price: newPrice.toFixed(2),
            ...(newCompareAt && { compareAtPrice: newCompareAt })
          }]
        }
      });

      const updateData = await updateResponse.json();

      if (updateData.data?.productVariantsBulkUpdate?.userErrors?.length > 0) {
        const errors = updateData.data.productVariantsBulkUpdate.userErrors;
        throw new Error(`Shopify API error: ${errors.map((e: any) => e.message).join(', ')}`);
      }

      // Log successful update to audit trail
      await this.logCampaignTriggerAudit({
        variantId: variant.id,
        productId: variant.product.id,
        campaignId: campaign.id,
        campaignName: campaign.name,
        oldPrice: currentPrice.toFixed(2),
        newPrice: newPrice.toFixed(2),
        oldCompareAt: variant.compareAtPrice,
        newCompareAt: newCompareAt,
        triggerReason: `Campaign triggered by ${webhookMessage.topic}: ${selectedRule.reason}`,
        webhookMessageId: webhookMessage.messageId,
        processingTimestamp: new Date()
      });

      console.log(`✅ Successfully updated variant ${variant.id} price from $${currentPrice} to $${newPrice}`);
      
      // Cooldown was already set in pre-processing phase, just refresh it with longer duration
      await this.setVariantPriceCooldown(variant.id);
      
      return { success: true, variantId: variant.id };

    } catch (error) {
      console.error(`❌ Error updating variant ${variant.id} price:`, error);
      return {
        success: false,
        variantId: variant.id,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Calculate new price based on pricing rule
   */
  private calculateNewPrice(currentPrice: number, rule: PricingRule): number {
    const thenValue = parseFloat(rule.thenValue) || 0;
    
    switch (rule.thenAction) {
      case 'increase_price':
        if (rule.thenMode === 'percentage') {
          return currentPrice * (1 + thenValue / 100);
        } else {
          return currentPrice + thenValue;
        }
      case 'reduce_price':
        if (rule.thenMode === 'percentage') {
          return currentPrice * (1 - thenValue / 100);
        } else {
          return currentPrice - thenValue;
        }
      case 'change_price':
        if (rule.thenMode === 'absolute') {
          return thenValue;
        } else {
          return currentPrice * (thenValue / 100);
        }
      default:
        return currentPrice;
    }
  }

  /**
   * Calculate new compare-at price if needed
   */
  private calculateCompareAtPrice(currentCompareAt: string | null, rule: PricingRule, originalPrice: number): string | null {
    if (!rule.changeCompareAt) {
      return currentCompareAt;
    }
    
    // If no compare-at price exists, use the original price
    if (!currentCompareAt) {
      return originalPrice.toFixed(2);
    }
    
    const compareAtPrice = parseFloat(currentCompareAt);
    const newCompareAt = this.calculateNewPrice(compareAtPrice, rule);
    
    return newCompareAt.toFixed(2);
  }

  /**
   * Log campaign trigger to audit trail
   */
  private async logCampaignTriggerAudit(auditData: {
    variantId: string;
    productId: string;
    campaignId: string;
    campaignName: string;
    oldPrice: string;
    newPrice: string;
    oldCompareAt?: string | null;
    newCompareAt?: string | null;
    triggerReason: string;
    webhookMessageId?: string;
    processingTimestamp: Date;
  }): Promise<void> {
    try {
      // Create pricing job for audit trail tracking
      const jobRepo = new PricingJobRepository(this.shopId);
      const jobName = `Campaign Auto-Trigger: ${auditData.campaignName}`;
      
      const pricingJob = await jobRepo.create({
        name: jobName,
        type: 'CAMPAIGN',
        selectedVariants: [{
          variantId: auditData.variantId,
          productId: auditData.productId,
          productTitle: 'Auto-triggered variant',
          variantTitle: 'Auto-triggered variant',
          currentPrice: auditData.oldPrice,
          compareAtPrice: auditData.oldCompareAt || undefined,
          inventory: 0
        }],
        rules: [], // Rules are stored in campaign
        templateId: undefined
      }, 'system'); // System-triggered with userId

      // Add processing result with comprehensive audit trail
      await jobRepo.addProcessingResultWithAudit(pricingJob.id, {
        variantId: auditData.variantId,
        productId: auditData.productId,
        success: true,
        oldPrice: auditData.oldPrice,
        newPrice: auditData.newPrice,
        oldCompareAt: auditData.oldCompareAt || undefined,
        newCompareAt: auditData.newCompareAt || undefined,
        triggerReason: auditData.triggerReason,
        userId: 'system'
      });

      console.log(`📝 Audit trail logged for campaign trigger: ${auditData.campaignName} → Variant ${auditData.variantId}`);

    } catch (error) {
      console.error('❌ Error logging campaign trigger audit:', error);
      // Don't throw - audit logging failure shouldn't break the main flow
    }
  }

  // === PROCESSING LOCK MANAGEMENT ===
  
  /**
   * Acquire a processing lock to prevent duplicate processing
   */
  private async acquireProcessingLock(lockKey: string, type: 'WEBHOOK_PROCESSING' | 'CAMPAIGN_EXECUTION', timeoutSeconds: number = 60): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + timeoutSeconds * 1000);
      
      // Find shop for the lock record
      const shop = await prisma.shopifyShop.findFirst({
        where: { shopDomain: this.shopDomain }
      });
      
      if (!shop) {
        console.warn('⚠️ Shop not found for processing lock, allowing processing');
        return true; // If shop not found, don't block processing
      }

      // Check for existing lock first to avoid unnecessary create attempts
      const existingLock = await prisma.processingLock.findUnique({
        where: { lockKey }
      });

      if (existingLock) {
        if (existingLock.expiresAt > new Date()) {
          console.log(`⏳ Processing lock already held: ${lockKey} (expires: ${existingLock.expiresAt.toISOString()})`);
          return false; // Lock is still valid, cannot acquire
        } else {
          // Lock expired, try to update it
          try {
            await prisma.processingLock.update({
              where: { lockKey },
              data: {
                expiresAt,
                processId: process.pid?.toString() || 'unknown'
              }
            });
            console.log(`🔒 Updated expired processing lock: ${lockKey} (expires in ${timeoutSeconds}s)`);
            return true;
          } catch (updateError) {
            console.log(`⏳ Failed to update expired lock, another process acquired it: ${lockKey}`);
            return false;
          }
        }
      }

      // Try to create a new lock
      const lock = await prisma.processingLock.create({
        data: {
          lockKey,
          type,
          expiresAt,
          processId: process.pid?.toString() || 'unknown',
          shopifyShopId: shop.id
        }
      });
      
      console.log(`🔒 Acquired processing lock: ${lockKey} (expires in ${timeoutSeconds}s)`);
      return true;

    } catch (error) {
      // If lock creation fails due to race condition, check again
      if (error instanceof Error && error.message.includes('unique constraint')) {
        console.log(`🔄 Lock creation race condition for: ${lockKey}, checking existing lock`);
        
        const existingLock = await prisma.processingLock.findUnique({
          where: { lockKey }
        });
        
        if (existingLock && existingLock.expiresAt > new Date()) {
          console.log(`⏳ Confirmed lock already held by another process: ${lockKey}`);
          return false; // Lock is valid, cannot acquire
        }
      }
      
      console.error('❌ Error acquiring processing lock:', error);
      return false; // Be more conservative - don't process if lock acquisition fails
    }
  }

  /**
   * Release a processing lock
   */
  private async releaseProcessingLock(lockKey: string): Promise<void> {
    try {
      await prisma.processingLock.delete({
        where: { lockKey }
      });
      console.log(`🔓 Released processing lock: ${lockKey}`);
    } catch (error) {
      // Lock might already be expired/deleted, that's OK
      console.log(`⚠️ Could not release lock ${lockKey}, might already be expired`);
    }
  }

  /**
   * Clean up expired processing locks (should be run periodically)
   */
  private async cleanupExpiredLocks(): Promise<void> {
    try {
      const deletedCount = await prisma.processingLock.deleteMany({
        where: {
          expiresAt: { lt: new Date() }
        }
      });
      
      if (deletedCount.count > 0) {
        console.log(`🧹 Cleaned up ${deletedCount.count} expired processing locks`);
      }
    } catch (error) {
      console.error('❌ Error cleaning up expired locks:', error);
    }
  }
}
