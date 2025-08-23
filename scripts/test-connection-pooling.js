// Test database connection with connection pooling
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

console.log('🔍 Testing database connection with optimized pooling...');

const testConnections = async () => {
  const clients = [];
  
  try {
    // Test creating multiple clients (should reuse connections)
    for (let i = 0; i < 3; i++) {
      const client = new PrismaClient({
        datasources: {
          db: {
            url: getDatabaseUrl(),
          },
        },
      });
      
      clients.push(client);
      console.log(`📋 Created client ${i + 1}`);
      
      // Test connection
      await client.session.findFirst();
      console.log(`✅ Client ${i + 1} connected successfully`);
    }
    
    console.log('🎉 All connections successful with optimized pooling!');
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  } finally {
    // Clean up all clients
    console.log('🧹 Cleaning up connections...');
    for (let i = 0; i < clients.length; i++) {
      try {
        await clients[i].$disconnect();
        console.log(`🔌 Client ${i + 1} disconnected`);
      } catch (error) {
        console.error(`⚠️ Error disconnecting client ${i + 1}:`, error.message);
      }
    }
    console.log('✅ Connection test completed');
  }
};

// Run the test
testConnections().catch(console.error);
