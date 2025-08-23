import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function testDatabaseConnection() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL');
    
    // Create a test shop if none exists
    const existingShop = await prisma.shopifyShop.findFirst();
    
    if (!existingShop) {
      const testShop = await prisma.shopifyShop.create({
        data: {
          shopDomain: 'test-shop.myshopify.com',
          accessToken: 'test-token',
          scopes: 'read_products,write_products',
          country: 'US',
          currency: 'USD',
          timezone: 'America/New_York'
        }
      });
      
      console.log('✅ Created test shop:', testShop.shopDomain);
    } else {
      console.log('✅ Found existing shop:', existingShop.shopDomain);
    }
    
    // Test counting records
    const campaignCount = await prisma.campaign.count();
    const auditCount = await prisma.auditTrailEntry.count();
    const jobCount = await prisma.pricingJob.count();
    
    console.log(`📊 Database stats:
    - Campaigns: ${campaignCount}
    - Audit entries: ${auditCount} 
    - Pricing jobs: ${jobCount}
    `);
    
    console.log('🎉 Database setup is working correctly!');
    
  } catch (error) {
    console.error('❌ Database test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabaseConnection();
