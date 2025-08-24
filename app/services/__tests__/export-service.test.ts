/**
 * Export Service Tests
 * 
 * Tests CSV/PDF export functionality with various data scenarios
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ExportService } from '../export-service.server';
import fs from 'fs';
import path from 'path';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock PDFKit
vi.mock('pdfkit', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      pipe: vi.fn(),
      fontSize: vi.fn().mockReturnThis(),
      text: vi.fn().mockReturnThis(),
      moveDown: vi.fn().mockReturnThis(),
      font: vi.fn().mockReturnThis(),
      end: vi.fn(),
      on: vi.fn((event, callback) => {
        if (event === 'end') {
          setTimeout(callback, 0);
        }
      }),
    })),
  };
});

describe('ExportService', () => {
  const mockResults = [
    {
      variantId: 'gid://shopify/ProductVariant/1',
      success: true,
      oldPrice: '15.00',
      newPrice: '20.00',
      productTitle: 'Test Product 1',
      variantTitle: 'Small / Blue',
      inventory: 50,
    },
    {
      variantId: 'gid://shopify/ProductVariant/2',
      success: false,
      error: 'Price validation failed',
      productTitle: 'Test Product 2',
      variantTitle: 'Large / Red',
      inventory: 25,
    },
    {
      variantId: 'gid://shopify/ProductVariant/3',
      success: true,
      oldPrice: '30.00',
      newPrice: '27.00',
      productTitle: 'Test Product 3',
      variantTitle: 'Medium / Green',
      inventory: 100,
      reason: 'Discount rule applied',
    },
  ];

  const mockJobData = {
    jobName: 'Test Pricing Job',
    createdAt: new Date('2024-08-24T10:00:00Z'),
    totalProcessed: 3,
    successCount: 2,
    failureCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (fs.existsSync as any).mockReturnValue(true);
    (fs.mkdirSync as any).mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('CSV Export', () => {
    it('generates CSV with correct headers', async () => {
      const service = new ExportService();
      await service.generateCSV(mockResults, mockJobData);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];

      expect(csvContent).toContain('Product Title,Variant,Status,Old Price,New Price,Inventory,Error/Reason');
    });

    it('formats successful results correctly in CSV', async () => {
      const service = new ExportService();
      await service.generateCSV(mockResults, mockJobData);

      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];

      expect(csvContent).toContain('Test Product 1,"Small / Blue",Success,$15.00,$20.00,50,');
      expect(csvContent).toContain('Test Product 3,"Medium / Green",Success,$30.00,$27.00,100,Discount rule applied');
    });

    it('formats failed results correctly in CSV', async () => {
      const service = new ExportService();
      await service.generateCSV(mockResults, mockJobData);

      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];

      expect(csvContent).toContain('Test Product 2,"Large / Red",Failed,,,25,Price validation failed');
    });

    it('includes summary statistics in CSV', async () => {
      const service = new ExportService();
      await service.generateCSV(mockResults, mockJobData);

      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];

      expect(csvContent).toContain('Job Summary');
      expect(csvContent).toContain('Total Processed,3');
      expect(csvContent).toContain('Successful Updates,2');
      expect(csvContent).toContain('Failed Updates,1');
    });

    it('handles empty results gracefully', async () => {
      const service = new ExportService();
      const emptyJobData = { ...mockJobData, totalProcessed: 0, successCount: 0, failureCount: 0 };
      
      await service.generateCSV([], emptyJobData);

      expect(fs.writeFileSync).toHaveBeenCalled();
      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];

      expect(csvContent).toContain('Total Processed,0');
    });

    it('escapes CSV special characters properly', async () => {
      const specialResults = [{
        variantId: 'gid://shopify/ProductVariant/1',
        success: true,
        productTitle: 'Product "With Quotes"',
        variantTitle: 'Size: Large, Color: "Red"',
        oldPrice: '15.00',
        newPrice: '20.00',
        inventory: 50,
      }];

      const service = new ExportService();
      await service.generateCSV(specialResults, mockJobData);

      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];

      expect(csvContent).toContain('"Product ""With Quotes"""');
      expect(csvContent).toContain('"Size: Large, Color: ""Red"""');
    });
  });

  describe('PDF Export', () => {
    it('generates PDF with correct structure', async () => {
      const service = new ExportService();
      const result = await service.generatePDF(mockResults, mockJobData);

      expect(result.filePath).toContain('.pdf');
      expect(result.fileName).toContain('pricing-job-export');
    });

    it('includes job summary in PDF', async () => {
      const service = new ExportService();
      await service.generatePDF(mockResults, mockJobData);

      // Verify PDF creation calls include summary information
      const PDFDocument = require('pdfkit');
      const mockDoc = PDFDocument.mock.results[0].value;
      
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining('Test Pricing Job'));
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining('Total Processed: 3'));
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining('Successful: 2'));
    });

    it('formats pricing changes correctly in PDF', async () => {
      const service = new ExportService();
      await service.generatePDF(mockResults, mockJobData);

      const PDFDocument = require('pdfkit');
      const mockDoc = PDFDocument.mock.results[0].value;
      
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining('$15.00 → $20.00'));
      expect(mockDoc.text).toHaveBeenCalledWith(expect.stringContaining('$30.00 → $27.00'));
    });

    it('handles PDF generation errors gracefully', async () => {
      const PDFDocument = require('pdfkit');
      PDFDocument.mockImplementation(() => {
        throw new Error('PDF generation failed');
      });

      const service = new ExportService();
      
      await expect(service.generatePDF(mockResults, mockJobData))
        .rejects.toThrow('PDF generation failed');
    });
  });

  describe('File Management', () => {
    it('creates export directory if it does not exist', async () => {
      (fs.existsSync as any).mockReturnValue(false);
      
      const service = new ExportService();
      await service.generateCSV(mockResults, mockJobData);

      expect(fs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('exports'),
        { recursive: true }
      );
    });

    it('generates unique file names for concurrent exports', async () => {
      const service = new ExportService();
      
      const [result1, result2] = await Promise.all([
        service.generateCSV(mockResults, { ...mockJobData, jobName: 'Job 1' }),
        service.generateCSV(mockResults, { ...mockJobData, jobName: 'Job 2' }),
      ]);

      expect(result1.fileName).not.toBe(result2.fileName);
      expect(result1.filePath).not.toBe(result2.filePath);
    });

    it('cleans up old export files', async () => {
      const service = new ExportService();
      const result = await service.generateCSV(mockResults, mockJobData);
      
      await service.cleanupExportFile(result.filePath);
      
      expect(fs.unlinkSync).toHaveBeenCalledWith(result.filePath);
    });

    it('handles cleanup errors gracefully', async () => {
      (fs.unlinkSync as any).mockImplementation(() => {
        throw new Error('File not found');
      });

      const service = new ExportService();
      
      // Should not throw error
      await expect(service.cleanupExportFile('nonexistent-file.csv'))
        .resolves.not.toThrow();
    });
  });

  describe('Data Validation', () => {
    it('validates required job data fields', async () => {
      const service = new ExportService();
      const invalidJobData = { ...mockJobData, jobName: '' };
      
      await expect(service.generateCSV(mockResults, invalidJobData))
        .rejects.toThrow('Job name is required');
    });

    it('handles missing optional fields gracefully', async () => {
      const resultsWithMissingFields = [{
        variantId: 'gid://shopify/ProductVariant/1',
        success: true,
        productTitle: 'Test Product',
        // Missing variantTitle, prices, inventory
      }];

      const service = new ExportService();
      
      await expect(service.generateCSV(resultsWithMissingFields, mockJobData))
        .resolves.toBeDefined();
        
      const writeCall = (fs.writeFileSync as any).mock.calls[0];
      const csvContent = writeCall[1];
      
      expect(csvContent).toContain('Test Product,,Success,,,');
    });

    it('validates result data types', async () => {
      const invalidResults = [{
        variantId: 123, // Should be string
        success: 'true', // Should be boolean
        productTitle: null, // Should be string
      }];

      const service = new ExportService();
      
      await expect(service.generateCSV(invalidResults as any, mockJobData))
        .rejects.toThrow('Invalid result data format');
    });
  });

  describe('Performance Testing', () => {
    it('handles large datasets efficiently', async () => {
      // Generate 1000 mock results
      const largeResultSet = Array.from({ length: 1000 }, (_, index) => ({
        variantId: `gid://shopify/ProductVariant/${index + 1}`,
        success: index % 3 !== 0, // 2/3 success rate
        oldPrice: `${(Math.random() * 100).toFixed(2)}`,
        newPrice: `${(Math.random() * 100).toFixed(2)}`,
        productTitle: `Product ${index + 1}`,
        variantTitle: `Variant ${index + 1}`,
        inventory: Math.floor(Math.random() * 200),
        ...(index % 3 === 0 && { error: 'Test error' }),
      }));

      const largeJobData = {
        ...mockJobData,
        totalProcessed: 1000,
        successCount: 667,
        failureCount: 333,
      };

      const service = new ExportService();
      const startTime = Date.now();
      
      await service.generateCSV(largeResultSet, largeJobData);
      
      const executionTime = Date.now() - startTime;
      
      // Should complete within reasonable time (5 seconds for 1000 records)
      expect(executionTime).toBeLessThan(5000);
      expect(fs.writeFileSync).toHaveBeenCalled();
    });

    it('streams large PDF exports efficiently', async () => {
      const largeResultSet = Array.from({ length: 500 }, (_, index) => ({
        variantId: `gid://shopify/ProductVariant/${index + 1}`,
        success: true,
        oldPrice: `${(Math.random() * 100).toFixed(2)}`,
        newPrice: `${(Math.random() * 100).toFixed(2)}`,
        productTitle: `Product ${index + 1}`,
        variantTitle: `Variant ${index + 1}`,
        inventory: Math.floor(Math.random() * 200),
      }));

      const service = new ExportService();
      const startTime = Date.now();
      
      await service.generatePDF(largeResultSet, mockJobData);
      
      const executionTime = Date.now() - startTime;
      
      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(10000);
    });
  });
});
