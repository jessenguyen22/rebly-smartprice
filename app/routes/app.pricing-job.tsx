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
  Toast,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { CampaignRepository } from "../models/campaign.server";
import { PricingJobRepository } from "../models/pricing-job.server";
import { AuditLogger } from "../services/audit-logger.server";
import { GraphQLOptimizationService } from "../services/graphql-optimization.server";
import { ErrorHandlingService, ErrorType } from "../services/error-handling.server";
import { 
  getPricingJobTemplates, 
  createPricingJobTemplate, 
  getPricingJobTemplate,
  type PricingJobTemplate, 
  type PricingRule as TemplatePricingRule 
} from "../models/pricing-job-template.server";
import { EnhancedResultsTable } from "../components/pricing-job/EnhancedResultsTable";
import type { ExportResult } from "../components/pricing-job/EnhancedResultsTable";
import { CampaignIntegrationHint } from "../components/pricing-job/CampaignIntegrationHint";
import { TemplateSelector } from "../components/pricing-job/TemplateSelector";
import { initializeCampaignProcessing } from "../services/campaign-session-integration.server";
import { json } from "@remix-run/node";

export const loader = async (args: LoaderFunctionArgs) => {
  // Initialize campaign processing with admin client registration
  const { session, admin } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader(args);
  const errorHandler = ErrorHandlingService.getInstance();
  
  try {
    const campaignRepo = new CampaignRepository(session.shop);
    const pricingJobRepo = new PricingJobRepository(session.shop);
    
    // Parallel data loading with performance optimization
    const [activeCampaigns, templates, performanceMetrics, recentJobs] = await Promise.all([
      campaignRepo.findByStatus('ACTIVE').catch(error => {
        errorHandler.handleDatabaseError(error, 'load_campaigns', { shop: session.shop });
        return [];
      }),
      getPricingJobTemplates(session.shop).catch(error => {
        errorHandler.handleTemplateError(error, 'load_templates', { shop: session.shop });
        return [];
      }),
      pricingJobRepo.getShopPerformanceSummary(7).catch(error => {
        errorHandler.handleDatabaseError(error, 'load_performance_metrics', { shop: session.shop });
        return null;
      }),
      pricingJobRepo.findRecentJobs(5).catch(error => {
        errorHandler.handleDatabaseError(error, 'load_recent_jobs', { shop: session.shop });
        return [];
      })
    ]);
    
    return json({ 
      shop: session.shop,
      activeCampaigns,
      templates,
      performanceMetrics,
      recentJobs,
      errorStatistics: errorHandler.getErrorStatistics(1) // Last 1 hour
    });
  } catch (error) {
    const errorDetails = errorHandler.handleDatabaseError(error, 'loader', { shop: session.shop });
    
    // Return minimal data on error
    return json({ 
      shop: session.shop,
      activeCampaigns: [],
      templates: [],
      performanceMetrics: null,
      recentJobs: [],
      errorStatistics: errorHandler.getErrorStatistics(1),
      loaderError: errorDetails
    });
  }
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

export const action = async (args: ActionFunctionArgs) => {
  // Initialize campaign processing with admin client registration
  const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromAction(args);
  const errorHandler = ErrorHandlingService.getInstance();
  const graphqlOptimizer = new GraphQLOptimizationService(admin.graphql);
  
  const formData = await args.request.formData();
  const actionType = formData.get("action") as string;
  
  try {
    // Handle template operations
    if (actionType === "save_template") {
    const templateName = formData.get("templateName") as string;
    const templateDescription = formData.get("templateDescription") as string;
    const rulesJson = formData.get("rules") as string;
    const bulkAmount = formData.get("bulkAmount") as string;
    const bulkType = formData.get("bulkType") as string;
    
    if (!templateName?.trim()) {
      return json({
        success: false,
        error: "Template name is required",
      }, { status: 400 });
    }
    
    try {
      let rules: TemplatePricingRule[] | undefined;
      if (rulesJson) {
        rules = JSON.parse(rulesJson);
      }
      
      const template = await createPricingJobTemplate({
        name: templateName.trim(),
        description: templateDescription?.trim() || undefined,
        rules,
        bulkAmount: bulkAmount || undefined,
        bulkType: (bulkType as 'increase' | 'decrease') || undefined,
        userId: undefined, // For shop-wide templates
        shopDomain: session.shop,
      });
      
      return json({
        success: true,
        template,
      });
    } catch (error) {
      console.error("Error saving template:", error);
      return json({
        success: false,
        error: "Failed to save template",
      }, { status: 500 });
    }
  }
  
  // Handle template loading
  if (actionType === "load_template") {
    const templateId = formData.get("templateId") as string;
    
    if (!templateId) {
      return json({
        success: false,
        error: "Template ID is required",
      }, { status: 400 });
    }
    
    try {
      const template = await getPricingJobTemplate(templateId, session.shop);
      
      if (!template) {
        return json({
          success: false,
          error: "Template not found",
        }, { status: 404 });
      }
      
      return json({
        success: true,
        template,
      });
    } catch (error) {
      console.error("Error loading template:", error);
      return json({
        success: false,
        error: "Failed to load template",
      }, { status: 500 });
    }
  }
  
  const variantIds = formData.getAll("variantIds[]") as string[];
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
} catch (actionError) {
  // Global action error handler
  const errorDetails = errorHandler.handleProcessingError(actionError, 'action', actionType);
  return json({
    success: false,
    error: errorDetails.message,
    errorType: errorDetails.type,
    recoverable: errorDetails.recoverable
  });
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

export default function CreatePricingJob() {
  const { shop, activeCampaigns, templates } = useLoaderData<typeof loader>();
  const [selectedVariants, setSelectedVariants] = useState<SelectedVariant[]>([]);
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [jobName, setJobName] = useState<string>('');
  const [showRuleConfig, setShowRuleConfig] = useState<boolean>(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [exportError, setExportError] = useState<boolean>(false);
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

  // Export functionality
  const handleExport = async (format: 'csv' | 'pdf') => {
    if (!fetcher.data || !(fetcher.data as any).results) {
      return Promise.reject(new Error('No results to export'));
    }

    const data = fetcher.data as any;
    const exportData = {
      jobName: jobName || 'Unnamed Pricing Job',
      actionType: data.actionType || 'pricing_update',
      totalProcessed: data.totalProcessed || data.results.length,
      successCount: data.successCount || data.results.filter((r: any) => r.success).length,
      failureCount: data.failureCount || data.results.filter((r: any) => !r.success && !r.reason).length,
      skippedCount: data.skippedCount || data.results.filter((r: any) => r.reason && !r.success).length,
      results: data.results,
      createdAt: new Date(),
      shopDomain: shop
    };

    const formData = new FormData();
    formData.append('format', format);
    formData.append('jobData', JSON.stringify(exportData));

    const response = await fetch('/api/export', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error('Export generation failed');
    }

    return await response.json();
  };

  // Handle export messages
  const handleExportMessage = (message: string, isError: boolean = false) => {
    setExportMessage(message);
    setExportError(isError);
  };

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

  // Template handling functions
  const handleTemplateSelect = async (templateId: string | undefined) => {
    setSelectedTemplateId(templateId);
    
    if (!templateId) {
      return;
    }

    // Load template data
    const formData = new FormData();
    formData.append("action", "load_template");
    formData.append("templateId", templateId);
    
    fetcher.submit(formData, { method: "post" });
  };

  const handleTemplateSave = async (templateData: { name: string; description?: string }) => {
    const formData = new FormData();
    formData.append("action", "save_template");
    formData.append("templateName", templateData.name);
    if (templateData.description) {
      formData.append("templateDescription", templateData.description);
    }
    
    // Convert current pricing rule to template format
    const templateRules: TemplatePricingRule[] = [{
      whenCondition: pricingRule.whenCondition === 'less_than_abs' ? 'less_than' : 
                     pricingRule.whenCondition === 'more_than_abs' ? 'greater_than' : 'equal_to',
      whenValue: pricingRule.whenValue,
      thenAction: pricingRule.thenAction === 'increase_price' ? 'increase' : 
                  pricingRule.thenAction === 'reduce_price' ? 'decrease' : 'set_to',
      thenMode: pricingRule.thenMode === 'percentage' ? 'percentage' : 'fixed',
      thenValue: pricingRule.thenValue,
      changeCompareAt: pricingRule.changeCompareAt,
    }];
    
    formData.append("rules", JSON.stringify(templateRules));
    
    fetcher.submit(formData, { method: "post" });
  };

  // Handle template loading result
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && "template" in fetcher.data) {
      const data = fetcher.data as any;
      
      if (data.success && data.template) {
        const template = data.template as PricingJobTemplate;
        
        // Update job name if template name exists
        if (template.name) {
          setJobName(template.name);
        }
        
        // Load template rules if they exist
        if (template.rules && template.rules.length > 0) {
          const rule = template.rules[0];
          setPricingRule({
            whenCondition: rule.whenCondition === 'less_than' ? 'less_than_abs' :
                           rule.whenCondition === 'greater_than' ? 'more_than_abs' : 'less_than_abs',
            whenValue: rule.whenValue,
            thenAction: rule.thenAction === 'increase' ? 'increase_price' :
                        rule.thenAction === 'decrease' ? 'reduce_price' : 'change_price',
            thenMode: rule.thenMode === 'percentage' ? 'percentage' : 'absolute',
            thenValue: rule.thenValue,
            changeCompareAt: rule.changeCompareAt,
          });
          setShowRuleConfig(true);
        }
        
        shopify.toast.show(`Template "${template.name}" loaded successfully`, { isError: false });
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
      
      <BlockStack gap="600">
        {/* Job Configuration Card */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">Job Configuration</Text>
                  <Badge tone="info">Step 1 of 4</Badge>
                </InlineStack>
                <TextField
                  label="Job Name"
                  value={jobName}
                  onChange={setJobName}
                  placeholder="e.g., Black Friday Prep Job, Winter Inventory Adjustment"
                  helpText="Give your pricing job a memorable name to easily find it later"
                  autoComplete="off"
                  requiredIndicator
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Template Selector */}
        <Layout>
          <Layout.Section>
            <TemplateSelector
              templates={templates as unknown as PricingJobTemplate[]}
              selectedTemplateId={selectedTemplateId}
              onTemplateSelect={handleTemplateSelect}
              onTemplateSave={handleTemplateSave}
              currentRules={showRuleConfig ? [{
                whenCondition: pricingRule.whenCondition === 'less_than_abs' ? 'less_than' : 
                               pricingRule.whenCondition === 'more_than_abs' ? 'greater_than' : 'equal_to',
                whenValue: pricingRule.whenValue,
                thenAction: pricingRule.thenAction === 'increase_price' ? 'increase' : 
                            pricingRule.thenAction === 'reduce_price' ? 'decrease' : 'set_to',
                thenMode: pricingRule.thenMode === 'percentage' ? 'percentage' : 'fixed',
                thenValue: pricingRule.thenValue,
                changeCompareAt: pricingRule.changeCompareAt,
              }] : undefined}
              jobName={jobName}
            />
          </Layout.Section>
        </Layout>

        {/* Product Selection Card */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingLg">Product Selection</Text>
                    <Badge tone="info">Step 2 of 4</Badge>
                  </BlockStack>
                  <Button onClick={pickResources} variant="primary">
                    Select Products & Variants
                  </Button>
                </InlineStack>
                
                <Text variant="bodyMd" as="p">
                  Choose products or specific variants to apply pricing changes. You can select entire products 
                  (all variants) or individual variants within products.
                </Text>
                
                {selectedVariants.length === 0 ? (
                  <EmptyState
                    heading="No products selected"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <Text variant="bodyMd" as="p">
                      Click "Select Products & Variants" above to choose which products you want to update.
                    </Text>
                  </EmptyState>
                ) : (
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="400">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingMd">
                          Selected Items ({selectedVariants.length} variants)
                        </Text>
                        <Button onClick={clearSelection} variant="tertiary">
                          Clear Selection
                        </Button>
                      </InlineStack>
                      
                      <Text variant="bodyMd" as="p" tone="subdued">
                        {(() => {
                          const productCount = new Set(selectedVariants.map(v => v.productId)).size;
                          return `From ${productCount} product${productCount === 1 ? '' : 's'}`;
                        })()}
                      </Text>
                      
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
                        condensed
                      >
                        {rowMarkup}
                      </IndexTable>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Pricing Rules Configuration Card */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <BlockStack gap="200">
                    <Text as="h2" variant="headingLg">Pricing Method</Text>
                    <Badge tone="info">Step 3 of 4</Badge>
                  </BlockStack>
                  <Button 
                    onClick={() => setShowRuleConfig(!showRuleConfig)}
                    variant={showRuleConfig ? "primary" : "secondary"}
                    disclosure={showRuleConfig ? "up" : "down"}
                  >
                    {showRuleConfig ? "Hide" : "Configure"} Advanced Rules
                  </Button>
                </InlineStack>
                
                {selectedVariants.length > 0 && (
                  <InlineStack gap="300" align="start">
                    <Button 
                      variant="primary"
                      size="large"
                      loading={isLoading && currentAction === "bulk_update"}
                      onClick={increasePrices}
                      disabled={!jobName.trim()}
                    >
                      Quick Price Increase (+$10)
                    </Button>
                    
                    <Button 
                      variant="secondary"
                      size="large"
                      loading={isLoading && currentAction === "inventory_rules"}
                      onClick={applyInventoryRules}
                      disabled={!jobName.trim()}
                    >
                      Apply Custom Rules
                    </Button>
                  </InlineStack>
                )}
                
                {!jobName.trim() && selectedVariants.length > 0 && (
                  <Banner tone="info">
                    <Text variant="bodyMd" as="p">
                      Please enter a job name before running pricing updates.
                    </Text>
                  </Banner>
                )}

                {showRuleConfig && (
                  <Card background="bg-surface-secondary">
                    <BlockStack gap="500">
                      <Text as="h3" variant="headingMd">
                        Advanced Pricing Rules Configuration
                      </Text>
                      
                      <BlockStack gap="400">
                        {/* WHEN Section */}
                        <BlockStack gap="300">
                          <Text as="h4" variant="headingSm">
                            WHEN: Inventory Condition
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
                          <Text as="h4" variant="headingSm">
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
                          label="Also update compare-at price"
                          checked={pricingRule.changeCompareAt}
                          onChange={(checked) => setPricingRule(prev => ({ ...prev, changeCompareAt: checked }))}
                        />
                        
                        {/* Example Variant Preview */}
                        <Card>
                          <BlockStack gap="300">
                            <Text as="h5" variant="headingSm">
                              Rule Preview Example
                            </Text>
                            {(() => {
                              const examplePrice = 25.00;
                              const exampleInventory = 15;
                              const { updatedPrice, willUpdate } = calculatePreviewPrice(examplePrice, exampleInventory);
                              
                              return (
                                <BlockStack gap="200">
                                  <InlineStack gap="300">
                                    <Text variant="bodyMd" as="p">
                                      <strong>Current price:</strong> ${examplePrice.toFixed(2)}
                                    </Text>
                                    <Text variant="bodyMd" as="p">
                                      <strong>Inventory:</strong> {exampleInventory} units
                                    </Text>
                                  </InlineStack>
                                  <Text 
                                    variant="bodyMd" 
                                    as="p" 
                                    tone={willUpdate ? "success" : "subdued"}
                                  >
                                    <strong>Result:</strong> ${updatedPrice.toFixed(2)}
                                    <Badge tone={willUpdate ? "success" : "info"} size="small">
                                      {willUpdate ? "Rule applies" : "Rule skipped"}
                                    </Badge>
                                  </Text>
                                </BlockStack>
                              );
                            })()}
                          </BlockStack>
                        </Card>
                      </BlockStack>
                    </BlockStack>
                  </Card>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Active Campaigns Info (Moved to sidebar-style) */}
        {activeCampaigns.length > 0 && (
          <Layout>
            <Layout.Section variant="oneThird">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Active Campaigns ({activeCampaigns.length})
                  </Text>
                  <Text variant="bodyMd" as="p" tone="subdued">
                    These campaigns are currently running automated pricing rules.
                  </Text>
                  {activeCampaigns.slice(0, 3).map((campaign) => campaign && (
                    <Card key={campaign.id} background="bg-surface-secondary">
                      <BlockStack gap="200">
                        <InlineStack gap="300" align="space-between">
                          <Text variant="headingSm" as="h3">
                            {campaign.name}
                          </Text>
                          <Badge tone="success" size="small">
                            {campaign.status}
                          </Badge>
                        </InlineStack>
                        <InlineStack gap="200">
                          <Text variant="bodySm" as="span" tone="subdued">
                            {campaign.triggerCount} triggers
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
                  {activeCampaigns.length > 3 && (
                    <Text variant="bodyMd" as="p" tone="subdued">
                      ... and {activeCampaigns.length - 3} more campaigns
                    </Text>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        )}

        {/* Results Section */}
        {fetcher.data && "results" in fetcher.data && (
          <Layout>
            <Layout.Section>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">Execution Results</Text>
                  <Badge tone="info">Step 4 of 4</Badge>
                </InlineStack>

                {fetcher.data.success && "successCount" in fetcher.data && fetcher.data.successCount > 0 && (
                  <Banner title={
                    (fetcher.data as any).actionType === "inventory_rules" 
                      ? "Inventory Rules Applied Successfully" 
                      : "Bulk Update Completed Successfully"
                  } tone="success">
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p">
                        Successfully updated {fetcher.data.successCount} of {"totalProcessed" in fetcher.data ? fetcher.data.totalProcessed : 0} variants.
                      </Text>
                      {(fetcher.data as any).actionType === "inventory_rules" && "skippedCount" in fetcher.data && (fetcher.data as any).skippedCount > 0 && (
                        <Text variant="bodyMd" as="p">
                          {(fetcher.data as any).skippedCount} variants were skipped (conditions not met).
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
                  <Banner title="Some Updates Failed" tone="warning">
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
                  <EnhancedResultsTable
                    jobName={jobName || 'Unnamed Pricing Job'}
                    actionType={(fetcher.data as any).actionType || 'pricing_update'}
                    totalProcessed={(fetcher.data as any).totalProcessed || (fetcher.data as any).results?.length || 0}
                    successCount={(fetcher.data as any).successCount || (fetcher.data as any).results?.filter((r: any) => r.success).length || 0}
                    failureCount={(fetcher.data as any).failureCount || (fetcher.data as any).results?.filter((r: any) => !r.success && !r.reason).length || 0}
                    skippedCount={(fetcher.data as any).skippedCount || (fetcher.data as any).results?.filter((r: any) => r.reason && !r.success).length || 0}
                    results={(fetcher.data as any).results || []}
                    shopDomain={shop}
                    onExport={handleExport}
                    onMessage={handleExportMessage}
                  />
                )}

                {fetcher.data.success && (fetcher.data as any).successCount > 0 && (
                  <CampaignIntegrationHint
                    jobName={jobName || 'Unnamed Pricing Job'}
                    rules={currentAction === 'inventory_rules' ? [pricingRule] : undefined}
                    bulkAmount={undefined}
                    bulkType={undefined}
                    successCount={(fetcher.data as any).successCount || 0}
                    totalProcessed={(fetcher.data as any).totalProcessed || 0}
                  />
                )}
              </BlockStack>
            </Layout.Section>
          </Layout>
        )}
        
        {fetcher.data?.success === false && "error" in fetcher.data && !("results" in fetcher.data) && (
          <Layout>
            <Layout.Section>
              <Banner title="Job Failed" tone="critical">
                <Text variant="bodyMd" as="p">
                  Bulk update failed: {(fetcher.data as any).error}
                </Text>
              </Banner>
            </Layout.Section>
          </Layout>
        )}
      </BlockStack>

      {/* Export Messages */}
      {exportMessage && (
        <div style={{ position: 'fixed', top: '80px', right: '20px', zIndex: 1000, maxWidth: '400px' }}>
          <Banner
            title={exportError ? "Export Failed" : "Export Complete"}
            tone={exportError ? "critical" : "success"}
            onDismiss={() => {
              setExportMessage(null);
              setExportError(false);
            }}
          >
            <Text variant="bodyMd" as="p">
              {exportMessage}
            </Text>
          </Banner>
        </div>
      )}
    </Page>
  );
}