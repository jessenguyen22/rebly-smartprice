import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CampaignRepository } from '../campaign.server';
import type { CreateCampaignData } from '../../types/campaign';

// Test database client
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

describe('CampaignRepository', () => {
  let campaignRepo: CampaignRepository;
  const testShopDomain = 'test-shop.myshopify.com';
  let testShopId: string;

  beforeAll(async () => {
    // Create test shop
    const testShop = await testPrisma.shopifyShop.create({
      data: {
        shopDomain: testShopDomain,
        accessToken: 'test-access-token',
        scopes: 'read_products,write_products',
        country: 'US',
        currency: 'USD',
        timezone: 'America/New_York'
      }
    });
    testShopId = testShop.id;
    
    campaignRepo = new CampaignRepository(testShopDomain);
  });

  beforeEach(async () => {
    // Clean up campaigns and rules before each test
    await testPrisma.pricingRule.deleteMany({
      where: {
        campaign: {
          shopifyShop: { shopDomain: testShopDomain }
        }
      }
    });
    await testPrisma.campaign.deleteMany({
      where: {
        shopifyShop: { shopDomain: testShopDomain }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await testPrisma.pricingRule.deleteMany({
      where: {
        campaign: {
          shopifyShop: { shopDomain: testShopDomain }
        }
      }
    });
    await testPrisma.campaign.deleteMany({
      where: {
        shopifyShop: { shopDomain: testShopDomain }
      }
    });
    await testPrisma.shopifyShop.delete({
      where: { id: testShopId }
    });
    await testPrisma.$disconnect();
  });

  describe('create', () => {
    it('should create a new campaign with rules', async () => {
      const campaignData: CreateCampaignData = {
        name: 'Test Campaign',
        description: 'Test campaign description',
        targetProducts: [
          {
            type: 'all',
            conditions: {
              inventoryLevel: { operator: 'less_than', value: 10 }
            }
          }
        ],
        rules: [
          {
            description: 'Low inventory rule',
            whenCondition: 'less_than_abs',
            whenOperator: 'lt',
            whenValue: '10',
            thenAction: 'increase_price',
            thenMode: 'absolute',
            thenValue: '5.00',
            changeCompareAt: false
          }
        ],
        priority: 1
      };

      const campaign = await campaignRepo.create(campaignData, 'test-user');

      expect(campaign.id).toBeDefined();
      expect(campaign.name).toBe('Test Campaign');
      expect(campaign.description).toBe('Test campaign description');
      expect(campaign.status).toBe('DRAFT');
      expect(campaign.priority).toBe(1);
      expect(campaign.rules).toHaveLength(1);
      expect(campaign.rules[0].whenCondition).toBe('less_than_abs');
      expect(campaign.rules[0].thenAction).toBe('increase_price');
    });

    it('should throw error if shop not found', async () => {
      const invalidRepo = new CampaignRepository('nonexistent-shop.myshopify.com');
      const campaignData: CreateCampaignData = {
        name: 'Test Campaign',
        targetProducts: [],
        rules: []
      };

      await expect(invalidRepo.create(campaignData, 'test-user'))
        .rejects
        .toThrow('Shop nonexistent-shop.myshopify.com not found');
    });
  });

  describe('findAll', () => {
    it('should return campaigns with rules ordered by updatedAt desc', async () => {
      // Create test campaigns
      const campaign1Data: CreateCampaignData = {
        name: 'Campaign 1',
        targetProducts: [],
        rules: [{
          whenCondition: 'less_than_abs',
          whenOperator: 'lt',
          whenValue: '10',
          thenAction: 'increase_price',
          thenMode: 'absolute',
          thenValue: '5.00'
        }]
      };

      const campaign2Data: CreateCampaignData = {
        name: 'Campaign 2',
        targetProducts: [],
        rules: []
      };

      const campaign1 = await campaignRepo.create(campaign1Data, 'test-user');
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const campaign2 = await campaignRepo.create(campaign2Data, 'test-user');

      const campaigns = await campaignRepo.findAll();

      expect(campaigns).toHaveLength(2);
      expect(campaigns[0].id).toBe(campaign2.id); // Most recently updated first
      expect(campaigns[1].id).toBe(campaign1.id);
      expect(campaigns[0].rules).toBeDefined();
    });

    it('should respect limit and offset parameters', async () => {
      // Create 3 campaigns
      for (let i = 1; i <= 3; i++) {
        await campaignRepo.create({
          name: `Campaign ${i}`,
          targetProducts: [],
          rules: []
        }, 'test-user');
      }

      const firstPage = await campaignRepo.findAll(2, 0);
      const secondPage = await campaignRepo.findAll(2, 2);

      expect(firstPage).toHaveLength(2);
      expect(secondPage).toHaveLength(1);
    });
  });

  describe('findByStatus', () => {
    it('should return only campaigns with specified status', async () => {
      // Create campaigns with different statuses
      const draftCampaign = await campaignRepo.create({
        name: 'Draft Campaign',
        targetProducts: [],
        rules: []
      }, 'test-user');

      await campaignRepo.updateStatus(draftCampaign.id, 'ACTIVE');
      
      await campaignRepo.create({
        name: 'Another Draft',
        targetProducts: [],
        rules: []
      }, 'test-user');

      const activeCampaigns = await campaignRepo.findByStatus('ACTIVE');
      const draftCampaigns = await campaignRepo.findByStatus('DRAFT');

      expect(activeCampaigns).toHaveLength(1);
      expect(activeCampaigns[0].status).toBe('ACTIVE');
      expect(draftCampaigns).toHaveLength(1);
      expect(draftCampaigns[0].status).toBe('DRAFT');
    });
  });

  describe('updateStatus', () => {
    it('should update campaign status', async () => {
      const campaign = await campaignRepo.create({
        name: 'Test Campaign',
        targetProducts: [],
        rules: []
      }, 'test-user');

      const updatedCampaign = await campaignRepo.updateStatus(campaign.id, 'ACTIVE');

      expect(updatedCampaign.status).toBe('ACTIVE');
      expect(updatedCampaign.updatedAt.getTime()).toBeGreaterThan(campaign.updatedAt.getTime());
    });
  });

  describe('incrementTriggerCount', () => {
    it('should increment trigger count and update lastTriggered', async () => {
      const campaign = await campaignRepo.create({
        name: 'Test Campaign',
        targetProducts: [],
        rules: []
      }, 'test-user');

      expect(campaign.triggerCount).toBe(0);
      expect(campaign.lastTriggered).toBeNull();

      await campaignRepo.incrementTriggerCount(campaign.id);

      // Fetch the updated campaign to verify changes
      const updatedCampaign = await campaignRepo.findById(campaign.id);
      expect(updatedCampaign).not.toBeNull();
      expect(updatedCampaign!.triggerCount).toBe(1);
      expect(updatedCampaign!.lastTriggered).not.toBeNull();
    });
  });

  describe('findById', () => {
    it('should return campaign with rules by id', async () => {
      const created = await campaignRepo.create({
        name: 'Test Campaign',
        description: 'Test description',
        targetProducts: [],
        rules: [{
          whenCondition: 'less_than_abs',
          whenOperator: 'lt',
          whenValue: '10',
          thenAction: 'increase_price',
          thenMode: 'absolute',
          thenValue: '5.00'
        }]
      }, 'test-user');

      const found = await campaignRepo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
      expect(found!.name).toBe('Test Campaign');
      expect(found!.rules).toHaveLength(1);
    });

    it('should return null if campaign not found', async () => {
      const found = await campaignRepo.findById('nonexistent-id');
      expect(found).toBeNull();
    });
  });
});
