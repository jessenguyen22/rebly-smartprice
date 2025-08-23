import { AuditRepository } from '../models/audit.server';
import type { CreateAuditTrailEntry, PriceChangeAuditData } from '../types/audit';

export class AuditLogger {
  private auditRepo: AuditRepository;

  constructor(shopId: string) {
    this.auditRepo = new AuditRepository(shopId);
  }

  /**
   * Log a general audit trail entry
   */
  async log(data: CreateAuditTrailEntry) {
    return this.auditRepo.create(data);
  }

  /**
   * Log a price change with structured data
   */
  async logPriceChange(data: PriceChangeAuditData & {
    triggerReason: string;
    userId?: string;
    campaignId?: string;
    pricingJobId?: string;
  }) {
    const metadata = {
      variant: data.variant,
      product: data.product,
      priceChanges: {
        price: {
          old: data.oldPrice,
          new: data.newPrice
        },
        compareAtPrice: {
          old: data.oldCompareAt,
          new: data.newCompareAt
        }
      }
    };

    // Create audit entry for price changes
    const auditPromises = [];

    // Log price update if price changed
    if (data.oldPrice !== data.newPrice && data.newPrice !== undefined) {
      auditPromises.push(
        this.auditRepo.create({
          entityType: 'variant',
          entityId: data.variant.id,
          changeType: 'price_update',
          oldValue: data.oldPrice || undefined,
          newValue: data.newPrice,
          triggerReason: data.triggerReason,
          userId: data.userId,
          campaignId: data.campaignId,
          pricingJobId: data.pricingJobId,
          metadata
        })
      );
    }

    // Log compare at price update if compare at price changed
    if (data.oldCompareAt !== data.newCompareAt && data.newCompareAt !== undefined) {
      auditPromises.push(
        this.auditRepo.create({
          entityType: 'variant',
          entityId: data.variant.id,
          changeType: 'compare_at_update',
          oldValue: data.oldCompareAt || undefined,
          newValue: data.newCompareAt,
          triggerReason: data.triggerReason,
          userId: data.userId,
          campaignId: data.campaignId,
          pricingJobId: data.pricingJobId,
          metadata
        })
      );
    }

    const results = await Promise.all(auditPromises);
    return results[0]; // Return the first audit entry for reference
  }

  /**
   * Log campaign trigger
   */
  async logCampaignTriggered(data: {
    campaignId: string;
    campaignName: string;
    triggerCondition: string;
    affectedVariants: number;
    userId?: string;
  }) {
    return this.auditRepo.create({
      entityType: 'campaign',
      entityId: data.campaignId,
      changeType: 'campaign_triggered',
      oldValue: undefined,
      newValue: JSON.stringify({ triggered: true }),
      triggerReason: 'Automated campaign rule execution',
      userId: data.userId,
      campaignId: data.campaignId,
      metadata: {
        campaignName: data.campaignName,
        triggerCondition: data.triggerCondition,
        affectedVariants: data.affectedVariants,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log inventory sync from webhook
   */
  async logInventorySync(data: {
    variantId: string;
    productId: string;
    oldInventory?: number;
    newInventory: number;
    webhookId?: string;
  }) {
    return this.auditRepo.create({
      entityType: 'variant',
      entityId: data.variantId,
      changeType: 'inventory_sync',
      oldValue: data.oldInventory?.toString() || undefined,
      newValue: data.newInventory.toString(),
      triggerReason: 'Webhook inventory update',
      metadata: {
        productId: data.productId,
        webhookId: data.webhookId,
        syncedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Log pricing job completion
   */
  async logJobCompleted(data: {
    pricingJobId: string;
    jobName: string;
    totalVariants: number;
    successCount: number;
    errorCount: number;
    userId?: string;
  }) {
    return this.auditRepo.create({
      entityType: 'pricing_job',
      entityId: data.pricingJobId,
      changeType: 'job_completed',
      oldValue: undefined,
      newValue: JSON.stringify({ 
        status: 'completed',
        stats: {
          total: data.totalVariants,
          success: data.successCount,
          errors: data.errorCount
        }
      }),
      triggerReason: 'Manual pricing job completion',
      userId: data.userId,
      pricingJobId: data.pricingJobId,
      metadata: {
        jobName: data.jobName,
        executionStats: {
          totalVariants: data.totalVariants,
          successCount: data.successCount,
          errorCount: data.errorCount,
          successRate: (data.successCount / data.totalVariants * 100).toFixed(2) + '%'
        },
        completedAt: new Date().toISOString()
      }
    });
  }

  /**
   * Get audit trail for a specific entity
   */
  async getEntityAuditTrail(entityType: string, entityId: string) {
    return this.auditRepo.findByEntity(entityType, entityId);
  }

  /**
   * Get recent audit entries
   */
  async getRecentEntries(limit = 50) {
    return this.auditRepo.findRecent(limit);
  }

  /**
   * Get audit entries with filters
   */
  async getEntriesWithFilters(filters: {
    entityType?: string;
    changeType?: string;
    campaignId?: string;
    pricingJobId?: string;
    startDate?: Date;
    endDate?: Date;
    limit: number;
    offset?: number;
  }) {
    return this.auditRepo.findWithFilters(filters);
  }

  /**
   * Clean up old audit entries (for maintenance)
   */
  async cleanupOldEntries(retentionDays = 730) { // 2 years default
    return this.auditRepo.deleteOldEntries(retentionDays);
  }
}
