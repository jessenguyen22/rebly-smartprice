import { PrismaClient, type Campaign, type CampaignStatus, type PricingRule } from '@prisma/client';
import type { CampaignInput, CampaignFilters } from '../validation/campaignValidation';
import type { 
  CampaignMetrics, 
  TriggerHistoryEntry, 
  CampaignAggregateMetrics,
  CampaignPerformance,
  PriceChangeMetric,
  WebhookStatus,
  PerformanceStats
} from '../types/campaign-metrics';
import { prisma } from '../../db.server';

export interface CampaignWithRules extends Campaign {
  rules: PricingRule[];
  _count?: {
    rules: number;
  };
}

export interface CampaignListResult {
  campaigns: CampaignWithRules[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  meta: {
    totalDraft: number;
    totalActive: number;
    totalPaused: number;
    totalCompleted: number;
  };
}

export class CampaignService {
  private shopDomain: string;

  constructor(shopDomain: string) {
    this.shopDomain = shopDomain;
  }

  private async getShopId(): Promise<string> {
    // First, try to find existing shop
    let shop = await prisma.shopifyShop.findUnique({
      where: { shopDomain: this.shopDomain },
      select: { id: true }
    });

    // If shop doesn't exist, create it
    if (!shop) {
      console.log(`Creating new shop record for: ${this.shopDomain}`);
      shop = await prisma.shopifyShop.create({
        data: {
          shopDomain: this.shopDomain,
          // We'll update these fields when we have session data
          accessToken: null,
          scopes: null,
        },
        select: { id: true }
      });
      console.log(`Shop record created with ID: ${shop.id}`);
    }

    return shop.id;
  }

  /**
   * Get list of campaigns with filtering, sorting, and pagination
   */
  async getCampaigns(filters: CampaignFilters): Promise<CampaignListResult> {
    const shopId = await this.getShopId();

    // Build where clause
    const where: any = {
      shopifyShopId: shopId
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    // Calculate pagination
    const skip = (filters.page - 1) * filters.limit;

    // Get campaigns with rules
    const [campaigns, total, statusCounts] = await Promise.all([
      prisma.campaign.findMany({
        where,
        include: {
          rules: true,
          _count: {
            select: { rules: true }
          }
        },
        orderBy: {
          [filters.sortBy]: filters.sortOrder
        },
        skip,
        take: filters.limit
      }),
      prisma.campaign.count({ where }),
      prisma.campaign.groupBy({
        by: ['status'],
        where: { shopifyShopId: shopId },
        _count: true
      })
    ]);

    // Process status counts
    const meta = {
      totalDraft: 0,
      totalActive: 0,
      totalPaused: 0,
      totalCompleted: 0
    };

    statusCounts.forEach(item => {
      switch (item.status) {
        case 'DRAFT':
          meta.totalDraft = item._count;
          break;
        case 'ACTIVE':
          meta.totalActive = item._count;
          break;
        case 'PAUSED':
          meta.totalPaused = item._count;
          break;
        case 'COMPLETED':
          meta.totalCompleted = item._count;
          break;
      }
    });

    return {
      campaigns: campaigns as CampaignWithRules[],
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit)
      },
      meta
    };
  }

  /**
   * Get single campaign by ID
   */
  async getCampaign(campaignId: string): Promise<CampaignWithRules | null> {
    const shopId = await this.getShopId();

    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        shopifyShopId: shopId
      },
      include: {
        rules: true,
        _count: {
          select: { rules: true }
        }
      }
    });

    return campaign as CampaignWithRules | null;
  }

  /**
   * Create new campaign
   */
  async createCampaign(input: CampaignInput, userId?: string): Promise<CampaignWithRules> {
    const shopId = await this.getShopId();

    const campaign = await prisma.campaign.create({
      data: {
        name: input.name,
        description: input.description,
        targetProducts: input.targetProducts,
        priority: input.priority,
        userId,
        shopifyShopId: shopId,
        rules: {
          create: input.rules.map(rule => ({
            description: rule.description,
            whenCondition: rule.whenCondition,
            whenOperator: rule.whenOperator,
            whenValue: rule.whenValue,
            thenAction: rule.thenAction,
            thenMode: rule.thenMode,
            thenValue: rule.thenValue,
            changeCompareAt: rule.changeCompareAt
          }))
        }
      },
      include: {
        rules: true,
        _count: {
          select: { rules: true }
        }
      }
    });

    return campaign as CampaignWithRules;
  }

  /**
   * Update existing campaign
   */
  async updateCampaign(campaignId: string, input: CampaignInput, userId?: string): Promise<CampaignWithRules> {
    const shopId = await this.getShopId();

    // Check if campaign exists and belongs to shop
    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        shopifyShopId: shopId
      }
    });

    if (!existingCampaign) {
      throw new Error('Campaign not found');
    }

    // Check if campaign is in editable state
    if (existingCampaign.status !== 'DRAFT') {
      throw new Error('Only DRAFT campaigns can be edited');
    }

    // Update campaign and rules in transaction
    const campaign = await prisma.$transaction(async (tx) => {
      // Delete existing rules
      await tx.pricingRule.deleteMany({
        where: { campaignId }
      });

      // Update campaign with new rules
      const updatedCampaign = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          name: input.name,
          description: input.description,
          targetProducts: input.targetProducts,
          priority: input.priority,
          rules: {
            create: input.rules.map(rule => ({
              description: rule.description,
              whenCondition: rule.whenCondition,
              whenOperator: rule.whenOperator,
              whenValue: rule.whenValue,
              thenAction: rule.thenAction,
              thenMode: rule.thenMode,
              thenValue: rule.thenValue,
              changeCompareAt: rule.changeCompareAt
            }))
          }
        },
        include: {
          rules: true,
          _count: {
            select: { rules: true }
          }
        }
      });

      return updatedCampaign;
    });

    return campaign as CampaignWithRules;
  }

  /**
   * Update campaign status
   */
  async updateCampaignStatus(
    campaignId: string, 
    newStatus: CampaignStatus, 
    userId?: string,
    reason?: string
  ): Promise<CampaignWithRules> {
    const shopId = await this.getShopId();

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        shopifyShopId: shopId
      }
    });

    if (!existingCampaign) {
      throw new Error('Campaign not found');
    }

    // Validate status transition
    this.validateStatusTransition(existingCampaign.status, newStatus);

    const updateData: any = {
      status: newStatus
    };

    // Set lastTriggered when activating
    if (newStatus === 'ACTIVE' && existingCampaign.status !== 'ACTIVE') {
      updateData.lastTriggered = new Date();
    }

    const campaign = await prisma.campaign.update({
      where: { id: campaignId },
      data: updateData,
      include: {
        rules: true,
        _count: {
          select: { rules: true }
        }
      }
    });

    return campaign as CampaignWithRules;
  }

  /**
   * Delete campaign (soft delete by setting to ARCHIVED)
   */
  async deleteCampaign(campaignId: string, userId?: string): Promise<void> {
    const shopId = await this.getShopId();

    const existingCampaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        shopifyShopId: shopId
      }
    });

    if (!existingCampaign) {
      throw new Error('Campaign not found');
    }

    // Only allow deletion of DRAFT campaigns
    if (existingCampaign.status !== 'DRAFT') {
      throw new Error('Only DRAFT campaigns can be deleted');
    }

    await prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'ARCHIVED' }
    });
  }

  /**
   * Validate status transition
   */
  private validateStatusTransition(currentStatus: CampaignStatus, newStatus: CampaignStatus): void {
    const validTransitions: Record<CampaignStatus, CampaignStatus[]> = {
      DRAFT: ['ACTIVE'],
      ACTIVE: ['PAUSED', 'COMPLETED'],
      PAUSED: ['ACTIVE', 'COMPLETED'],
      COMPLETED: [], // Terminal state
      ARCHIVED: [] // Terminal state
    };

    if (!validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${newStatus}`);
    }
  }

  /**
   * Increment trigger count for campaign
   */
  async incrementTriggerCount(campaignId: string): Promise<void> {
    await prisma.campaign.update({
      where: { id: campaignId },
      data: {
        triggerCount: { increment: 1 },
        lastTriggered: new Date()
      }
    });
  }

  /**
   * Get comprehensive campaign metrics
   */
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics> {
    const shopId = await this.getShopId();

    // Get basic campaign data
    const campaign = await prisma.campaign.findFirst({
      where: {
        id: campaignId,
        shopifyShopId: shopId
      },
      include: {
        rules: true
      }
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Get trigger history
    const triggerHistory = await prisma.auditTrailEntry.findMany({
      where: {
        campaignId,
        changeType: 'price_update'
      },
      orderBy: { timestamp: 'desc' },
      take: 100 // Last 100 triggers
    });

    // Get affected products from audit trail
    const affectedProductIds = new Set(
      triggerHistory.map(entry => entry.entityId)
    );

    // Calculate price changes
    const priceChanges: PriceChangeMetric[] = triggerHistory.map(entry => {
      const metadata = entry.metadata as any;
      return {
        productId: metadata?.productId || entry.entityId,
        variantId: entry.entityId,
        productTitle: metadata?.productTitle || 'Unknown Product',
        oldPrice: parseFloat(entry.oldValue || '0'),
        newPrice: parseFloat(entry.newValue || '0'),
        changedAt: entry.timestamp,
        changeAmount: parseFloat(entry.newValue || '0') - parseFloat(entry.oldValue || '0'),
        changePercentage: entry.oldValue ? 
          ((parseFloat(entry.newValue || '0') - parseFloat(entry.oldValue || '0')) / parseFloat(entry.oldValue)) * 100 : 0
      };
    });

    // Calculate webhook status (simplified)
    const recentErrors = await prisma.auditTrailEntry.count({
      where: {
        campaignId,
        changeType: 'webhook_error',
        timestamp: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    });

    const totalWebhooks = triggerHistory.length;
    const successfulWebhooks = totalWebhooks - recentErrors;

    const webhookStatus: WebhookStatus = {
      isActive: campaign.status === 'ACTIVE',
      lastProcessed: campaign.lastTriggered,
      processingErrors: recentErrors,
      avgProcessingTime: 250, // Mock data - would be calculated from actual processing times
      successRate: totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 100
    };

    // Calculate performance stats (simplified mock data)
    const performanceStats: PerformanceStats = {
      totalRevenue: 0, // Would be calculated from order data
      avgOrderValue: 0,
      conversionRate: 0,
      inventoryTurnover: 0,
      priceOptimizationScore: Math.min(100, Math.max(0, webhookStatus.successRate + campaign.triggerCount))
    };

    return {
      campaignId,
      totalTriggers: campaign.triggerCount,
      lastTriggered: campaign.lastTriggered,
      affectedProducts: affectedProductIds.size,
      priceChanges,
      webhookStatus,
      performanceStats
    };
  }

  /**
   * Get trigger history for a campaign
   */
  async getTriggerHistory(campaignId: string, limit = 50): Promise<TriggerHistoryEntry[]> {
    const shopId = await this.getShopId();

    const triggers = await prisma.auditTrailEntry.findMany({
      where: {
        campaignId,
        changeType: 'price_update'
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });

    return triggers.map(trigger => {
      const metadata = trigger.metadata as any;
      return {
        id: trigger.id,
        campaignId: trigger.campaignId!,
        triggeredAt: trigger.timestamp,
        triggerReason: trigger.triggerReason,
        productIds: [trigger.entityId], // Simplified - could be multiple
        priceChanges: 1, // Each audit entry represents one price change
        successful: !trigger.triggerReason.includes('error'),
        errorMessage: trigger.triggerReason.includes('error') ? trigger.triggerReason : undefined,
        processingTime: metadata?.processingTime || 200 // Mock data
      };
    });
  }

  /**
   * Get aggregate metrics for all campaigns
   */
  async getAggregateMetrics(): Promise<CampaignAggregateMetrics> {
    const shopId = await this.getShopId();

    // Get campaign counts
    const totalCampaigns = await prisma.campaign.count({
      where: { shopifyShopId: shopId }
    });

    const activeCampaigns = await prisma.campaign.count({
      where: { 
        shopifyShopId: shopId,
        status: 'ACTIVE' 
      }
    });

    // Get total triggers
    const campaigns = await prisma.campaign.findMany({
      where: { shopifyShopId: shopId },
      select: { 
        id: true,
        name: true,
        triggerCount: true,
        lastTriggered: true
      }
    });

    const totalTriggers = campaigns.reduce((sum, c) => sum + c.triggerCount, 0);

    // Get total price changes from audit trail
    const totalPriceChanges = await prisma.auditTrailEntry.count({
      where: {
        changeType: 'price_update',
        shopifyShopId: shopId
      }
    });

    // Calculate success rate (simplified)
    const errorCount = await prisma.auditTrailEntry.count({
      where: {
        changeType: 'webhook_error',
        shopifyShopId: shopId
      }
    });

    const avgSuccessRate = totalPriceChanges > 0 ? 
      ((totalPriceChanges - errorCount) / totalPriceChanges) * 100 : 100;

    // Get top performing campaigns
    const topPerformingCampaigns: CampaignPerformance[] = campaigns
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 5)
      .map(campaign => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        triggerCount: campaign.triggerCount,
        successRate: 95, // Mock data - would calculate from audit trail
        totalPriceChanges: campaign.triggerCount, // Simplified
        avgResponseTime: 250, // Mock data
        lastActiveDate: campaign.lastTriggered || new Date()
      }));

    return {
      totalCampaigns,
      activeCampaigns,
      totalTriggers,
      totalPriceChanges,
      avgSuccessRate,
      topPerformingCampaigns
    };
  }

  /**
   * Record a trigger event
   */
  async recordTriggerEvent(
    campaignId: string, 
    triggerReason: string, 
    productIds: string[],
    successful: boolean,
    processingTime: number,
    errorMessage?: string
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // Increment campaign trigger count
      await tx.campaign.update({
        where: { id: campaignId },
        data: {
          triggerCount: { increment: 1 },
          lastTriggered: new Date()
        }
      });

      // Create audit trail entry
      const shopId = await this.getShopId();
      await tx.auditTrailEntry.create({
        data: {
          shopifyShopId: shopId,
          campaignId,
          entityType: 'campaign',
          entityId: campaignId,
          changeType: successful ? 'campaign_trigger' : 'campaign_error',
          triggerReason,
          metadata: {
            productIds,
            processingTime,
            errorMessage,
            successful
          }
        }
      });
    });
  }
}
