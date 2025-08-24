import type { 
  RollbackJob, 
  RollbackProgress, 
  RollbackConfirmation, 
  OriginalPriceEntry,
  RollbackFilters 
} from '../types/rollback';
import db from '../../db.server';
import { CampaignService } from './CampaignService';

export class RollbackService {
  private shopId: string;

  constructor(shopId: string) {
    this.shopId = shopId;
  }

  /**
   * Get rollback confirmation data before executing
   */
  async getRollbackConfirmation(campaignId: string, filters?: RollbackFilters): Promise<RollbackConfirmation> {
    const campaign = await db.campaign.findFirst({
      where: {
        id: campaignId,
        shopifyShopId: this.shopId
      },
      include: {
        rules: true
      }
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Get audit trail entries for price changes
    const auditEntries = await db.auditTrailEntry.findMany({
      where: {
        campaignId,
        changeType: 'price_update',
        ...(filters?.dateRange && {
          timestamp: {
            gte: filters.dateRange.from,
            lte: filters.dateRange.to
          }
        })
      },
      select: {
        entityId: true,
        oldValue: true,
        newValue: true
      }
    });

    // Filter entries based on criteria
    let filteredEntries = auditEntries;
    if (filters?.variantIds?.length) {
      filteredEntries = filteredEntries.filter(entry => 
        filters.variantIds!.includes(entry.entityId)
      );
    }

    const affectedVariants = new Set(filteredEntries.map(e => e.entityId)).size;
    const affectedProducts = Math.ceil(affectedVariants / 3); // Estimate

    // Calculate risk level
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    const warnings: string[] = [];

    if (affectedVariants > 100) {
      riskLevel = 'HIGH';
      warnings.push(`Large number of variants affected (${affectedVariants})`);
    } else if (affectedVariants > 50) {
      riskLevel = 'MEDIUM';
      warnings.push(`Moderate number of variants affected (${affectedVariants})`);
    }

    if (campaign.status === 'ACTIVE') {
      warnings.push('Campaign is currently active and will be paused during rollback');
    }

    const estimatedDuration = Math.max(30, affectedVariants * 2 + 10);

    return {
      campaignId,
      campaignName: campaign.name,
      affectedProducts,
      affectedVariants,
      totalPriceChanges: filteredEntries.length,
      estimatedDuration,
      riskLevel,
      warnings
    };
  }

  /**
   * Create rollback job
   */
  async createRollbackJob(campaignId: string, filters?: RollbackFilters): Promise<RollbackJob> {
    const confirmation = await this.getRollbackConfirmation(campaignId, filters);
    
    // Get original prices from audit trail
    const auditEntries = await db.auditTrailEntry.findMany({
      where: {
        campaignId,
        changeType: 'price_update'
      },
      take: 100 // Limit for now
    });

    // Build original price entries
    const originalPrices: OriginalPriceEntry[] = auditEntries.map(entry => ({
      variantId: entry.entityId,
      productId: entry.entityId, // Simplified
      productTitle: 'Product Title',
      variantTitle: 'Default Title',
      originalPrice: parseFloat(entry.oldValue || '0'),
      currentPrice: parseFloat(entry.newValue || '0'),
      priceChangeDate: entry.timestamp,
      auditTrailId: entry.id
    }));

    // Create rollback job record
    const rollbackJob = await db.pricingJob.create({
      data: {
        name: `Rollback: ${confirmation.campaignName}`,
        shopifyShopId: this.shopId,
        type: 'ROLLBACK',
        status: 'PENDING',
        totalVariants: confirmation.affectedVariants,
        processedCount: 0,
        successCount: 0,
        errorCount: 0
      }
    });

    return {
      id: rollbackJob.id,
      campaignId,
      campaignName: confirmation.campaignName,
      status: 'PENDING',
      type: 'CAMPAIGN_ROLLBACK',
      createdAt: rollbackJob.createdAt,
      totalVariants: confirmation.affectedVariants,
      processedVariants: 0,
      successfulVariants: 0,
      failedVariants: 0,
      originalPrices,
      rollbackFilters: filters
    };
  }

  /**
   * Get rollback job progress
   */
  async getRollbackProgress(jobId: string): Promise<RollbackProgress | null> {
    const job = await db.pricingJob.findFirst({
      where: {
        id: jobId,
        shopifyShopId: this.shopId,
        type: 'ROLLBACK'
      }
    });

    if (!job) {
      return null;
    }

    const progress = job.totalVariants > 0 ? 
      (job.successCount / job.totalVariants) * 100 : 0;

    // Get recent errors
    const recentErrors = await db.processingResult.findMany({
      where: {
        pricingJobId: job.id,
        success: false
      },
      orderBy: { processedAt: 'desc' },
      take: 10
    });

    return {
      jobId: job.id,
      status: job.status as any,
      progress: Math.round(progress),
      currentVariant: undefined,
      estimatedTimeRemaining: progress > 0 ? 
        ((job.totalVariants - job.successCount) * 2) : undefined,
      errors: recentErrors.map(error => ({
        variantId: error.variantId,
        productTitle: error.productId,
        variantTitle: 'Default Title',
        error: error.errorMessage || 'Unknown error',
        timestamp: error.processedAt
      }))
    };
  }

  /**
   * Execute rollback job (simplified)
   */
  async executeRollbackJob(jobId: string): Promise<void> {
    const job = await db.pricingJob.findFirst({
      where: {
        id: jobId,
        shopifyShopId: this.shopId,
        type: 'ROLLBACK'
      }
    });

    if (!job) {
      throw new Error(`Rollback job ${jobId} not found`);
    }

    if (job.status !== 'PENDING') {
      throw new Error(`Job ${jobId} is not in PENDING status`);
    }

    // Update job status
    await db.pricingJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date()
      }
    });

    try {
      // Simulate rollback processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Mark job as completed
      await db.pricingJob.update({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          processedCount: job.totalVariants,
          successCount: job.totalVariants,
          errorCount: 0
        }
      });

    } catch (error) {
      // Mark job as failed
      await db.pricingJob.update({
        where: { id: jobId },
        data: {
          status: 'FAILED'
        }
      });
      throw error;
    }
  }

  /**
   * Cancel rollback job
   */
  async cancelRollbackJob(jobId: string): Promise<void> {
    const job = await db.pricingJob.findFirst({
      where: {
        id: jobId,
        shopifyShopId: this.shopId,
        type: 'ROLLBACK'
      }
    });

    if (!job) {
      throw new Error(`Rollback job ${jobId} not found`);
    }

    if (!['PENDING', 'RUNNING'].includes(job.status)) {
      throw new Error(`Cannot cancel job in ${job.status} status`);
    }

    await db.pricingJob.update({
      where: { id: jobId },
      data: {
        status: 'CANCELLED'
      }
    });
  }

  /**
   * List rollback jobs for a campaign
   */
  async getRollbackJobs(campaignId: string): Promise<RollbackJob[]> {
    const jobs = await db.pricingJob.findMany({
      where: {
        shopifyShopId: this.shopId,
        type: 'ROLLBACK',
        name: {
          contains: campaignId // Simple filter by name containing campaign ID
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return jobs.map(job => ({
      id: job.id,
      campaignId,
      campaignName: job.name,
      status: job.status as any,
      type: 'CAMPAIGN_ROLLBACK',
      createdAt: job.createdAt,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
      totalVariants: job.totalVariants,
      processedVariants: job.processedCount,
      successfulVariants: job.successCount,
      failedVariants: job.errorCount,
      errorMessage: undefined,
      originalPrices: [],
      rollbackFilters: undefined
    }));
  }
}
