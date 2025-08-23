import { prisma } from '../db.server';
import type { CreateAuditTrailEntry, AuditTrailFilters } from '../types/audit';

export class AuditRepository {
  constructor(private shopId: string) {}

  async create(data: CreateAuditTrailEntry) {
    // First find the shop record
    const shop = await prisma.shopifyShop.findUnique({
      where: { shopDomain: this.shopId }
    });

    if (!shop) {
      throw new Error(`Shop ${this.shopId} not found`);
    }

    return prisma.auditTrailEntry.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        changeType: data.changeType,
        oldValue: data.oldValue,
        newValue: data.newValue,
        triggerReason: data.triggerReason,
        userId: data.userId,
        campaignId: data.campaignId,
        pricingJobId: data.pricingJobId,
        metadata: data.metadata || {},
        shopifyShopId: shop.id
      }
    });
  }

  async findByCampaign(campaignId: string) {
    return prisma.auditTrailEntry.findMany({
      where: {
        campaignId,
        shopifyShop: { shopDomain: this.shopId }
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  async findByPricingJob(pricingJobId: string) {
    return prisma.auditTrailEntry.findMany({
      where: {
        pricingJobId,
        shopifyShop: { shopDomain: this.shopId }
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  async findByEntity(entityType: string, entityId: string) {
    return prisma.auditTrailEntry.findMany({
      where: {
        entityType,
        entityId,
        shopifyShop: { shopDomain: this.shopId }
      },
      orderBy: { timestamp: 'desc' }
    });
  }

  async findWithFilters(filters: AuditTrailFilters) {
    const whereClause: any = {
      shopifyShop: { shopDomain: this.shopId }
    };

    if (filters.entityType) {
      whereClause.entityType = filters.entityType;
    }

    if (filters.entityId) {
      whereClause.entityId = filters.entityId;
    }

    if (filters.changeType) {
      whereClause.changeType = filters.changeType;
    }

    if (filters.campaignId) {
      whereClause.campaignId = filters.campaignId;
    }

    if (filters.pricingJobId) {
      whereClause.pricingJobId = filters.pricingJobId;
    }

    if (filters.startDate || filters.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) {
        whereClause.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.timestamp.lte = filters.endDate;
      }
    }

    return prisma.auditTrailEntry.findMany({
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      take: filters.limit,
      skip: filters.offset || 0
    });
  }

  async count(filters?: Partial<AuditTrailFilters>): Promise<number> {
    const whereClause: any = {
      shopifyShop: { shopDomain: this.shopId }
    };

    if (filters?.entityType) {
      whereClause.entityType = filters.entityType;
    }

    if (filters?.changeType) {
      whereClause.changeType = filters.changeType;
    }

    if (filters?.campaignId) {
      whereClause.campaignId = filters.campaignId;
    }

    if (filters?.pricingJobId) {
      whereClause.pricingJobId = filters.pricingJobId;
    }

    if (filters?.startDate || filters?.endDate) {
      whereClause.timestamp = {};
      if (filters.startDate) {
        whereClause.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        whereClause.timestamp.lte = filters.endDate;
      }
    }

    return prisma.auditTrailEntry.count({
      where: whereClause
    });
  }

  async findRecent(limit = 50) {
    return prisma.auditTrailEntry.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }

  async deleteOldEntries(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await prisma.auditTrailEntry.deleteMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        timestamp: {
          lt: cutoffDate
        }
      }
    });

    return result.count;
  }
}
