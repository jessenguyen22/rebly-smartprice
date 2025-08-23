import { prisma } from '../db.server';
import type { CampaignStatus, CreateCampaignData, CreatePricingRuleData } from '../types/campaign';
import type { Campaign, PricingRule } from '@prisma/client';

export type CampaignWithRules = Campaign & {
  rules: PricingRule[];
};

export class CampaignRepository {
  constructor(private shopId: string) {}

  async findAll(limit = 20, offset = 0) {
    return prisma.campaign.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId }
      },
      include: {
        rules: true
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async findByStatus(status: CampaignStatus, limit = 20, offset = 0) {
    return prisma.campaign.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        status
      },
      include: {
        rules: true
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset
    });
  }

  async findActive() {
    return prisma.campaign.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        status: 'ACTIVE'
      },
      include: {
        rules: true
      },
      orderBy: { priority: 'desc' }
    });
  }

  async findById(id: string) {
    return prisma.campaign.findFirst({
      where: {
        id,
        shopifyShop: { shopDomain: this.shopId }
      },
      include: {
        rules: true
      }
    });
  }

  async create(data: CreateCampaignData, userId: string) {
    // First find or create the shop record
    let shop = await prisma.shopifyShop.findUnique({
      where: { shopDomain: this.shopId }
    });

    if (!shop) {
      console.log(`🏪 Creating new shop record for: ${this.shopId}`);
      shop = await prisma.shopifyShop.create({
        data: {
          shopDomain: this.shopId,
          accessToken: '', // Will be populated later by session system
          scopes: '',
          country: '',
          currency: '',
          timezone: ''
        }
      });
    }

    return prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        targetProducts: data.targetProducts as any, // JSON field
        status: data.status || 'DRAFT',
        priority: data.priority || 1,
        userId,
        shopifyShopId: shop.id,
        rules: {
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
        }
      },
      include: {
        rules: true
      }
    });
  }

  async updateStatus(id: string, status: CampaignStatus) {
    const updateData: any = { 
      status,
      updatedAt: new Date()
    };

    // Reset trigger tracking when activating
    if (status === 'ACTIVE') {
      updateData.lastTriggered = null;
      updateData.triggerCount = 0;
    }

    return prisma.campaign.update({
      where: { id },
      data: updateData,
      include: {
        rules: true
      }
    });
  }

  async incrementTriggerCount(id: string): Promise<void> {
    await prisma.campaign.update({
      where: { id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggered: new Date()
      }
    });
  }

  async update(id: string, data: Partial<CreateCampaignData>) {
    return prisma.campaign.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        targetProducts: data.targetProducts as any,
        priority: data.priority,
        updatedAt: new Date(),
        // Update rules if provided
        ...(data.rules && {
          rules: {
            deleteMany: {}, // Delete existing rules
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
          }
        })
      },
      include: {
        rules: true
      }
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.campaign.delete({
      where: { id }
    });
  }

  async count(filters?: { status?: CampaignStatus }): Promise<number> {
    return prisma.campaign.count({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        ...(filters?.status && { status: filters.status })
      }
    });
  }
}
