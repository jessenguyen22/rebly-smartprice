import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function simpleDebug() {
  try {
    // Count all records
    const counts = await Promise.all([
      prisma.campaign.count(),
      prisma.auditTrailEntry.count(),
      prisma.shopifyShop.count()
    ]);

    console.log('📊 Database counts:');
    console.log(`   Shops: ${counts[2]}`);
    console.log(`   Campaigns: ${counts[0]}`);
    console.log(`   Audit Entries: ${counts[1]}`);

    // Get shop details
    const shop = await prisma.shopifyShop.findFirst();
    if (shop) {
      console.log(`\n🏪 Shop found: ${shop.shopDomain}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

simpleDebug();
