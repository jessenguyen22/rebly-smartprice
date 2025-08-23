import { CampaignRepository } from './campaign.server';
import { AuditRepository } from './audit.server';
import { PricingJobRepository } from './pricing-job.server';

/**
 * Database Manager - Provides centralized repository management with connection optimization
 */
export class DatabaseManager {
  private campaignRepo?: CampaignRepository;
  private auditRepo?: AuditRepository;
  private pricingJobRepo?: PricingJobRepository;

  constructor(private shopId: string) {}

  // Singleton pattern for repositories to reuse connections
  getCampaignRepository(): CampaignRepository {
    if (!this.campaignRepo) {
      this.campaignRepo = new CampaignRepository(this.shopId);
    }
    return this.campaignRepo;
  }

  getAuditRepository(): AuditRepository {
    if (!this.auditRepo) {
      this.auditRepo = new AuditRepository(this.shopId);
    }
    return this.auditRepo;
  }

  getPricingJobRepository(): PricingJobRepository {
    if (!this.pricingJobRepo) {
      this.pricingJobRepo = new PricingJobRepository(this.shopId);
    }
    return this.pricingJobRepo;
  }

  /**
   * Load dashboard data with optimized database access
   */
  async getDashboardData() {
    const campaignRepo = this.getCampaignRepository();
    const auditRepo = this.getAuditRepository();
    const pricingJobRepo = this.getPricingJobRepository();

    try {
      // Execute queries with staggered timing to reduce connection pressure
      
      // Get only ACTIVE automated campaigns (not campaigns created for manual pricing jobs)
      // We'll filter out campaigns that are associated with pricing jobs
      const allActiveCampaigns = await campaignRepo.findByStatus('ACTIVE', 20);
      
      // Small delay to prevent connection flooding
      await new Promise(resolve => setTimeout(resolve, 10));
      const recentAuditEntries = await auditRepo.findRecent(50);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      // Get actual pricing jobs (manual operations)
      const recentJobs = await pricingJobRepo.findAll({ 
        limit: 10, 
        offset: 0,
        status: undefined,
        type: undefined,
        userId: undefined
      });
      
      await new Promise(resolve => setTimeout(resolve, 10));
      const jobCounts = await pricingJobRepo.count();

      // Filter out campaigns that are actually just tracking records for manual pricing jobs
      // Real automated campaigns should have meaningful names, descriptions, and be intended for automation
      const activeCampaigns = allActiveCampaigns.filter(campaign => {
        // Skip campaigns created from bulk pricing jobs (they start with "Bulk Pricing -")
        if (campaign.name && campaign.name.startsWith('Bulk Pricing -')) {
          return false; // Skip bulk pricing job tracking campaigns
        }
        
        // Skip campaigns with descriptions indicating they're from bulk operations
        if (campaign.description && (
          campaign.description.includes('Bulk pricing rule') ||
          campaign.description.includes('Manual pricing job')
        )) {
          return false; // Skip manual job tracking campaigns
        }
        
        // Skip campaigns with no meaningful rules
        if (!campaign.rules || campaign.rules.length === 0) {
          return false; // Skip campaigns with no rules
        }
        
        // Skip single-use campaigns (likely created for manual jobs)
        // Real automation campaigns should be designed for repeated use
        if (campaign.rules.length === 1 && campaign.description && 
            campaign.description.includes('->')) {
          return false; // Skip simple rule campaigns that look like job tracking
        }
        
        return true; // Keep real automated campaigns
      });

      return {
        activeCampaigns: activeCampaigns.slice(0, 5), // Limit to 5 real campaigns
        recentAuditEntries,
        recentJobs,
        jobCounts
      };
    } catch (error) {
      console.error('DatabaseManager: Error loading dashboard data:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources (if needed in the future)
   */
  cleanup() {
    this.campaignRepo = undefined;
    this.auditRepo = undefined;
    this.pricingJobRepo = undefined;
  }
}

/**
 * Factory function for creating database managers
 */
export const createDatabaseManager = (shopId: string) => {
  return new DatabaseManager(shopId);
};
