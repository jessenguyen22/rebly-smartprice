/**
 * Integration Tests for Existing Pricing Job Workflows
 * 
 * Validates that enhanced features don't break existing functionality
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PricingJobRepository } from '../pricing-job.server';
import { prisma } from '../../db.server';

// Mock Prisma client
vi.mock('../../db.server', () => ({
  prisma: {
    pricingJob: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    processingResult: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    selectedVariant: {
      createMany: vi.fn(),
      findMany: vi.fn(),
    },
    shopifyShop: {
      findUnique: vi.fn(),
    },
    auditTrailEntry: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

describe('Pricing Job Workflows - Backward Compatibility', () => {
  const mockShopDomain = 'test-shop.myshopify.com';
  const mockShopId = 'shop-123';

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

  describe('Legacy Pricing Job Creation', () => {
    it('creates pricing job without template (legacy behavior)', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      const mockJob = {
        id: 'job-123',
        name: 'Manual Price Update',
        type: 'MANUAL',
        status: 'PENDING',
        shopifyShopId: mockShopId,
        templateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.pricingJob.create as any).mockResolvedValue(mockJob);

      const result = await repo.create({
        name: 'Manual Price Update',
        type: 'MANUAL',
        userId: 'user-123',
      });

      expect(result.id).toBe('job-123');
      expect(result.templateId).toBeNull();
      expect(prisma.pricingJob.create).toHaveBeenCalledWith({
        data: {
          name: 'Manual Price Update',
          type: 'MANUAL',
          userId: 'user-123',
          shopifyShopId: mockShopId,
          templateId: null,
        },
      });
    });

    it('creates pricing job with template (enhanced behavior)', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      const mockJob = {
        id: 'job-456',
        name: 'Template-Based Update',
        type: 'MANUAL',
        status: 'PENDING',
        shopifyShopId: mockShopId,
        templateId: 'template-789',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      (prisma.pricingJob.create as any).mockResolvedValue(mockJob);

      const result = await repo.create({
        name: 'Template-Based Update',
        type: 'MANUAL',
        userId: 'user-123',
        templateId: 'template-789',
      });

      expect(result.id).toBe('job-456');
      expect(result.templateId).toBe('template-789');
      expect(prisma.pricingJob.create).toHaveBeenCalledWith({
        data: {
          name: 'Template-Based Update',
          type: 'MANUAL',
          userId: 'user-123',
          shopifyShopId: mockShopId,
          templateId: 'template-789',
        },
      });
    });
  });

  describe('Legacy Job Status Management', () => {
    it('updates job status without breaking existing patterns', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      const jobId = 'job-123';
      
      const mockUpdatedJob = {
        id: jobId,
        status: 'COMPLETED',
        updatedAt: new Date(),
      };
      
      (prisma.pricingJob.update as any).mockResolvedValue(mockUpdatedJob);

      await repo.updateStatus(jobId, 'COMPLETED', {
        processedCount: 10,
        successCount: 8,
        errorCount: 2,
      });

      expect(prisma.pricingJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: 'COMPLETED',
          processedCount: 10,
          successCount: 8,
          errorCount: 2,
          completedAt: expect.any(Date),
        },
      });
    });

    it('handles job cancellation (existing workflow)', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      const jobId = 'job-123';
      
      const mockCancelledJob = {
        id: jobId,
        status: 'CANCELLED',
        updatedAt: new Date(),
      };
      
      (prisma.pricingJob.update as any).mockResolvedValue(mockCancelledJob);

      await repo.updateStatus(jobId, 'CANCELLED');

      expect(prisma.pricingJob.update).toHaveBeenCalledWith({
        where: { id: jobId },
        data: {
          status: 'CANCELLED',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('Legacy Processing Results Storage', () => {
    it('stores processing results without template metadata (legacy)', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      const jobId = 'job-123';
      
      const legacyResults = [
        {
          pricingJobId: jobId,
          variantId: 'variant-1',
          success: true,
          oldPrice: '15.00',
          newPrice: '20.00',
          processedAt: new Date(),
        },
        {
          pricingJobId: jobId,
          variantId: 'variant-2',
          success: false,
          errorMessage: 'Insufficient inventory',
          processedAt: new Date(),
        },
      ];
      
      (prisma.processingResult.createMany as any).mockResolvedValue({ count: 2 });

      await repo.saveResults(jobId, legacyResults);

      expect(prisma.processingResult.createMany).toHaveBeenCalledWith({
        data: legacyResults,
      });
    });

    it('retrieves processing results maintaining legacy format', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      const jobId = 'job-123';
      
      const mockResults = [
        {
          id: 'result-1',
          pricingJobId: jobId,
          variantId: 'variant-1',
          success: true,
          oldPrice: '15.00',
          newPrice: '20.00',
          processedAt: new Date(),
        },
        {
          id: 'result-2',
          pricingJobId: jobId,
          variantId: 'variant-2',
          success: false,
          errorMessage: 'Price validation failed',
          processedAt: new Date(),
        },
      ];
      
      (prisma.processingResult.findMany as any).mockResolvedValue(mockResults);

      const results = await repo.getResults(jobId);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        variantId: 'variant-1',
        success: true,
        oldPrice: '15.00',
        newPrice: '20.00',
      });
      expect(results[1]).toMatchObject({
        variantId: 'variant-2',
        success: false,
        errorMessage: 'Price validation failed',
      });
    });
  });

  describe('Legacy Job Queries', () => {
    it('finds jobs by shop maintaining existing query patterns', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      const mockJobs = [
        {
          id: 'job-1',
          name: 'Legacy Job 1',
          type: 'MANUAL',
          status: 'COMPLETED',
          templateId: null,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'job-2',
          name: 'Enhanced Job 2',
          type: 'MANUAL', 
          status: 'COMPLETED',
          templateId: 'template-123',
          createdAt: new Date('2024-01-02'),
        },
      ];
      
      (prisma.pricingJob.findMany as any).mockResolvedValue(mockJobs);

      const jobs = await repo.findByShop();

      expect(jobs).toHaveLength(2);
      expect(jobs[0].templateId).toBeNull(); // Legacy job
      expect(jobs[1].templateId).toBe('template-123'); // Enhanced job
      
      expect(prisma.pricingJob.findMany).toHaveBeenCalledWith({
        where: { shopifyShopId: mockShopId },
        orderBy: { createdAt: 'desc' },
        include: { template: true },
      });
    });

    it('finds job by ID with backward compatibility', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      const jobId = 'job-123';
      
      const mockJob = {
        id: jobId,
        name: 'Test Job',
        type: 'MANUAL',
        status: 'COMPLETED',
        templateId: null,
        shopifyShopId: mockShopId,
        template: null,
      };
      
      (prisma.pricingJob.findUnique as any).mockResolvedValue(mockJob);

      const job = await repo.findById(jobId);

      expect(job?.id).toBe(jobId);
      expect(job?.templateId).toBeNull();
      expect(job?.template).toBeNull();
    });
  });

  describe('Enhanced Features Compatibility', () => {
    it('enhanced findByIdWithTemplate works with legacy jobs', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      const jobId = 'job-123';
      
      const mockLegacyJob = {
        id: jobId,
        name: 'Legacy Job',
        templateId: null,
        template: null,
        shopifyShopId: mockShopId,
      };
      
      (prisma.pricingJob.findUnique as any).mockResolvedValue(mockLegacyJob);

      const job = await repo.findByIdWithTemplate(jobId);

      expect(job?.id).toBe(jobId);
      expect(job?.template).toBeNull();
      expect(prisma.pricingJob.findUnique).toHaveBeenCalledWith({
        where: { id: jobId },
        include: { template: true },
      });
    });

    it('performance metrics include legacy jobs in calculations', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      const mockMetrics = {
        totalJobs: 10,
        successfulJobs: 8,
        avgProcessingTime: 120,
        templateJobs: 3, // 3 with templates, 7 legacy
        legacyJobs: 7,
      };
      
      // Mock the complex query for performance metrics
      (prisma.$transaction as any).mockResolvedValue([
        { count: 10 }, // total jobs
        { count: 8 },  // successful
        { avg: 120 },  // avg time
        { count: 3 },  // template jobs
      ]);

      const metrics = await repo.getShopPerformanceSummary(30);

      expect(metrics).toBeDefined();
      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('Data Migration Scenarios', () => {
    it('handles jobs created before template feature', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      // Simulate pre-enhancement job structure
      const preEnhancementJob = {
        id: 'old-job-123',
        name: 'Pre-Enhancement Job',
        type: 'MANUAL',
        status: 'COMPLETED',
        shopifyShopId: mockShopId,
        templateId: null, // This field didn't exist before
        createdAt: new Date('2023-12-01'), // Before enhancements
        updatedAt: new Date('2023-12-01'),
      };
      
      (prisma.pricingJob.findUnique as any).mockResolvedValue(preEnhancementJob);

      const job = await repo.findById('old-job-123');

      expect(job).toBeDefined();
      expect(job?.templateId).toBeNull();
      expect(job?.createdAt).toEqual(new Date('2023-12-01'));
    });

    it('gracefully handles missing template references', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      // Job with templateId but template was deleted
      const jobWithMissingTemplate = {
        id: 'job-with-missing-template',
        name: 'Orphaned Template Job',
        templateId: 'deleted-template-id',
        template: null, // Template was deleted
        shopifyShopId: mockShopId,
      };
      
      (prisma.pricingJob.findUnique as any).mockResolvedValue(jobWithMissingTemplate);

      const job = await repo.findByIdWithTemplate('job-with-missing-template');

      expect(job).toBeDefined();
      expect(job?.templateId).toBe('deleted-template-id');
      expect(job?.template).toBeNull();
    });
  });

  describe('Error Handling Backward Compatibility', () => {
    it('maintains existing error handling patterns', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      const dbError = new Error('Database connection failed');
      (prisma.pricingJob.create as any).mockRejectedValue(dbError);

      await expect(repo.create({
        name: 'Test Job',
        type: 'MANUAL',
        userId: 'user-123',
      })).rejects.toThrow('Database connection failed');
    });

    it('enhanced error handling does not affect legacy operations', async () => {
      const repo = new PricingJobRepository(mockShopDomain);
      
      // Simulate Prisma unique constraint error (existing behavior)
      const constraintError = { code: 'P2002', meta: { target: ['name'] } };
      (prisma.pricingJob.create as any).mockRejectedValue(constraintError);

      await expect(repo.create({
        name: 'Duplicate Job Name',
        type: 'MANUAL',
        userId: 'user-123',
      })).rejects.toMatchObject({
        code: 'P2002',
      });
    });
  });
});
