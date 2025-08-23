/**
 * Temporary debug version of admin.tsx to log shop domain and campaign creation
 * Instructions: 
 * 1. Copy this content and replace the processInventoryRules function in admin.tsx
 * 2. Test price changes in your production app
 * 3. Check server console logs to see which shop domain is being used
 * 4. Use that domain in the Google Cloud queries
 */

const processInventoryRules = async (
  admin: any, 
  formData: FormData,
  shopDomain: string
): Promise<ProcessResult> => {
  console.log('🏪 DEBUG: Processing for shop domain:', shopDomain);
  
  const results: ProcessResult['results'] = [];
  let pricingJob: any;
  let campaignRepo: any;
  let auditLogger: any;
  let campaignId: string | null = null;

  try {
    // Initialize database services
    try {
      campaignRepo = new CampaignRepository(shopDomain);
      auditLogger = new AuditLogger(shopDomain);
      
      console.log('🔧 DEBUG: Database services initialized for:', shopDomain);
      
      // Create a campaign for this pricing operation
      const campaignName = `Pricing Update ${new Date().toLocaleString()}`;
      const campaign = await campaignRepo.create({
        name: campaignName,
        status: 'ACTIVE',
        description: 'Automated pricing update based on inventory rules'
      });
      
      campaignId = campaign.id;
      console.log('📋 DEBUG: Campaign created:', campaignId, 'for shop:', shopDomain);
      
    } catch (dbError) {
      console.error('❌ DEBUG: Database initialization failed for shop:', shopDomain, 'Error:', dbError);
      console.error('Continuing without audit logging...');
    }

    // ... rest of the function stays the same
    // Just add this logging section before the successful audit logging:
    
    // In the successful price change section, add:
    console.log('✅ DEBUG: Price changed successfully for variant:', variantId);
    console.log('   Shop:', shopDomain);
    console.log('   Campaign ID:', campaignId);
    console.log('   Old Price:', currentPrice.toFixed(2));
    console.log('   New Price:', newPrice);

    // Log successful price change to audit system
    if (auditLogger && campaignId) {
      try {
        console.log('📝 DEBUG: Logging to audit system...');
        await auditLogger.logPriceChange({
          oldPrice: currentPrice.toFixed(2),
          newPrice: newPrice,
          variant: {
            id: variantId,
            title: variant.title
          },
          product: {
            id: variant.product.id,
            title: variant.product.title
          },
          triggerReason: ruleEvaluation.reason,
          campaignId: campaignId
        });
        console.log('✅ DEBUG: Audit entry logged successfully');
      } catch (auditError) {
        console.error('❌ DEBUG: Failed to log audit entry:', auditError);
      }
    } else {
      console.log('⚠️ DEBUG: Skipping audit log - auditLogger:', !!auditLogger, 'campaignId:', campaignId);
    }

    // ... rest remains the same
  } catch (error) {
    console.error('❌ DEBUG: Overall processing error for shop:', shopDomain, 'Error:', error);
    // ... error handling
  }
  
  return { results, campaignId };
};
