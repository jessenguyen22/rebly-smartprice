import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient;
}

// Configure DATABASE_URL with connection pooling parameters if not already configured
const getDatabaseUrl = () => {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }
  
  // Add connection pooling parameters if not present
  const url = new URL(baseUrl);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', '5');
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '10');
  }
  
  return url.toString();
};

// Ensure PostgreSQL connection is properly configured with connection pooling
const prisma = global.prismaGlobal ?? new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
});

if (process.env.NODE_ENV !== "production") {
  global.prismaGlobal = prisma;
}

// Graceful shutdown with better connection management
const cleanup = async () => {
  console.log('🔌 Disconnecting from database...');
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected successfully');
  } catch (error) {
    console.error('❌ Error disconnecting from database:', error);
  }
};

process.on('SIGINT', async () => {
  await cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await cleanup();
  process.exit(0);
});

// Add unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export { prisma };
export default prisma;
