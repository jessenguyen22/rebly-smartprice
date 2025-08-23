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

describe('AuditRepository', () => {
  let auditRepo: AuditRepository;
  let campaignRepo: CampaignRepository;
  const testShopDomain = 'audit-test-shop.myshopify.com';
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
      name: 'Test Audit Campaign',
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

  describe('create', () => {
    it('should create a new audit entry', async () => {
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
      expect(entry.entityId).toBe('gid://shopify/ProductVariant/123');
      expect(entry.changeType).toBe('price_update');
      expect(entry.oldValue).toBe('19.99');
      expect(entry.newValue).toBe('24.99');
      expect(entry.userId).toBe('test-user');
      expect(entry.campaignId).toBe(testCampaignId);
      expect(entry.triggerReason).toBe('Low inventory detected');
      expect(entry.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('findByCampaign', () => {
    it('should return audit entries for a specific campaign', async () => {
      // Create audit entries for different campaigns
      const otherCampaign = await campaignRepo.create({
        name: 'Other Campaign',
        targetProducts: [],
        rules: []
      }, 'test-user');

      await auditRepo.create({
        entityType: 'variant',
        entityId: 'gid://shopify/ProductVariant/123',
        changeType: 'price_update',
        oldValue: '19.99',
        newValue: '24.99',
        triggerReason: 'Campaign rule triggered',
        campaignId: testCampaignId
      });

      await auditRepo.create({
        entityType: 'variant',
        entityId: 'gid://shopify/ProductVariant/456',
        changeType: 'price_update',
        oldValue: '29.99',
        newValue: '34.99',
        triggerReason: 'Different campaign',
        campaignId: otherCampaign.id
      });

      const entries = await auditRepo.findByCampaign(testCampaignId);

      expect(entries).toHaveLength(1);
      expect(entries[0].campaignId).toBe(testCampaignId);
      expect(entries[0].entityId).toBe('gid://shopify/ProductVariant/123');
    });
  });

  describe('findByEntity', () => {
    it('should return audit entries for a specific entity', async () => {
      const entityId = 'gid://shopify/ProductVariant/123';
      
      // Create multiple audit entries for the same entity
      await auditRepo.create({
        entityType: 'variant',
        entityId: entityId,
        changeType: 'price_update',
        oldValue: '19.99',
        newValue: '24.99',
        triggerReason: 'First update',
        campaignId: testCampaignId
      });

      await auditRepo.create({
        entityType: 'variant',
        entityId: entityId,
        changeType: 'compare_at_update',
        oldValue: '29.99',
        newValue: '34.99',
        triggerReason: 'Second update',
        campaignId: testCampaignId
      });

      // Create entry for different entity
      await auditRepo.create({
        entityType: 'variant',
        entityId: 'gid://shopify/ProductVariant/456',
        changeType: 'price_update',
        oldValue: '39.99',
        newValue: '44.99',
        triggerReason: 'Different entity',
        campaignId: testCampaignId
      });

      const entries = await auditRepo.findByEntity('variant', entityId);

      expect(entries).toHaveLength(2);
      expect(entries[0].entityId).toBe(entityId);
      expect(entries[1].entityId).toBe(entityId);
      expect(entries[0].changeType).toBe('compare_at_update'); // Most recent first
      expect(entries[1].changeType).toBe('price_update');
    });
  });

  describe('findWithFilters', () => {
    beforeEach(async () => {
      // Create entries with different characteristics
      await auditRepo.create({
        entityType: 'variant',
        entityId: 'gid://shopify/ProductVariant/123',
        changeType: 'price_update',
        oldValue: '19.99',
        newValue: '24.99',
        triggerReason: 'Test reason 1',
        userId: 'user1',
        campaignId: testCampaignId
      });

      await auditRepo.create({
        entityType: 'product',
        entityId: 'gid://shopify/Product/789',
        changeType: 'status_change',
        newValue: 'active',
        triggerReason: 'Test reason 2',
        userId: 'user2',
        campaignId: testCampaignId
      });

      await auditRepo.create({
        entityType: 'variant',
        entityId: 'gid://shopify/ProductVariant/456',
        changeType: 'inventory_update',
        oldValue: '39.99',
        triggerReason: 'Test reason 3',
        userId: 'user1',
        campaignId: testCampaignId
      });
    });

    it('should filter by entity type', async () => {
      const variantEntries = await auditRepo.findWithFilters({
        entityType: 'variant',
        limit: 10
      });
      const productEntries = await auditRepo.findWithFilters({
        entityType: 'product',
        limit: 10
      });

      expect(variantEntries.entries).toHaveLength(2);
      expect(productEntries.entries).toHaveLength(1);
      expect(productEntries.entries[0].entityType).toBe('product');
    });

    it('should respect pagination', async () => {
      const firstPage = await auditRepo.findWithFilters({
        limit: 2,
        offset: 0
      });
      const secondPage = await auditRepo.findWithFilters({
        limit: 2,
        offset: 2
      });

      expect(firstPage.entries).toHaveLength(2);
      expect(secondPage.entries).toHaveLength(1);
      expect(firstPage.totalCount).toBe(3);
    });

    it('should filter by campaign', async () => {
      const campaignEntries = await auditRepo.findWithFilters({
        campaignId: testCampaignId,
        limit: 10
      });

      expect(campaignEntries.entries).toHaveLength(3);
      campaignEntries.entries.forEach(entry => {
        expect(entry.campaignId).toBe(testCampaignId);
      });
    });
  });

  describe('cleanup', () => {
    it('should delete entries older than specified date', async () => {
      const oldDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const recentDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

      // Create entries with different dates by manipulating the database directly
      await testPrisma.auditTrailEntry.create({
        data: {
          entityType: 'variant',
          entityId: 'old-variant',
          changeType: 'price_update',
          oldValue: '10.00',
          newValue: '15.00',
          triggerReason: 'Old entry',
          timestamp: oldDate,
          shopifyShopId: testShopId,
          campaignId: testCampaignId
        }
      });

      const recentEntry = await testPrisma.auditTrailEntry.create({
        data: {
          entityType: 'variant',
          entityId: 'recent-variant',
          changeType: 'price_update',
          oldValue: '20.00',
          newValue: '25.00',
          triggerReason: 'Recent entry',
          timestamp: recentDate,
          shopifyShopId: testShopId,
          campaignId: testCampaignId
        }
      });

      // Cleanup entries older than 3 days
      const cutoffDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const deletedCount = await auditRepo.cleanup(cutoffDate);

      expect(deletedCount).toBe(1);

      // Verify only recent entry remains
      const remainingEntries = await auditRepo.findWithFilters({ limit: 10 });
      expect(remainingEntries.entries).toHaveLength(1);
      expect(remainingEntries.entries[0].id).toBe(recentEntry.id);
    });
  });
});
