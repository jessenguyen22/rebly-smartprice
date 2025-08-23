import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { AuditRepository } from '../audit.server';
import { CampaignRepository } from '../campaign.server';

// Test database client
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

describe('AuditRepository Integration', () => {
  let auditRepo: AuditRepository;
  let campaignRepo: CampaignRepository;
  const testShopDomain = 'test-audit.myshopify.com';
  let testShopId: string;
  let testCampaignId: string;

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
    
    auditRepo = new AuditRepository(testShopDomain);
    campaignRepo = new CampaignRepository(testShopDomain);

    // Create test campaign
    const testCampaign = await campaignRepo.create({
      name: 'Test Campaign',
      targetProducts: [],
      rules: []
    }, 'test-user');
    testCampaignId = testCampaign.id;
  });

  beforeEach(async () => {
    // Clean up audit entries before each test
    await testPrisma.auditTrailEntry.deleteMany({
      where: {
        shopifyShop: { shopDomain: testShopDomain }
      }
    });
  });

  afterAll(async () => {
    // Clean up test data
    await testPrisma.auditTrailEntry.deleteMany({
      where: {
        shopifyShop: { shopDomain: testShopDomain }
      }
    });
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

  it('should create and retrieve audit entries', async () => {
    const auditData = {
      entityType: 'variant',
      entityId: 'gid://shopify/ProductVariant/123',
      changeType: 'price_update',
      oldValue: '19.99',
      newValue: '24.99',
      triggerReason: 'Low inventory detected',
      userId: 'test-user',
      campaignId: testCampaignId,
      metadata: {
        oldInventory: 5,
        newInventory: 15
      }
    };

    const entry = await auditRepo.create(auditData);
    expect(entry.id).toBeDefined();
    expect(entry.entityType).toBe('variant');

    // Test finding by campaign
    const campaignEntries = await auditRepo.findByCampaign(testCampaignId);
    expect(campaignEntries).toHaveLength(1);
    expect(campaignEntries[0].entityId).toBe('gid://shopify/ProductVariant/123');

    // Test finding by entity
    const entityEntries = await auditRepo.findByEntity('variant', 'gid://shopify/ProductVariant/123');
    expect(entityEntries).toHaveLength(1);

    // Test filtering
    const filtered = await auditRepo.findWithFilters({
      entityType: 'variant',
      limit: 10
    });
    expect(filtered).toHaveLength(1);
  });

  it('should handle multiple entries correctly', async () => {
    // Create multiple entries
    await auditRepo.create({
      entityType: 'variant',
      entityId: 'gid://shopify/ProductVariant/123',
      changeType: 'price_update',
      oldValue: '19.99',
      newValue: '24.99',
      triggerReason: 'Update 1',
      campaignId: testCampaignId
    });

    await auditRepo.create({
      entityType: 'variant',
      entityId: 'gid://shopify/ProductVariant/456',
      changeType: 'inventory_update',
      oldValue: '50',
      newValue: '25',
      triggerReason: 'Update 2',
      campaignId: testCampaignId
    });

    const allEntries = await auditRepo.findWithFilters({ limit: 10 });
    expect(allEntries).toHaveLength(2);

    const count = await auditRepo.count({ campaignId: testCampaignId });
    expect(count).toBe(2);
  });
});
