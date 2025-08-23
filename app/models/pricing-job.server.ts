import { prisma } from '../db.server';
import type { 
  PricingJobType, 
  JobStatus, 
  CreatePricingJobData, 
  PricingJobFilters,
  CreateSelectedVariantData,
  CreatePricingRuleData
} from '../types/pricing-job';

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
        processingResults: true
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
        processingResults: {
          include: {
            auditTrailEntry: true
          }
        }
      }
    });
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
        selectedVariants: true,
        rules: true,
        processingResults: true
      },
      orderBy: { createdAt: 'desc' },
      take: filters.limit,
      skip: filters.offset || 0
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
    return prisma.processingResult.create({
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
}
