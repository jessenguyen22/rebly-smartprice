import { prisma } from '../db.server';
import type { 
  PricingJobType, 
  JobStatus, 
  CreatePricingJobData, 
  PricingJobFilters,
  CreateSelectedVariantData,
  CreatePricingRuleData
} from '../types/pricing-job';
import type { PricingJobTemplate } from './pricing-job-template.server';

export class PricingJobRepository {
  constructor(private shopId: string) {}

  async create(data: CreatePricingJobData, userId: string) {
    // First find the shop record
    const shop = await prisma.shopifyShop.findUnique({
      where: { shopDomain: this.shopId }
    });

    if (!shop) {
      throw new Error(`Shop ${this.shopId} not found`);
    }

    return prisma.pricingJob.create({
      data: {
        name: data.name,
        type: data.type || 'MANUAL',
        status: 'PENDING',
        totalVariants: data.selectedVariants.length,
        templateId: data.templateId, // New: Track which template was used
        userId,
        shopifyShopId: shop.id,
        selectedVariants: {
          create: data.selectedVariants.map((variant: CreateSelectedVariantData) => ({
            variantId: variant.variantId,
            productId: variant.productId,
            productTitle: variant.productTitle,
            variantTitle: variant.variantTitle,
            currentPrice: variant.currentPrice,
            compareAtPrice: variant.compareAtPrice,
            inventory: variant.inventory
          }))
        },
        rules: data.rules ? {
          create: data.rules.map((rule: CreatePricingRuleData) => ({
            description: rule.description,
            whenCondition: rule.whenCondition,
            whenOperator: rule.whenOperator,
            whenValue: rule.whenValue,
            thenAction: rule.thenAction,
            thenMode: rule.thenMode,
            thenValue: rule.thenValue,
            changeCompareAt: rule.changeCompareAt || false
          }))
        } : undefined
      },
      include: {
        selectedVariants: true,
        rules: true,
        processingResults: true,
        template: true // New: Include template data
      }
    });
  }

  async findById(id: string) {
    return prisma.pricingJob.findFirst({
      where: {
        id,
        shopifyShop: { shopDomain: this.shopId }
      },
      include: {
        selectedVariants: true,
        rules: true,
        template: true, // New: Include template
        processingResults: {
          include: {
            auditTrailEntry: true
          }
        }
      }
    });
  }

  // New: Optimized method to find jobs with template data
  async findByIdWithTemplate(id: string) {
    const job = await prisma.pricingJob.findFirst({
      where: {
        id,
        shopifyShop: { shopDomain: this.shopId }
      },
      include: {
        selectedVariants: {
          select: {
            id: true,
            variantId: true,
            productId: true,
            productTitle: true,
            variantTitle: true,
            currentPrice: true,
            inventory: true
          }
        },
        rules: {
          select: {
            id: true,
            description: true,
            whenCondition: true,
            whenValue: true,
            thenAction: true,
            thenValue: true
          }
        },
        template: {
          select: {
            id: true,
            name: true,
            description: true,
            rules: true
          }
        },
        processingResults: {
          select: {
            id: true,
            variantId: true,
            success: true,
            oldPrice: true,
            newPrice: true,
            errorMessage: true,
            processedAt: true
          },
          take: 100 // Limit results for performance
        }
      }
    });

    return job;
  }

  async findAll(filters: PricingJobFilters) {
    const whereClause: any = {
      shopifyShop: { shopDomain: this.shopId }
    };

    if (filters.status) {
      whereClause.status = filters.status;
    }

    if (filters.type) {
      whereClause.type = filters.type;
    }

    if (filters.userId) {
      whereClause.userId = filters.userId;
    }

    return prisma.pricingJob.findMany({
      where: whereClause,
      include: {
        selectedVariants: {
          select: {
            id: true,
            variantId: true,
            productTitle: true,
            variantTitle: true,
            currentPrice: true
          },
          take: 5 // Performance: Only load first 5 variants for list view
        },
        rules: {
          select: {
            id: true,
            description: true,
            whenCondition: true,
            thenAction: true
          },
          take: 3 // Performance: Only load first 3 rules for preview
        },
        template: {
          select: {
            id: true,
            name: true,
            description: true
          }
        },
        processingResults: {
          select: {
            success: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset || 0
    });
  }

  // New: Optimized method for dashboard recent jobs
  async findRecentJobs(limit = 10) {
    return prisma.pricingJob.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        status: { in: ['COMPLETED', 'FAILED', 'RUNNING'] }
      },
      select: {
        id: true,
        name: true,
        type: true,
        status: true,
        totalVariants: true,
        successCount: true,
        errorCount: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        template: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  // New: Find jobs by template for analytics
  async findJobsByTemplate(templateId: string, limit = 20) {
    return prisma.pricingJob.findMany({
      where: {
        templateId,
        shopifyShop: { shopDomain: this.shopId }
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalVariants: true,
        successCount: true,
        errorCount: true,
        createdAt: true,
        completedAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
  }

  async updateStatus(id: string, status: JobStatus, counts?: {
    processedCount?: number;
    successCount?: number;
    errorCount?: number;
  }) {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };

    if (status === 'RUNNING' && !updateData.startedAt) {
      updateData.startedAt = new Date();
    }

    if (status === 'COMPLETED' || status === 'FAILED') {
      updateData.completedAt = new Date();
    }

    if (counts) {
      if (counts.processedCount !== undefined) {
        updateData.processedCount = counts.processedCount;
      }
      if (counts.successCount !== undefined) {
        updateData.successCount = counts.successCount;
      }
      if (counts.errorCount !== undefined) {
        updateData.errorCount = counts.errorCount;
      }
    }

    return prisma.pricingJob.update({
      where: { id },
      data: updateData,
      include: {
        selectedVariants: true,
        rules: true,
        processingResults: true
      }
    });
  }

  async addProcessingResult(jobId: string, result: {
    variantId: string;
    productId: string;
    success: boolean;
    oldPrice?: string;
    newPrice?: string;
    oldCompareAt?: string;
    newCompareAt?: string;
    errorMessage?: string;
    auditTrailId?: string;
  }) {
    try {
      return await prisma.processingResult.create({
        data: {
          variantId: result.variantId,
          productId: result.productId,
          success: result.success,
          oldPrice: result.oldPrice,
          newPrice: result.newPrice,
          oldCompareAt: result.oldCompareAt,
          newCompareAt: result.newCompareAt,
          errorMessage: result.errorMessage,
          auditTrailId: result.auditTrailId,
          pricingJobId: jobId
        }
      });
    } catch (error) {
      console.error(`Failed to add processing result for job ${jobId}:`, error);
      throw new Error(`Failed to save processing result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // New: Enhanced method with audit trail integration
  async addProcessingResultWithAudit(jobId: string, result: {
    variantId: string;
    productId: string;
    success: boolean;
    oldPrice?: string;
    newPrice?: string;
    oldCompareAt?: string;
    newCompareAt?: string;
    errorMessage?: string;
    triggerReason?: string;
    userId?: string;
  }) {
    try {
      // Use a transaction to ensure consistency
      return await prisma.$transaction(async (tx) => {
        let auditTrailId: string | undefined;

        // Create audit trail entry if price changed successfully
        if (result.success && result.oldPrice && result.newPrice && result.oldPrice !== result.newPrice) {
          const shop = await tx.shopifyShop.findUnique({
            where: { shopDomain: this.shopId }
          });

          if (shop) {
            const auditEntry = await tx.auditTrailEntry.create({
              data: {
                entityType: 'VARIANT',
                entityId: result.variantId,
                changeType: 'PRICE_CHANGE',
                oldValue: result.oldPrice,
                newValue: result.newPrice,
                triggerReason: result.triggerReason || 'Manual Pricing Job',
                userId: result.userId,
                pricingJobId: jobId,
                metadata: {
                  productId: result.productId,
                  oldCompareAt: result.oldCompareAt,
                  newCompareAt: result.newCompareAt
                },
                shopifyShopId: shop.id
              }
            });
            auditTrailId = auditEntry.id;
          }
        }

        // Create processing result
        const processingResult = await tx.processingResult.create({
          data: {
            variantId: result.variantId,
            productId: result.productId,
            success: result.success,
            oldPrice: result.oldPrice,
            newPrice: result.newPrice,
            oldCompareAt: result.oldCompareAt,
            newCompareAt: result.newCompareAt,
            errorMessage: result.errorMessage,
            auditTrailId,
            pricingJobId: jobId
          }
        });

        return processingResult;
      });
    } catch (error) {
      console.error(`Failed to add processing result with audit for job ${jobId}:`, error);
      throw new Error(`Failed to save processing result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProcessingResults(jobId: string) {
    return prisma.processingResult.findMany({
      where: {
        pricingJobId: jobId
      },
      include: {
        auditTrailEntry: true
      },
      orderBy: { processedAt: 'asc' }
    });
  }

  async updateExportPath(id: string, exportPath: string) {
    return prisma.pricingJob.update({
      where: { id },
      data: { exportPath },
      include: {
        selectedVariants: true,
        rules: true,
        processingResults: true
      }
    });
  }

  async count(filters?: Partial<PricingJobFilters>): Promise<number> {
    const whereClause: any = {
      shopifyShop: { shopDomain: this.shopId }
    };

    if (filters?.status) {
      whereClause.status = filters.status;
    }

    if (filters?.type) {
      whereClause.type = filters.type;
    }

    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }

    return prisma.pricingJob.count({
      where: whereClause
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.pricingJob.delete({
      where: { id }
    });
  }

  async findPendingJobs() {
    return prisma.pricingJob.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        status: 'PENDING'
      },
      include: {
        selectedVariants: true,
        rules: true
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async findRunningJobs() {
    return prisma.pricingJob.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        status: 'RUNNING'
      },
      include: {
        selectedVariants: true,
        rules: true
      }
    });
  }

  // New: Performance analytics methods
  async getJobPerformanceMetrics(jobId: string) {
    const job = await prisma.pricingJob.findFirst({
      where: {
        id: jobId,
        shopifyShop: { shopDomain: this.shopId }
      },
      include: {
        processingResults: {
          select: {
            success: true,
            oldPrice: true,
            newPrice: true,
            processedAt: true,
            errorMessage: true
          }
        }
      }
    });

    if (!job) return null;

    const results = job.processingResults;
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    // Calculate price change statistics
    const priceChanges = successfulResults
      .filter(r => r.oldPrice && r.newPrice)
      .map(r => ({
        oldPrice: parseFloat(r.oldPrice!),
        newPrice: parseFloat(r.newPrice!),
        change: parseFloat(r.newPrice!) - parseFloat(r.oldPrice!)
      }));

    const totalPriceChange = priceChanges.reduce((sum, change) => sum + change.change, 0);
    const avgPriceChange = priceChanges.length > 0 ? totalPriceChange / priceChanges.length : 0;

    // Calculate processing time if available
    const processingTime = job.startedAt && job.completedAt 
      ? job.completedAt.getTime() - job.startedAt.getTime() 
      : null;

    return {
      jobId: job.id,
      name: job.name,
      status: job.status,
      totalVariants: job.totalVariants,
      processedCount: results.length,
      successCount: successfulResults.length,
      failureCount: failedResults.length,
      successRate: results.length > 0 ? (successfulResults.length / results.length) * 100 : 0,
      totalPriceChange,
      avgPriceChange,
      processingTimeMs: processingTime,
      errorSummary: failedResults.reduce((acc, result) => {
        const error = result.errorMessage || 'Unknown error';
        acc[error] = (acc[error] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      createdAt: job.createdAt,
      completedAt: job.completedAt
    };
  }

  // New: Template usage analytics
  async getTemplateUsageStats(templateId: string) {
    const jobs = await prisma.pricingJob.findMany({
      where: {
        templateId,
        shopifyShop: { shopDomain: this.shopId }
      },
      select: {
        id: true,
        status: true,
        totalVariants: true,
        successCount: true,
        errorCount: true,
        createdAt: true
      }
    });

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
    const failedJobs = jobs.filter(j => j.status === 'FAILED').length;
    const totalVariantsProcessed = jobs.reduce((sum, job) => sum + (job.totalVariants || 0), 0);
    const totalSuccessCount = jobs.reduce((sum, job) => sum + (job.successCount || 0), 0);

    return {
      templateId,
      totalJobs,
      completedJobs,
      failedJobs,
      completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      totalVariantsProcessed,
      totalSuccessCount,
      overallSuccessRate: totalVariantsProcessed > 0 ? (totalSuccessCount / totalVariantsProcessed) * 100 : 0,
      lastUsed: jobs.length > 0 ? Math.max(...jobs.map(j => j.createdAt.getTime())) : null,
      averageJobSize: totalJobs > 0 ? totalVariantsProcessed / totalJobs : 0
    };
  }

  // New: Shop-wide performance summary
  async getShopPerformanceSummary(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const jobs = await prisma.pricingJob.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        createdAt: { gte: cutoffDate }
      },
      select: {
        id: true,
        status: true,
        type: true,
        totalVariants: true,
        successCount: true,
        errorCount: true,
        templateId: true,
        createdAt: true
      }
    });

    const totalJobs = jobs.length;
    const completedJobs = jobs.filter(j => j.status === 'COMPLETED').length;
    const manualJobs = jobs.filter(j => j.type === 'MANUAL').length;
    const campaignJobs = jobs.filter(j => j.type === 'CAMPAIGN').length;
    const templatedJobs = jobs.filter(j => j.templateId).length;

    const totalVariants = jobs.reduce((sum, job) => sum + (job.totalVariants || 0), 0);
    const totalSuccesses = jobs.reduce((sum, job) => sum + (job.successCount || 0), 0);
    const totalErrors = jobs.reduce((sum, job) => sum + (job.errorCount || 0), 0);

    return {
      period: `${days} days`,
      totalJobs,
      completedJobs,
      completionRate: totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0,
      jobTypes: {
        manual: manualJobs,
        campaign: campaignJobs,
        templated: templatedJobs
      },
      variantMetrics: {
        totalVariants,
        totalSuccesses,
        totalErrors,
        successRate: totalVariants > 0 ? (totalSuccesses / totalVariants) * 100 : 0
      },
      averageJobSize: totalJobs > 0 ? totalVariants / totalJobs : 0,
      jobsPerDay: totalJobs / days
    };
  }
}
