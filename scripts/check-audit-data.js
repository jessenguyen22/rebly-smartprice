import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function checkAuditData() {
  try {
    console.log('🔍 Kiểm tra dữ liệu audit trail...\n');

    // 0. Kiểm tra tất cả shops có trong database
    console.log('🏪 TẤT CẢ SHOPS TRONG DATABASE:');
    const allShops = await prisma.shopifyShop.findMany();
    allShops.forEach(shop => {
      console.log(`- Shop Domain: ${shop.shopDomain}`);
      console.log(`  ID: ${shop.id}`);
      console.log(`  Created: ${shop.createdAt}`);
      console.log('');
    });

    // 1. Kiểm tra campaigns đã tạo
    console.log('📋 TẤT CẢ CAMPAIGNS:');
    const campaigns = await prisma.campaign.findMany({
      include: {
        shopifyShop: true,
        rules: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Tìm thấy ${campaigns.length} campaigns:`);
    campaigns.forEach(campaign => {
      console.log(`- Campaign: ${campaign.name}`);
      console.log(`  Shop: ${campaign.shopifyShop.shopDomain}`);
      console.log(`  Status: ${campaign.status}`);
      console.log(`  Trigger Count: ${campaign.triggerCount}`);
      console.log(`  Rules: ${campaign.rules.length} rule(s)`);
      console.log(`  Created: ${campaign.createdAt}`);
      console.log('');
    });

    // 2. Kiểm tra tất cả audit trail entries
    console.log('📝 TẤT CẢ AUDIT TRAIL ENTRIES:');
    const allAuditEntries = await prisma.auditTrailEntry.findMany({
      include: {
        shopifyShop: true
      },
      orderBy: { timestamp: 'desc' }
    });

    console.log(`Tìm thấy ${allAuditEntries.length} audit entries:`);

    // Lấy thông tin campaign riêng
    const campaignIds = [...new Set(allAuditEntries.map(e => e.campaignId).filter(Boolean))];
    const campaignsMap = new Map();
    if (campaignIds.length > 0) {
      const campaignData = await prisma.campaign.findMany({
        where: { id: { in: campaignIds } }
      });
      campaignData.forEach(c => campaignsMap.set(c.id, c));
    }

    allAuditEntries.forEach((entry, index) => {
      const campaign = entry.campaignId ? campaignsMap.get(entry.campaignId) : null;
      console.log(`${index + 1}. Entity: ${entry.entityType} (${entry.entityId})`);
      console.log(`   Change Type: ${entry.changeType}`);
      console.log(`   Values: ${entry.oldValue} → ${entry.newValue}`);
      console.log(`   Reason: ${entry.triggerReason}`);
      console.log(`   Campaign: ${campaign?.name || 'N/A'}`);
      console.log(`   Shop: ${entry.shopifyShop.shopDomain}`);
      console.log(`   Time: ${entry.timestamp}`);
      if (entry.metadata) {
        console.log(`   Metadata: ${JSON.stringify(entry.metadata, null, 2)}`);
      }
      console.log('');
    });

    // 3. Kiểm tra pricing jobs
    console.log('🔧 PRICING JOBS:');
    const pricingJobs = await prisma.pricingJob.findMany({
      include: {
        shopifyShop: true
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Tìm thấy ${pricingJobs.length} pricing jobs:`);
    pricingJobs.forEach(job => {
      console.log(`- Job: ${job.id}`);
      console.log(`  Type: ${job.jobType}`);
      console.log(`  Status: ${job.status}`);
      console.log(`  Shop: ${job.shopifyShop.shopDomain}`);
      console.log(`  Variants: ${job.totalVariants}`);
      console.log(`  Successful: ${job.successfulUpdates}`);
      console.log(`  Created: ${job.createdAt}`);
      console.log('');
    });

    // 3. Thống kê tổng quan
    console.log('📊 THỐNG KÊ TỔNG QUAN:');
    const totalCampaigns = await prisma.campaign.count();
    const totalAuditEntries = await prisma.auditTrailEntry.count();
    const priceChanges = await prisma.auditTrailEntry.count({
      where: { changeType: 'price_update' }
    });

    console.log(`- Tổng campaigns: ${totalCampaigns}`);
    console.log(`- Tổng audit entries: ${totalAuditEntries}`);
    console.log(`- Price changes: ${priceChanges}`);

    // 4. Kiểm tra shops
    console.log('\n🏪 SHOPS:');
    const shops = await prisma.shopifyShop.findMany({
      include: {
        campaigns: true,
        auditTrailEntries: true
      }
    });

    shops.forEach(shop => {
      console.log(`- Shop: ${shop.shopDomain}`);
      console.log(`  Campaigns: ${shop.campaigns.length}`);
      console.log(`  Audit entries: ${shop.auditTrailEntries.length}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ Error checking audit data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Chạy script
checkAuditData().then(() => {
  console.log('✅ Hoàn thành kiểm tra dữ liệu!');
}).catch(console.error);
