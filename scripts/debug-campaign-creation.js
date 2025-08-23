/**
 * Debug script to check campaign cr    // Check database models
    console.log('\n📊 Available database models:');
    console.log(Object.keys(prisma).filter(key => !key.startsWith('$')).sort());

    // Check recent audit trail entries
    const auditEntries = await prisma.auditTrailEntry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        shopDomain: true,
        createdAt: true,
        metadata: true
      }
    });

    console.log(`\n📝 Recent audit trail entries: ${auditEntries.length}`);
    auditEntries.forEach(entry => {
      console.log(`   ${entry.action} on ${entry.entityType}:${entry.entityId}`);
      console.log(`   Shop: ${entry.shopDomain}, Time: ${entry.createdAt}`);
      if (entry.metadata) {
        console.log(`   Metadata: ${JSON.stringify(entry.metadata).substring(0, 100)}...`);
      }
    });ion and shop domains
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugCampaignCreation() {
  try {
    console.log('🔍 Debugging campaign creation and shop data...\n');

    // Check all shops
    const shops = await prisma.shopifyShop.findMany({
      select: {
        shopDomain: true,
        accessToken: true,
        createdAt: true,
        campaigns: {
          select: {
            id: true,
            name: true,
            status: true,
            createdAt: true
          }
        }
      }
    });

    console.log(`📦 Total shops found: ${shops.length}`);
    
    for (const shop of shops) {
      console.log(`\n🏪 Shop: ${shop.shopDomain}`);
      console.log(`   Access token: ${shop.accessToken ? 'Present' : 'Missing'}`);
      console.log(`   Created: ${shop.createdAt}`);
      console.log(`   Campaigns: ${shop.campaigns.length}`);
      
      shop.campaigns.forEach(campaign => {
        console.log(`     📋 ${campaign.name} (${campaign.status}) - ${campaign.createdAt}`);
      });
    }

    // Check database models
    console.log('\n� Available database models:');
    console.log(Object.keys(prisma).filter(key => !key.startsWith('$')).sort());

    console.log('\n✅ Debug complete');

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugCampaignCreation();
