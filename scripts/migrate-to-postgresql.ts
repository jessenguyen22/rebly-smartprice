/**
 * Database Migration Script
 * Transfers session data from SQLite to PostgreSQL
 */

import { PrismaClient as SQLiteClient } from '@prisma/client';
import { PrismaClient as PostgreSQLClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// SQLite client (original database)
const sqliteClient = new SQLiteClient({
  datasources: {
    db: {
      url: 'file:dev.sqlite'
    }
  }
});

// PostgreSQL client (new database)
const postgresClient = new PostgreSQLClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://username:password@localhost:5432/rebly_smartprice'
    }
  }
});

interface SessionData {
  id: string;
  shop: string;
  state: string;
  isOnline: boolean;
  scope?: string;
  expires?: Date;
  accessToken: string;
  userId?: bigint;
  firstName?: string;
  lastName?: string;
  email?: string;
  accountOwner: boolean;
  locale?: string;
  collaborator?: boolean;
  emailVerified?: boolean;
}

export async function migrateSessions() {
  console.log('🚀 Starting session migration from SQLite to PostgreSQL...');
  
  try {
    // Check if SQLite database exists
    const sqliteDbPath = path.join(process.cwd(), 'prisma', 'dev.sqlite');
    if (!fs.existsSync(sqliteDbPath)) {
      console.log('📝 No SQLite database found. Starting fresh with PostgreSQL.');
      return { migrated: 0, skipped: 0 };
    }

    // Connect to both databases
    await sqliteClient.$connect();
    await postgresClient.$connect();
    
    console.log('✅ Connected to both databases');

    // Fetch all sessions from SQLite
    const sessions = await sqliteClient.session.findMany();
    console.log(`📋 Found ${sessions.length} sessions to migrate`);

    if (sessions.length === 0) {
      console.log('📝 No sessions to migrate. Database is empty.');
      return { migrated: 0, skipped: 0 };
    }

    let migratedCount = 0;
    let skippedCount = 0;

    // Migrate each session
    for (const session of sessions) {
      try {
        // Check if session already exists in PostgreSQL
        const existingSession = await postgresClient.session.findUnique({
          where: { id: session.id }
        });

        if (existingSession) {
          console.log(`⏭️  Skipping session ${session.id} (already exists)`);
          skippedCount++;
          continue;
        }

        // Create session in PostgreSQL
        await postgresClient.session.create({
          data: {
            id: session.id,
            shop: session.shop,
            state: session.state,
            isOnline: session.isOnline,
            scope: session.scope,
            expires: session.expires,
            accessToken: session.accessToken,
            userId: session.userId,
            firstName: session.firstName,
            lastName: session.lastName,
            email: session.email,
            accountOwner: session.accountOwner,
            locale: session.locale,
            collaborator: session.collaborator,
            emailVerified: session.emailVerified,
          }
        });

        console.log(`✅ Migrated session for shop: ${session.shop}`);
        migratedCount++;

      } catch (error) {
        console.error(`❌ Failed to migrate session ${session.id}:`, error);
        throw error;
      }
    }

    console.log(`🎉 Migration completed! Migrated: ${migratedCount}, Skipped: ${skippedCount}`);
    
    return { migrated: migratedCount, skipped: skippedCount };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Disconnect from databases
    await sqliteClient.$disconnect();
    await postgresClient.$disconnect();
  }
}

export async function createInitialShopRecords() {
  console.log('🏪 Creating initial shop records from existing sessions...');
  
  try {
    await postgresClient.$connect();
    
    // Get all unique shops from sessions
    const uniqueShops = await postgresClient.session.groupBy({
      by: ['shop'],
      _count: {
        shop: true
      }
    });

    console.log(`📋 Found ${uniqueShops.length} unique shops to create`);

    let createdCount = 0;
    let existingCount = 0;

    for (const shopGroup of uniqueShops) {
      try {
        // Check if shop record already exists
        const existingShop = await postgresClient.shopifyShop.findUnique({
          where: { shopDomain: shopGroup.shop }
        });

        if (existingShop) {
          existingCount++;
          continue;
        }

        // Get the most recent session for this shop to extract details
        const latestSession = await postgresClient.session.findFirst({
          where: { shop: shopGroup.shop },
          orderBy: { expires: 'desc' }
        });

        // Create shop record
        await postgresClient.shopifyShop.create({
          data: {
            shopDomain: shopGroup.shop,
            accessToken: latestSession?.accessToken,
            scopes: latestSession?.scope,
            // Default values for now - can be updated later via API calls
            country: null,
            currency: null,
            timezone: null,
          }
        });

        console.log(`✅ Created shop record for: ${shopGroup.shop}`);
        createdCount++;

      } catch (error) {
        console.error(`❌ Failed to create shop record for ${shopGroup.shop}:`, error);
        throw error;
      }
    }

    console.log(`🎉 Shop creation completed! Created: ${createdCount}, Existing: ${existingCount}`);
    
    return { created: createdCount, existing: existingCount };

  } catch (error) {
    console.error('❌ Shop creation failed:', error);
    throw error;
  } finally {
    await postgresClient.$disconnect();
  }
}

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const sessionResult = await migrateSessions();
      const shopResult = await createInitialShopRecords();
      
      console.log('📊 Migration Summary:');
      console.log(`   Sessions - Migrated: ${sessionResult.migrated}, Skipped: ${sessionResult.skipped}`);
      console.log(`   Shops - Created: ${shopResult.created}, Existing: ${shopResult.existing}`);
      
      process.exit(0);
    } catch (error) {
      console.error('💥 Migration script failed:', error);
      process.exit(1);
    }
  })();
}
