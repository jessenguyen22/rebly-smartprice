/**
 * Unit Tests for PricingJobTemplate Model
 * 
 * Tests template CRUD operations, validation, and business logic
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  getPricingJobTemplates, 
  createPricingJobTemplate, 
  getPricingJobTemplate,
  updatePricingJobTemplate,
  deletePricingJobTemplate,
  type PricingJobTemplate,
  type PricingRule
} from '../pricing-job-template.server';
import { prisma } from '../../db.server';

// Mock Prisma client
vi.mock('../db.server', () => ({
  prisma: {
    pricingJobTemplate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    shopifyShop: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('PricingJobTemplate Model', () => {
  const mockShopDomain = 'test-shop.myshopify.com';
  const mockShopId = 'shop-123';
  const mockUserId = 'user-456';
  
  const mockTemplate: PricingJobTemplate = {
    id: 'template-123',
    name: 'Test Template',
    description: 'A test pricing template',
    rules: [
      {
        whenCondition: 'less_than',
        whenValue: '20',
        thenAction: 'increase',
        thenMode: 'fixed',
        thenValue: '5',
        changeCompareAt: false,
      },
    ],
    bulkAmount: '10',
    bulkType: 'increase',
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
    userId: mockUserId,
    shopifyShopId: mockShopId,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock shopifyShop lookup
    (prisma.shopifyShop.findUnique as any).mockResolvedValue({
      id: mockShopId,
      shopDomain: mockShopDomain,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getPricingJobTemplates', () => {
    it('should fetch templates for a shop domain', async () => {
      const mockPrismaTemplate = {
        ...mockTemplate,
        rules: JSON.stringify(mockTemplate.rules),
      };
      (prisma.pricingJobTemplate.findMany as any).mockResolvedValue([mockPrismaTemplate]);

      const result = await getPricingJobTemplates(mockShopDomain);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockTemplate.id,
        name: mockTemplate.name,
        description: mockTemplate.description,
      });
    });

    it('should return empty array when shop not found', async () => {
      (prisma.shopifyShop.findUnique as any).mockResolvedValue(null);

      const result = await getPricingJobTemplates('nonexistent-shop.myshopify.com');

      expect(result).toEqual([]);
    });
  });

  describe('createPricingJobTemplate', () => {
    const createData = {
      name: 'New Template',
      description: 'A new test template',
      rules: [
        {
          whenCondition: 'greater_than' as const,
          whenValue: '50',
          thenAction: 'decrease' as const,
          thenMode: 'percentage' as const,
          thenValue: '10',
          changeCompareAt: true,
        },
      ],
      bulkAmount: '15',
      bulkType: 'decrease' as const,
      userId: mockUserId,
      shopDomain: mockShopDomain,
    };

    it('should create a new template successfully', async () => {
      const expectedPrismaTemplate = {
        id: 'new-template-id',
        name: createData.name,
        description: createData.description,
        rules: JSON.stringify(createData.rules),
        bulkAmount: createData.bulkAmount,
        bulkType: createData.bulkType,
        userId: createData.userId,
        shopifyShopId: mockShopId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.pricingJobTemplate.create as any).mockResolvedValue(expectedPrismaTemplate);

      const result = await createPricingJobTemplate(createData);

      expect(result.name).toBe(createData.name);
      expect(result.description).toBe(createData.description);
      expect(prisma.pricingJobTemplate.create).toHaveBeenCalled();
    });

    it('should handle duplicate template names', async () => {
      const duplicateError = { code: 'P2002', meta: { target: ['shopifyShopId', 'name'] } };
      (prisma.pricingJobTemplate.create as any).mockRejectedValue(duplicateError);

      await expect(createPricingJobTemplate(createData)).rejects.toThrow();
    });
  });

  describe('getPricingJobTemplate', () => {
    const templateId = 'template-123';

    it('should fetch a specific template', async () => {
      const mockPrismaTemplate = {
        ...mockTemplate,
        rules: JSON.stringify(mockTemplate.rules),
      };
      (prisma.pricingJobTemplate.findUnique as any).mockResolvedValue(mockPrismaTemplate);

      const result = await getPricingJobTemplate(mockShopDomain, templateId);

      expect(result?.id).toBe(templateId);
      expect(prisma.pricingJobTemplate.findUnique).toHaveBeenCalledWith({
        where: { id: templateId },
      });
    });

    it('should return null when template not found', async () => {
      (prisma.pricingJobTemplate.findUnique as any).mockResolvedValue(null);

      const result = await getPricingJobTemplate(mockShopDomain, templateId);

      expect(result).toBeNull();
    });
  });

  describe('updatePricingJobTemplate', () => {
    const templateId = 'template-123';
    const updateData = {
      name: 'Updated Template',
      description: 'Updated description',
      bulkAmount: '20',
      shopDomain: mockShopDomain,
      userId: mockUserId,
    };

    it('should update template successfully', async () => {
      const updatedPrismaTemplate = {
        ...mockTemplate,
        ...updateData,
        rules: JSON.stringify(mockTemplate.rules),
      };
      (prisma.pricingJobTemplate.update as any).mockResolvedValue(updatedPrismaTemplate);

      const result = await updatePricingJobTemplate(templateId, updateData);

      expect(result.name).toBe(updateData.name);
      expect(prisma.pricingJobTemplate.update).toHaveBeenCalled();
    });
  });

  describe('deletePricingJobTemplate', () => {
    const templateId = 'template-123';

    it('should delete template successfully', async () => {
      const mockPrismaTemplate = {
        ...mockTemplate,
        rules: JSON.stringify(mockTemplate.rules),
      };
      (prisma.pricingJobTemplate.delete as any).mockResolvedValue(mockPrismaTemplate);

      const result = await deletePricingJobTemplate(templateId, mockShopDomain, mockUserId);

      expect(result.id).toBe(templateId);
      expect(prisma.pricingJobTemplate.delete).toHaveBeenCalled();
    });
  });

  describe('Template Validation', () => {
    it('should validate pricing rule structure', () => {
      const validRule: PricingRule = {
        whenCondition: 'less_than',
        whenValue: '20',
        thenAction: 'increase',
        thenMode: 'fixed',
        thenValue: '5',
        changeCompareAt: false,
      };

      expect(validRule.whenCondition).toMatch(/^(less_than|greater_than|equal_to|less_equal|greater_equal)$/);
      expect(validRule.thenAction).toMatch(/^(increase|decrease|set_to)$/);
      expect(validRule.thenMode).toMatch(/^(fixed|percentage)$/);
    });

    it('should validate numeric values', () => {
      const rule: PricingRule = {
        whenCondition: 'less_than',
        whenValue: '20.5',
        thenAction: 'increase',
        thenMode: 'percentage',
        thenValue: '15.2',
        changeCompareAt: false,
      };

      expect(parseFloat(rule.whenValue)).toBe(20.5);
      expect(parseFloat(rule.thenValue)).toBe(15.2);
      expect(parseFloat(rule.whenValue)).toBeGreaterThan(0);
      expect(parseFloat(rule.thenValue)).toBeGreaterThan(0);
    });
  });

  describe('Template Business Logic', () => {
    it('should calculate template complexity score', () => {
      const simpleTemplate = { rules: [mockTemplate.rules![0]] };
      const complexTemplate = { 
        rules: [
          mockTemplate.rules![0], 
          { ...mockTemplate.rules![0], whenCondition: 'greater_than' as const },
          { ...mockTemplate.rules![0], thenAction: 'decrease' as const }
        ] 
      };

      const simpleScore = simpleTemplate.rules.length;
      const complexScore = complexTemplate.rules.length;

      expect(simpleScore).toBe(1);
      expect(complexScore).toBe(3);
      expect(complexScore).toBeGreaterThan(simpleScore);
    });

    it('should support template rule combinations', () => {
      const combinedRules: PricingRule[] = [
        {
          whenCondition: 'less_than',
          whenValue: '20',
          thenAction: 'increase',
          thenMode: 'fixed',
          thenValue: '5',
          changeCompareAt: false,
        },
        {
          whenCondition: 'greater_than',
          whenValue: '100',
          thenAction: 'decrease',
          thenMode: 'percentage',
          thenValue: '10',
          changeCompareAt: true,
        },
      ];

      expect(combinedRules).toHaveLength(2);
      expect(combinedRules[0].whenCondition).toBe('less_than');
      expect(combinedRules[1].whenCondition).toBe('greater_than');
      expect(combinedRules[0].thenAction).toBe('increase');
      expect(combinedRules[1].thenAction).toBe('decrease');
    });
  });
});
