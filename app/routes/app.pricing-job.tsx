import { useState, useEffect } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  Banner,
  InlineStack,
  IndexTable,
  Badge,
  EmptyState,
  Select,
  TextField,
  Checkbox,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { CampaignRepository } from "../models/campaign.server";
import { PricingJobRepository } from "../models/pricing-job.server";
import { AuditLogger } from "../services/audit-logger.server";
import { json } from "@remix-run/node";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const campaignRepo = new CampaignRepository(session.shop);
  
  // Get active campaigns for this shop
  const activeCampaigns = await campaignRepo.findByStatus('ACTIVE');
  
  return json({ 
    shop: session.shop,
    activeCampaigns 
  });
};

const processInventoryRules = async (
  admin: any, 
  variantIds: string[], 
  pricingRule?: any, 
  shopDomain?: string,
  jobName?: string,
  jobRepo?: any,
  jobId?: string
) => {
  const results: Array<{
    variantId: string;
    success: boolean;
    oldPrice?: string;
    newPrice?: string;
    productTitle?: string;
    variantTitle?: string;
    inventory?: number;
    error?: string;
    reason?: string;
  }> = [];
  
  // Use default rule if none provided (maintains backward compatibility)
  const rule = pricingRule || {
    whenCondition: 'less_than_abs',
    whenValue: '20',
    thenAction: 'increase_price',
    thenMode: 'absolute',
    thenValue: '10',
    changeCompareAt: false,
  };

  // Initialize database services if shop domain provided
  let pricingJobRepo: PricingJobRepository | null = null;
  let auditLogger: AuditLogger | null = null;
  let pricingJobId: string | null = null;

  if (shopDomain) {
    try {
      pricingJobRepo = new PricingJobRepository(shopDomain);
      auditLogger = new AuditLogger(shopDomain);
      
      // Note: We DON'T create a Campaign for manual pricing jobs
      // Campaigns are only for automated rules, not one-time bulk operations
      // This helps separate manual jobs from automated campaigns in the dashboard
      
      console.log('🏪 DEBUG: Processing for shop domain:', shopDomain);
      console.log('📋 DEBUG: Manual pricing job - no campaign created (campaigns are for automation only)');
    } catch (dbError) {
      console.error('❌ DEBUG: Database initialization failed for shop:', shopDomain, 'Error:', dbError);
      console.error('Database initialization failed, continuing without audit logging:', dbError);
    }
  }

  // Helper function to evaluate WHEN condition
  const shouldApplyRule = (inventory: number): { apply: boolean; reason: string } => {
    const whenValue = parseFloat(rule.whenValue) || 0;
    
    switch (rule.whenCondition) {
      case 'less_than_abs':
        return {
          apply: inventory < whenValue,
          reason: inventory < whenValue 
            ? `Low inventory (${inventory} < ${whenValue})` 
            : `Inventory sufficient (${inventory} >= ${whenValue}) - no price change needed`
        };
      case 'more_than_abs':
        return {
          apply: inventory > whenValue,
          reason: inventory > whenValue 
            ? `High inventory (${inventory} > ${whenValue})` 
            : `Inventory not high enough (${inventory} <= ${whenValue}) - no price change needed`
        };
      case 'decreases_by_abs':
      case 'increases_by_abs':
      case 'decreases_by_percent':
      case 'increases_by_percent':
        // These would require historical inventory data - for now, assume always applies
        return {
          apply: true,
          reason: `Inventory change condition (${rule.whenCondition})`
        };
      default:
        return {
          apply: false,
          reason: `Unknown condition: ${rule.whenCondition}`
        };
    }
  };

  // Helper function to calculate new price based on THEN action
  const calculateNewPrice = (currentPrice: number): number => {
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
          // For percentage change, we interpret as setting price to X% of current
          return currentPrice * (thenValue / 100);
        }
      default:
        return currentPrice;
    }
  };
  
  try {
    const batchSize = 5;
    for (let i = 0; i < variantIds.length; i += batchSize) {
      const batch = variantIds.slice(i, i + batchSize);
      
      for (const variantId of batch) {
        try {
          // Get variant details including inventory
          const variantResponse = await admin.graphql(
            `#graphql
              query getVariantWithInventory($id: ID!) {
                productVariant(id: $id) {
                  id
                  price
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
              }`,
            {
              variables: {
                id: variantId,
              },
            },
          );
          
          const variantData = await variantResponse.json();
          const variant = variantData.data.productVariant;
          
          if (!variant) {
            results.push({
              variantId,
              success: false,
              error: "Variant not found",
            });
            continue;
          }
          
          // Get inventory using simple approach
          let totalInventory = 0;
          console.log(`Processing variant ${variantId}, variant data:`, JSON.stringify(variant, null, 2));
          
          // Check if inventory is tracked and get quantity
          const isInventoryTracked = variant.inventoryItem?.tracked !== false;
          
          if (isInventoryTracked && variant.inventoryQuantity !== null && variant.inventoryQuantity !== undefined) {
            totalInventory = variant.inventoryQuantity;
            console.log(`Using inventoryQuantity field: ${totalInventory}, tracked: ${isInventoryTracked}`);
          } else {
            console.log(`Inventory not tracked or not available for variant ${variantId}`);
            totalInventory = 0;
          }
          
          const currentPrice = parseFloat(variant.price);
          
          // Apply configurable inventory rules
          const hasInventoryTracking = isInventoryTracked && variant.inventoryQuantity !== null;
          
          if (!hasInventoryTracking) {
            // Skip variants with untracked inventory
            results.push({
              variantId,
              success: false,
              productTitle: variant.product.title,
              variantTitle: variant.title,
              inventory: totalInventory,
              reason: `Inventory not tracked - cannot apply rule`,
            });
            continue;
          }
          
          const ruleEvaluation = shouldApplyRule(totalInventory);
          console.log(`Applying inventory rule for ${variantId}: inventory=${totalInventory}, hasTracking=${hasInventoryTracking}, rule: ${ruleEvaluation.apply ? 'UPDATE' : 'SKIP'}`);
          
          if (ruleEvaluation.apply) {
            const newPrice = Math.max(0, calculateNewPrice(currentPrice)).toFixed(2);
            
            // Update the variant price
            const updateResponse = await admin.graphql(
              `#graphql
                mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                    productVariants {
                      id
                      price
                      title
                    }
                    userErrors {
                      field
                      message
                    }
                  }
                }`,
              {
                variables: {
                  productId: variant.product.id,
                  variants: [{
                    id: variantId,
                    price: newPrice,
                  }],
                },
              },
            );
            
            const updateData = await updateResponse.json();
            const updateResult = updateData.data.productVariantsBulkUpdate;
            
            if (updateResult.userErrors.length > 0) {
              results.push({
                variantId,
                success: false,
                error: updateResult.userErrors[0].message,
                productTitle: variant.product.title,
                variantTitle: variant.title,
                inventory: totalInventory,
              });
            } else {
              // Log successful price change to audit system
              console.log('✅ DEBUG: Price changed successfully for variant:', variantId);
              console.log('   Shop:', shopDomain, 'Manual Pricing Job');
              console.log('   Old Price:', currentPrice.toFixed(2), 'New Price:', newPrice);
              
              if (auditLogger) {
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
                    campaignId: undefined // Manual pricing jobs don't have campaigns
                  });
                  console.log('✅ DEBUG: Audit entry logged successfully');
                } catch (auditError) {
                  console.error('❌ DEBUG: Failed to log audit entry:', auditError);
                  console.error('Failed to log audit entry:', auditError);
                }
              } else {
                console.log('⚠️ DEBUG: Skipping audit log - auditLogger:', !!auditLogger, '(manual pricing job)');
              }

              results.push({
                variantId,
                success: true,
                oldPrice: currentPrice.toFixed(2),
                newPrice: newPrice,
                productTitle: variant.product.title,
                variantTitle: variant.title,
                inventory: totalInventory,
                reason: ruleEvaluation.reason,
              });
            }
          } else {
            // Skip this variant as it doesn't meet the inventory rule
            results.push({
              variantId,
              success: false,
              productTitle: variant.product.title,
              variantTitle: variant.title,
              inventory: totalInventory,
              reason: ruleEvaluation.reason,
            });
          }
        } catch (variantError) {
          console.error(`Error processing variant ${variantId}:`, variantError);
          results.push({
            variantId,
            success: false,
            error: variantError instanceof Error ? variantError.message : "Unknown error occurred",
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const skippedCount = results.filter(r => r.reason && !r.success).length;
    const failureCount = results.filter(r => !r.success && !r.reason).length;
    
    // Update PricingJob status when processing is complete
    if (jobRepo && jobId) {
      try {
        await jobRepo.updateStatus(jobId, successCount > 0 ? 'COMPLETED' : 'FAILED', {
          processedCount: results.length,
          successCount: successCount,
          errorCount: failureCount
        });
        console.log('✅ DEBUG: PricingJob status updated to', successCount > 0 ? 'COMPLETED' : 'FAILED');
        console.log('📊 DEBUG: Processing stats - Total:', results.length, 'Success:', successCount, 'Errors:', failureCount);
      } catch (error) {
        console.error('❌ DEBUG: Failed to update PricingJob status:', error);
      }
    }
    
    return {
      success: successCount > 0,
      totalProcessed: results.length,
      successCount,
      failureCount,
      skippedCount,
      results,
      actionType: "inventory_rules",
    };
  } catch (error) {
    console.error("Error in inventory rules processing:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      results,
      actionType: "inventory_rules",
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  
  const formData = await request.formData();
  const variantIds = formData.getAll("variantIds[]") as string[];
  const actionType = formData.get("action") as string;
  const jobName = formData.get("jobName") as string || 'Bulk Pricing Job';
  const pricingRuleJson = formData.get("pricingRule") as string;
  
  if (!variantIds || variantIds.length === 0) {
    return {
      success: false,
      error: "No variant IDs provided",
      results: [],
    };
  }
  
  const results: Array<{
    variantId: string;
    success: boolean;
    oldPrice?: string;
    newPrice?: string;
    productTitle?: string;
    variantTitle?: string;
    inventory?: number;
    error?: string;
    reason?: string;
  }> = [];
  
  if (actionType === "inventory_rules") {
    let pricingRule = null;
    if (pricingRuleJson) {
      try {
        pricingRule = JSON.parse(pricingRuleJson);
      } catch (error) {
        console.error("Error parsing pricing rule:", error);
      }
    }

    // Create PricingJob for tracking in dashboard
    let pricingJobRepo: PricingJobRepository | null = null;
    let pricingJobId: string | null = null;

    try {
      pricingJobRepo = new PricingJobRepository(session.shop);
      
      // First collect variant details to create proper selectedVariants
      const variantDetails = [];
      for (const variantId of variantIds) {
        try {
          const currentVariantResponse = await admin.graphql(
            `#graphql
              query getVariant($id: ID!) {
                productVariant(id: $id) {
                  id
                  price
                  title
                  inventoryQuantity
                  product {
                    id
                    title
                  }
                }
              }`,
            {
              variables: {
                id: variantId,
              },
            },
          );
          
          const currentVariantData = await currentVariantResponse.json();
          const currentVariant = currentVariantData.data.productVariant;
          
          if (currentVariant) {
            variantDetails.push({
              variantId: currentVariant.id,
              productId: currentVariant.product.id,
              productTitle: currentVariant.product.title,
              variantTitle: currentVariant.title,
              currentPrice: currentVariant.price,
              compareAtPrice: undefined, // Use undefined instead of null
              inventory: currentVariant.inventoryQuantity || 0
            });
          }
        } catch (error) {
          console.error(`Error fetching variant ${variantId}:`, error);
        }
      }

      const pricingJob = await pricingJobRepo.create({
        name: jobName || `Bulk Pricing - ${new Date().toISOString()}`,
        type: 'MANUAL',
        selectedVariants: variantDetails,
        rules: pricingRule ? [{
          description: `${pricingRule.whenCondition} ${pricingRule.whenValue} -> ${pricingRule.thenAction} ${pricingRule.thenValue}`,
          whenCondition: pricingRule.whenCondition,
          whenOperator: 'eq',
          whenValue: pricingRule.whenValue.toString(),
          thenAction: pricingRule.thenAction,
          thenMode: pricingRule.thenMode,
          thenValue: pricingRule.thenValue.toString(),
          changeCompareAt: pricingRule.changeCompareAt || false
        }] : []
      }, 'bulk-pricing-user');
      
      pricingJobId = pricingJob.id;
      console.log('📋 DEBUG: PricingJob created:', pricingJobId, 'for shop:', session.shop);
      console.log('📋 DEBUG: With', variantDetails.length, 'variants and', pricingRule ? 1 : 0, 'rules');
      
      // Update job status to RUNNING
      await pricingJobRepo.updateStatus(pricingJobId, 'RUNNING');
      
    } catch (error) {
      console.error('❌ DEBUG: Failed to create PricingJob:', error);
    }

    return await processInventoryRules(admin, variantIds, pricingRule, session.shop, jobName, pricingJobRepo, pricingJobId || undefined);
  }
  
  try {
    // Process variants in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < variantIds.length; i += batchSize) {
      const batch = variantIds.slice(i, i + batchSize);
      
      for (const variantId of batch) {
        try {
          // Get the current variant details
          const currentVariantResponse = await admin.graphql(
            `#graphql
              query getVariant($id: ID!) {
                productVariant(id: $id) {
                  id
                  price
                  title
                  product {
                    id
                    title
                  }
                }
              }`,
            {
              variables: {
                id: variantId,
              },
            },
          );
          
          const currentVariantData = await currentVariantResponse.json();
          const currentVariant = currentVariantData.data.productVariant;
          
          if (!currentVariant) {
            results.push({
              variantId,
              success: false,
              error: "Variant not found",
            });
            continue;
          }
          
          const currentPrice = parseFloat(currentVariant.price);
          const newPrice = (currentPrice + 10).toFixed(2);
          
          // Update the variant price
          const updateResponse = await admin.graphql(
            `#graphql
              mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
                productVariantsBulkUpdate(productId: $productId, variants: $variants) {
                  productVariants {
                    id
                    price
                    title
                  }
                  userErrors {
                    field
                    message
                  }
                }
              }`,
            {
              variables: {
                productId: currentVariant.product.id,
                variants: [{
                  id: variantId,
                  price: newPrice,
                }],
              },
            },
          );
          
          const updateData = await updateResponse.json();
          const updateResult = updateData.data.productVariantsBulkUpdate;
          
          if (updateResult.userErrors.length > 0) {
            results.push({
              variantId,
              success: false,
              error: updateResult.userErrors[0].message,
              productTitle: currentVariant.product.title,
              variantTitle: currentVariant.title,
            });
          } else {
            results.push({
              variantId,
              success: true,
              oldPrice: currentPrice.toFixed(2),
              newPrice: newPrice,
              productTitle: currentVariant.product.title,
              variantTitle: currentVariant.title,
            });
          }
        } catch (variantError) {
          console.error(`Error processing variant ${variantId}:`, variantError);
          results.push({
            variantId,
            success: false,
            error: variantError instanceof Error ? variantError.message : "Unknown error occurred",
          });
        }
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    return {
      success: successCount > 0,
      totalProcessed: results.length,
      successCount,
      failureCount,
      results,
    };
  } catch (error) {
    console.error("Error in bulk update:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      results,
    };
  }
};

interface SelectedVariant {
  id: string;
  title: string;
  productId: string;
  productTitle: string;
  price?: string;
}

interface PricingRule {
  whenCondition: 'decreases_by_percent' | 'increases_by_percent' | 'decreases_by_abs' | 'increases_by_abs' | 'less_than_abs' | 'more_than_abs';
  whenValue: string;
  thenAction: 'reduce_price' | 'increase_price' | 'change_price';
  thenMode: 'percentage' | 'absolute';
  thenValue: string;
  changeCompareAt: boolean;
}

export default function Admin() {
  const { shop, activeCampaigns } = useLoaderData<typeof loader>();
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const [pricingRule, setPricingRule] = useState<PricingRule>({
    whenCondition: 'less_than_abs',
    whenValue: '20',
    thenAction: 'increase_price',
    thenMode: 'absolute',
    thenValue: '10',
    changeCompareAt: false,
  });
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  
  const isLoading = 
    ["loading", "submitting"].includes(fetcher.state) && 
    fetcher.formMethod === "POST";

  // Dropdown options for rule configuration
  const whenConditionOptions = [
    { label: 'decreases by (%)', value: 'decreases_by_percent' },
    { label: 'increases by (%)', value: 'increases_by_percent' },
    { label: 'decreases by (Abs)', value: 'decreases_by_abs' },
    { label: 'increases by (Abs)', value: 'increases_by_abs' },
    { label: 'is Less than (Abs)', value: 'less_than_abs' },
    { label: 'is More than (Abs)', value: 'more_than_abs' },
  ];

  const thenActionOptions = [
    { label: 'Reduce Price', value: 'reduce_price' },
    { label: 'Increase Price', value: 'increase_price' },
    { label: 'Change Price', value: 'change_price' },
  ];

  const thenModeOptions = [
    { label: 'by Percentage (%)', value: 'percentage' },
    { label: 'by Absolute', value: 'absolute' },
  ];

  // Function to calculate preview price based on current rule
  const calculatePreviewPrice = (currentPrice: number, inventory: number): { updatedPrice: number; willUpdate: boolean } => {
    const whenValue = parseFloat(pricingRule.whenValue) || 0;
    const thenValue = parseFloat(pricingRule.thenValue) || 0;
    
    let willUpdate = false;
    
    // Check WHEN condition
    switch (pricingRule.whenCondition) {
      case 'less_than_abs':
        willUpdate = inventory < whenValue;
        break;
      case 'more_than_abs':
        willUpdate = inventory > whenValue;
        break;
      case 'decreases_by_abs':
      case 'increases_by_abs':
      case 'decreases_by_percent':
      case 'increases_by_percent':
        // These would require historical data - for preview, assume condition is met
        willUpdate = true;
        break;
      default:
        willUpdate = false;
    }

    if (!willUpdate) {
      return { updatedPrice: currentPrice, willUpdate: false };
    }

    // Apply THEN action
    let updatedPrice = currentPrice;
    
    switch (pricingRule.thenAction) {
      case 'increase_price':
        if (pricingRule.thenMode === 'percentage') {
          updatedPrice = currentPrice * (1 + thenValue / 100);
        } else {
          updatedPrice = currentPrice + thenValue;
        }
        break;
      case 'reduce_price':
        if (pricingRule.thenMode === 'percentage') {
          updatedPrice = currentPrice * (1 - thenValue / 100);
        } else {
          updatedPrice = currentPrice - thenValue;
        }
        break;
      case 'change_price':
        if (pricingRule.thenMode === 'absolute') {
          updatedPrice = thenValue;
        } else {
          // For percentage change, we interpret as setting price to X% of current
          updatedPrice = currentPrice * (thenValue / 100);
        }
        break;
    }

    return { updatedPrice: Math.max(0, updatedPrice), willUpdate: true };
  };
  
  // Reset current action when fetcher completes
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      setCurrentAction(null);
    }
  }, [fetcher.state, fetcher.data]);
  
  // Show toast notifications for job results
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && "results" in fetcher.data) {
      const data = fetcher.data as any;
      
      if (data.success && data.successCount > 0) {
        if (data.failureCount > 0) {
          // Partial success
          shopify.toast.show(
            `Pricing job completed: ${data.successCount} updated, ${data.failureCount} failed`,
            { isError: false }
          );
        } else {
          // Full success
          shopify.toast.show(
            `Pricing job completed successfully! Updated ${data.successCount} variants`,
            { isError: false }
          );
        }
      } else if (data.totalProcessed > 0 && data.successCount === 0) {
        // No variants met conditions
        const skippedCount = data.results?.filter((r: any) => r.reason && !r.success).length || 0;
        if (skippedCount > 0) {
          shopify.toast.show(
            `Pricing job completed: ${skippedCount} variants skipped (did not meet conditions)`,
            { isError: false }
          );
        } else {
          shopify.toast.show(
            "Pricing job completed with no changes",
            { isError: true }
          );
        }
      } else if (!data.success) {
        // Complete failure
        shopify.toast.show(
          `Pricing job failed: ${data.error || "Unknown error"}`,
          { isError: true }
        );
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);
  
  const pickResources = async () => {
    try {
      const selection = await shopify.resourcePicker({
        type: "product",
        multiple: true,
      });
      
      if (selection && selection.length > 0) {
        const variants: SelectedVariant[] = [];
        
        for (const item of selection as any[]) {
          // Check if this is a full product selection or specific variant selection
          if (item.variants && Array.isArray(item.variants)) {
            // This is a product with its variants - user selected the whole product
            // Include all variants from this product
            for (const variant of item.variants) {
              variants.push({
                id: variant.id,
                title: variant.title || "Default Title",
                productId: item.id,
                productTitle: item.title,
                price: variant.price,
              });
            }
          } else if (item.id && item.id.includes("ProductVariant")) {
            // This is a specific variant selection
            variants.push({
              id: item.id,
              title: item.title || "Default Title",
              productId: item.product?.id || item.productId || "",
              productTitle: item.product?.title || item.productTitle || "Unknown Product",
              price: item.price,
            });
          } else if (item.id && item.id.includes("Product")) {
            // This is a product selection but without variant data loaded
            // We need to handle this case - for now, show a message
            shopify.toast.show("Product selected without variant data. Please try selecting again.", { isError: true });
            continue;
          }
        }
        
        // Remove duplicates based on variant ID
        const uniqueVariants = variants.filter((variant, index, self) => 
          index === self.findIndex(v => v.id === variant.id)
        );
        
        setSelectedVariants(uniqueVariants);
        
        if (uniqueVariants.length === 0) {
          shopify.toast.show("No variants found in selected items", { isError: true });
        } else {
          const productCount = new Set(uniqueVariants.map(v => v.productId)).size;
          shopify.toast.show(
            `Selected ${uniqueVariants.length} variant${uniqueVariants.length === 1 ? '' : 's'} from ${productCount} product${productCount === 1 ? '' : 's'}`
          );
        }
      }
    } catch (error) {
      console.error("Error picking resources:", error);
      shopify.toast.show("Error selecting resources", { isError: true });
    }
  };
  
  const increasePrices = () => {
    if (selectedVariants.length > 0) {
      setCurrentAction("bulk_update");
      const formData = new FormData();
      selectedVariants.forEach(variant => {
        formData.append("variantIds[]", variant.id);
      });
      formData.append("jobName", jobName);
      fetcher.submit(formData, { method: "POST" });
    }
  };
  
  const applyInventoryRules = () => {
    if (selectedVariants.length > 0) {
      setCurrentAction("inventory_rules");
      const formData = new FormData();
      selectedVariants.forEach(variant => {
        formData.append("variantIds[]", variant.id);
      });
      formData.append("action", "inventory_rules");
      formData.append("jobName", jobName);
      formData.append("pricingRule", JSON.stringify(pricingRule));
      fetcher.submit(formData, { method: "POST" });
    }
  };
  
  const clearSelection = () => {
    setSelectedVariants([]);
  };
  
  
  // Prepare table rows for selected variants
  const resourceName = {
    singular: "variant",
    plural: "variants",
  };
  
  const rowMarkup = selectedVariants.map((variant, index) => (
    <IndexTable.Row id={variant.id} key={variant.id} position={index}>
      <IndexTable.Cell>
        <Text variant="bodyMd" fontWeight="semibold" as="span">
          {variant.productTitle}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {variant.title}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span">
          {variant.price ? `$${variant.price}` : "N/A"}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text variant="bodyMd" as="span" tone="subdued">
          {variant.id.replace("gid://shopify/ProductVariant/", "")}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));
  
  return (
    <Page>
      <TitleBar title="Create Pricing Job" />
      <BlockStack gap="500">
        
        {/* Active Campaigns Section */}
        {activeCampaigns.length > 0 && (
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Active Campaigns ({activeCampaigns.length})
                  </Text>
                  {activeCampaigns.map((campaign) => (
                    <Card key={campaign.id}>
                      <BlockStack gap="200">
                        <InlineStack gap="300" align="space-between">
                          <Text variant="headingSm" as="h3">
                            {campaign.name}
                          </Text>
                          <Badge tone="success">
                            {campaign.status}
                          </Badge>
                        </InlineStack>
                        {campaign.description && (
                          <Text variant="bodyMd" as="p" tone="subdued">
                            {campaign.description}
                          </Text>
                        )}
                        <InlineStack gap="200">
                          <Text variant="bodySm" as="span" tone="subdued">
                            Triggered: {campaign.triggerCount} times
                          </Text>
                          {campaign.lastTriggered && (
                            <Text variant="bodySm" as="span" tone="subdued">
                              Last: {new Date(campaign.lastTriggered).toLocaleDateString()}
                            </Text>
                          )}
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  ))}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Job Configuration</Text>
                <TextField
                  label="Job Name"
                  value={jobName}
                  onChange={setJobName}
                  placeholder="Enter a descriptive name for this pricing job"
                  helpText="This name will help you identify this job in the dashboard"
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Step 1 - Select Products & Variants
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Select products or individual variants within products. You can either apply a simple $10 increase to all prices, 
                    or use the configurable rules below to apply conditional pricing based on inventory levels.
                    You can select entire products (all variants) or choose specific variants within products.
                  </Text>
                </BlockStack>
                
                <InlineStack gap="300" align="start">
                  <Button onClick={pickResources}>
                    Select Products & Variants
                  </Button>
                  
                  {selectedVariants.length > 0 && (
                    <>
                      <Button 
                        variant="primary"
                        loading={isLoading && currentAction === "bulk_update"}
                        onClick={increasePrices}
                      >
                        Increase Prices by $10 ({selectedVariants.length.toString()} variants)
                      </Button>
                      
                      <Button 
                        variant="secondary"
                        loading={isLoading && currentAction === "inventory_rules"}
                        onClick={applyInventoryRules}
                      >
                        Apply Configured Rules ({selectedVariants.length.toString()} variants)
                      </Button>
                      
                      <Button onClick={clearSelection}>
                        Clear Selection
                      </Button>
                    </>
                  )}
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Step 2 - Configure Pricing Rules
                  </Text>
                  <Text variant="bodyMd" as="p">
                    Set up conditional pricing rules based on inventory levels and other criteria.
                  </Text>
                </BlockStack>
                
                <BlockStack gap="400">
                  {/* WHEN Section */}
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      WHEN: Inventory
                    </Text>
                    <InlineStack gap="300" align="start">
                      <div style={{ minWidth: '200px' }}>
                        <Select
                          label="Condition type"
                          options={whenConditionOptions}
                          value={pricingRule.whenCondition}
                          onChange={(value) => setPricingRule(prev => ({ ...prev, whenCondition: value as PricingRule['whenCondition'] }))}
                        />
                      </div>
                      <div style={{ minWidth: '100px' }}>
                        <TextField
                          label="Value"
                          type="number"
                          value={pricingRule.whenValue}
                          onChange={(value) => setPricingRule(prev => ({ ...prev, whenValue: value }))}
                          autoComplete="off"
                        />
                      </div>
                    </InlineStack>
                  </BlockStack>
                  
                  {/* THEN Section */}
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingSm">
                      THEN: Price Action
                    </Text>
                    <InlineStack gap="300" align="start">
                      <div style={{ minWidth: '150px' }}>
                        <Select
                          label="Action"
                          options={thenActionOptions}
                          value={pricingRule.thenAction}
                          onChange={(value) => setPricingRule(prev => ({ ...prev, thenAction: value as PricingRule['thenAction'] }))}
                        />
                      </div>
                      <div style={{ minWidth: '150px' }}>
                        <Select
                          label="Mode"
                          options={thenModeOptions}
                          value={pricingRule.thenMode}
                          onChange={(value) => setPricingRule(prev => ({ ...prev, thenMode: value as PricingRule['thenMode'] }))}
                        />
                      </div>
                      <div style={{ minWidth: '100px' }}>
                        <TextField
                          label="Value"
                          type="number"
                          value={pricingRule.thenValue}
                          onChange={(value) => setPricingRule(prev => ({ ...prev, thenValue: value }))}
                          autoComplete="off"
                        />
                      </div>
                    </InlineStack>
                  </BlockStack>
                  
                  {/* Optional Settings */}
                  <Checkbox
                    label="Do you want to change compare-at also?"
                    checked={pricingRule.changeCompareAt}
                    onChange={(checked) => setPricingRule(prev => ({ ...prev, changeCompareAt: checked }))}
                  />
                  
                  {/* Example Variant Preview */}
                  <Card>
                    <BlockStack gap="300">
                      <Text as="h4" variant="headingSm">
                        Example Variant Preview
                      </Text>
                      {(() => {
                        const examplePrice = 25.00;
                        const exampleInventory = 15;
                        const { updatedPrice, willUpdate } = calculatePreviewPrice(examplePrice, exampleInventory);
                        
                        return (
                          <BlockStack gap="200">
                            <Text variant="bodyMd" as="p">
                              <strong>Current price:</strong> ${examplePrice.toFixed(2)}
                            </Text>
                            <Text variant="bodyMd" as="p">
                              <strong>Inventory level:</strong> {exampleInventory} units
                            </Text>
                            <Text 
                              variant="bodyMd" 
                              as="p" 
                              tone={willUpdate ? "success" : "subdued"}
                            >
                              <strong>Updated price:</strong> ${updatedPrice.toFixed(2)}
                              {willUpdate ? " (Rule will apply)" : " (Rule will NOT apply)"}
                            </Text>
                          </BlockStack>
                        );
                      })()}
                    </BlockStack>
                  </Card>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          {selectedVariants.length > 0 && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      Selected Variants ({selectedVariants.length})
                    </Text>
                    <Text variant="bodyMd" as="p" tone="subdued">
                      {(() => {
                        const productCount = new Set(selectedVariants.map(v => v.productId)).size;
                        return `From ${productCount} product${productCount === 1 ? '' : 's'}`;
                      })()}
                    </Text>
                  </BlockStack>
                  
                  <IndexTable
                    resourceName={resourceName}
                    itemCount={selectedVariants.length}
                    headings={[
                      { title: "Product" },
                      { title: "Variant" },
                      { title: "Current Price" },
                      { title: "Variant ID" },
                    ]}
                    selectable={false}
                  >
                    {rowMarkup}
                  </IndexTable>
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
          
          {selectedVariants.length === 0 && (
            <Layout.Section>
              <Card>
                <EmptyState
                  heading="No variants selected"
                  image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                >
                  <Text variant="bodyMd" as="p">
                    Use the resource picker above to select products and their variants for bulk price updates.
                    You can select entire products or individual variants within products.
                  </Text>
                </EmptyState>
              </Card>
            </Layout.Section>
          )}
          
          {/* Results Banners */}
          {fetcher.data && "results" in fetcher.data && (
            <Layout.Section>
              <BlockStack gap="400">
                {fetcher.data.success && "successCount" in fetcher.data && fetcher.data.successCount > 0 && (
                  <Banner title={
                    (fetcher.data as any).actionType === "inventory_rules" 
                      ? "Inventory Rules Results" 
                      : "Bulk Update Results"
                  } tone="success">
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p">
                        Successfully updated {fetcher.data.successCount} of {"totalProcessed" in fetcher.data ? fetcher.data.totalProcessed : 0} variants.
                      </Text>
                      {(fetcher.data as any).actionType === "inventory_rules" && "skippedCount" in fetcher.data && (fetcher.data as any).skippedCount > 0 && (
                        <Text variant="bodyMd" as="p">
                          {(fetcher.data as any).skippedCount} variants were skipped (inventory ≥ 20 or not tracked).
                        </Text>
                      )}
                      {"failureCount" in fetcher.data && fetcher.data.failureCount > 0 && (
                        <Text variant="bodyMd" as="p">
                          {fetcher.data.failureCount} variants failed to update.
                        </Text>
                      )}
                    </BlockStack>
                  </Banner>
                )}
                
                {"failureCount" in fetcher.data && fetcher.data.failureCount > 0 && (
                  <Banner title="Update Errors" tone="warning">
                    <BlockStack gap="200">
                      {fetcher.data.results
                        .filter((result: any) => !result.success && !result.reason) // Only show actual errors, not skipped variants
                        .slice(0, 3) // Show only first 3 errors to avoid overwhelming UI
                        .map((result: any, index: number) => (
                          <Text key={index} variant="bodyMd" as="p">
                            Variant {result.variantId.replace("gid://shopify/ProductVariant/", "")}: {result.error}
                          </Text>
                        ))}
                      {fetcher.data.results.filter((result: any) => !result.success && !result.reason).length > 3 && (
                        <Text variant="bodyMd" as="p" tone="subdued">
                          ... and {fetcher.data.results.filter((result: any) => !result.success && !result.reason).length - 3} more errors
                        </Text>
                      )}
                    </BlockStack>
                  </Banner>
                )}
                
                {fetcher.data.success && (
                  <Card>
                    <BlockStack gap="400">
                      <Text as="h3" variant="headingMd">
                        Detailed Results
                      </Text>
                      
                      <IndexTable
                        resourceName={{ singular: "result", plural: "results" }}
                        itemCount={fetcher.data.results.length}
                        headings={
                          (fetcher.data as any).actionType === "inventory_rules" 
                            ? [
                                { title: "Product" },
                                { title: "Variant" },
                                { title: "Inventory" },
                                { title: "Status" },
                                { title: "Price Change / Reason" },
                              ]
                            : [
                                { title: "Product" },
                                { title: "Variant" },
                                { title: "Status" },
                                { title: "Price Change" },
                              ]
                        }
                        selectable={false}
                      >
                        {fetcher.data.results.map((result: any, index: number) => (
                          <IndexTable.Row id={result.variantId} key={result.variantId} position={index}>
                            <IndexTable.Cell>
                              <Text variant="bodyMd" as="span">
                                {result.productTitle || "Unknown"}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text variant="bodyMd" as="span">
                                {result.variantTitle || "Unknown"}
                              </Text>
                            </IndexTable.Cell>
                            {(fetcher.data as any).actionType === "inventory_rules" && (
                              <IndexTable.Cell>
                                <Text variant="bodyMd" as="span">
                                  {result.inventory !== undefined ? result.inventory.toString() : "N/A"}
                                </Text>
                              </IndexTable.Cell>
                            )}
                            <IndexTable.Cell>
                              <Badge tone={
                                result.success 
                                  ? "success" 
                                  : result.reason 
                                    ? "attention" 
                                    : "critical"
                              }>
                                {result.success ? "Updated" : result.reason ? "Skipped" : "Failed"}
                              </Badge>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              {result.success && result.oldPrice && result.newPrice ? (
                                <Text variant="bodyMd" as="span">
                                  ${result.oldPrice} → ${result.newPrice}
                                </Text>
                              ) : result.reason ? (
                                <Text variant="bodyMd" as="span" tone="subdued">
                                  {result.reason}
                                </Text>
                              ) : (
                                <Text variant="bodyMd" as="span" tone="subdued">
                                  {result.error || "N/A"}
                                </Text>
                              )}
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        ))}
                      </IndexTable>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>
            </Layout.Section>
          )}
          
          {fetcher.data?.success === false && "error" in fetcher.data && !("results" in fetcher.data) && (
            <Layout.Section>
              <Banner title="Error" tone="critical">
                <Text variant="bodyMd" as="p">
                  Bulk update failed: {(fetcher.data as any).error}
                </Text>
              </Banner>
            </Layout.Section>
          )}
        </Layout>
      </BlockStack>
    </Page>
  );
}