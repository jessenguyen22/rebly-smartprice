-- Add Processing Locks for Campaign Webhook Concurrency Control
CREATE TABLE "processing_locks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "lockKey" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('WEBHOOK_PROCESSING', 'CAMPAIGN_EXECUTION')),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "processId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "processing_locks_pkey" PRIMARY KEY ("id")
);

-- Add Price Cooldowns for Rate Limiting
CREATE TABLE "price_cooldowns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variantId" TEXT NOT NULL,
    "campaignId" UUID,
    "type" TEXT NOT NULL CHECK ("type" IN ('PRICE_UPDATE', 'CAMPAIGN_TRIGGER')),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "price_cooldowns_pkey" PRIMARY KEY ("id")
);

-- Unique constraints and indexes
CREATE UNIQUE INDEX "processing_locks_lockKey_key" ON "processing_locks"("lockKey");
CREATE INDEX "processing_locks_expires_idx" ON "processing_locks"("expiresAt");
CREATE INDEX "processing_locks_type_idx" ON "processing_locks"("type");

CREATE UNIQUE INDEX "price_cooldowns_variantId_type_key" ON "price_cooldowns"("variantId", "type");
CREATE INDEX "price_cooldowns_expires_idx" ON "price_cooldowns"("expiresAt");
CREATE INDEX "price_cooldowns_campaign_idx" ON "price_cooldowns"("campaignId") WHERE "campaignId" IS NOT NULL;

-- Foreign key constraints  
ALTER TABLE "processing_locks" ADD CONSTRAINT "processing_locks_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "price_cooldowns" ADD CONSTRAINT "price_cooldowns_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "price_cooldowns" ADD CONSTRAINT "price_cooldowns_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
