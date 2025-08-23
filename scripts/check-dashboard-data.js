// Check current database state for pricing jobs vs campaigns
import { PrismaClient } from '@prisma/client';

// Configure DATABASE_URL with connection pooling parameters
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  
  const url = new URL(baseUrl);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '5');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }
  
  return url.toString();
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

const checkDashboardData = async () => {
  console.log('🔍 Checking current database state...\n');
  
  try {
    // Get all shops
    const shops = await prisma.shopifyShop.findMany();
    console.log(`📊 Found ${shops.length} shops in database:\n`);
    
    for (const shop of shops) {
      console.log(`🏪 Shop: ${shop.shopDomain}`);
      console.log(`   Created: ${shop.createdAt.toLocaleString()}\n`);
      
      // Check campaigns for this shop
      console.log('📊 CAMPAIGNS:');
      const campaigns = await prisma.campaign.findMany({
        where: { shopifyShopId: shop.id },
        include: { rules: true },
        orderBy: { createdAt: 'desc' }
      });
      
      if (campaigns.length === 0) {
        console.log('  ❌ No campaigns found!\n');
      } else {
        campaigns.forEach(campaign => {
          console.log(`  • ${campaign.name} (${campaign.status})`);
          console.log(`    Description: ${campaign.description || 'N/A'}`);
          console.log(`    Rules: ${campaign.rules.length}`);
          console.log(`    Created: ${campaign.createdAt.toLocaleString()}`);
          console.log('');
        });
      }
      
      // Check pricing jobs for this shop
      console.log('💼 PRICING JOBS:');
      const pricingJobs = await prisma.pricingJob.findMany({
        where: { shopifyShopId: shop.id },
        include: { 
          selectedVariants: true,
          rules: true,
          processingResults: true 
        },
        orderBy: { createdAt: 'desc' }
      });
      
      if (pricingJobs.length === 0) {
        console.log('  ❌ No pricing jobs found!\n');
      } else {
        pricingJobs.forEach(job => {
          console.log(`  • ${job.name} (${job.status})`);
          console.log(`    Type: ${job.type}`);
          console.log(`    Total Variants: ${job.totalVariants}`);
          console.log(`    Selected Variants: ${job.selectedVariants.length}`);
          console.log(`    Rules: ${job.rules.length}`);
          console.log(`    Processing Results: ${job.processingResults.length}`);
          console.log(`    Created: ${job.createdAt.toLocaleString()}`);
          console.log('');
        });
      }
      
      // Check audit entries for this shop
      console.log('📋 RECENT AUDIT ENTRIES:');
      const auditEntries = await prisma.auditTrailEntry.findMany({
        where: { shopifyShopId: shop.id },
        orderBy: { timestamp: 'desc' },
        take: 5
      });
      
      if (auditEntries.length === 0) {
        console.log('  ❌ No audit entries found!\n');
      } else {
        auditEntries.forEach(entry => {
          console.log(`  • ${entry.changeType} on ${entry.entityType} ${entry.entityId}`);
          console.log(`    Trigger: ${entry.triggerReason}`);
          console.log(`    Campaign ID: ${entry.campaignId || 'N/A'}`);
          console.log(`    Pricing Job ID: ${entry.pricingJobId || 'N/A'}`);
          console.log(`    Time: ${entry.timestamp.toLocaleString()}`);
          console.log('');
        });
      }
      
      console.log('─'.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
};

checkDashboardData();
