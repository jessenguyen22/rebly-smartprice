-- CreateEnum
CREATE TYPE "public"."CampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."PricingJobType" AS ENUM ('MANUAL', 'CAMPAIGN', 'WEBHOOK_SYNC');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'RETRYING');

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."shopify_shops" (
    "id" UUID NOT NULL,
    "shopDomain" TEXT NOT NULL,
    "accessToken" TEXT,
    "scopes" TEXT,
    "country" TEXT,
    "currency" TEXT,
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopify_shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."campaigns" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "targetProducts" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "lastTriggered" TIMESTAMP(3),
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pricing_rules" (
    "id" UUID NOT NULL,
    "description" TEXT,
    "whenCondition" TEXT NOT NULL,
    "whenOperator" TEXT NOT NULL,
    "whenValue" TEXT NOT NULL,
    "thenAction" TEXT NOT NULL,
    "thenMode" TEXT NOT NULL,
    "thenValue" TEXT NOT NULL,
    "changeCompareAt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "campaignId" UUID,
    "pricingJobId" UUID,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pricing_jobs" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."PricingJobType" NOT NULL DEFAULT 'MANUAL',
    "status" "public"."JobStatus" NOT NULL DEFAULT 'PENDING',
    "totalVariants" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "userId" TEXT,
    "exportPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "pricing_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."selected_variants" (
    "id" UUID NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT,
    "variantTitle" TEXT,
    "currentPrice" TEXT,
    "compareAtPrice" TEXT,
    "inventory" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pricingJobId" UUID NOT NULL,

    CONSTRAINT "selected_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."processing_results" (
    "id" UUID NOT NULL,
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "oldPrice" TEXT,
    "newPrice" TEXT,
    "oldCompareAt" TEXT,
    "newCompareAt" TEXT,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pricingJobId" UUID NOT NULL,
    "auditTrailId" UUID,

    CONSTRAINT "processing_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_trail_entries" (
    "id" UUID NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "triggerReason" TEXT NOT NULL,
    "userId" TEXT,
    "campaignId" TEXT,
    "pricingJobId" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "audit_trail_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."webhook_logs" (
    "id" UUID NOT NULL,
    "webhookType" TEXT NOT NULL,
    "shopifyId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "public"."WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "webhook_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_shops_shopDomain_key" ON "public"."shopify_shops"("shopDomain");

-- CreateIndex
CREATE INDEX "campaigns_shopifyShopId_status_idx" ON "public"."campaigns"("shopifyShopId", "status");

-- CreateIndex
CREATE INDEX "campaigns_shopifyShopId_lastTriggered_idx" ON "public"."campaigns"("shopifyShopId", "lastTriggered");

-- CreateIndex
CREATE INDEX "pricing_rules_campaignId_idx" ON "public"."pricing_rules"("campaignId");

-- CreateIndex
CREATE INDEX "pricing_rules_pricingJobId_idx" ON "public"."pricing_rules"("pricingJobId");

-- CreateIndex
CREATE INDEX "pricing_jobs_shopifyShopId_status_idx" ON "public"."pricing_jobs"("shopifyShopId", "status");

-- CreateIndex
CREATE INDEX "pricing_jobs_shopifyShopId_createdAt_idx" ON "public"."pricing_jobs"("shopifyShopId", "createdAt");

-- CreateIndex
CREATE INDEX "selected_variants_pricingJobId_idx" ON "public"."selected_variants"("pricingJobId");

-- CreateIndex
CREATE INDEX "selected_variants_variantId_idx" ON "public"."selected_variants"("variantId");

-- CreateIndex
CREATE INDEX "processing_results_pricingJobId_idx" ON "public"."processing_results"("pricingJobId");

-- CreateIndex
CREATE INDEX "processing_results_variantId_idx" ON "public"."processing_results"("variantId");

-- CreateIndex
CREATE INDEX "processing_results_auditTrailId_idx" ON "public"."processing_results"("auditTrailId");

-- CreateIndex
CREATE INDEX "audit_trail_entries_shopifyShopId_timestamp_idx" ON "public"."audit_trail_entries"("shopifyShopId", "timestamp");

-- CreateIndex
CREATE INDEX "audit_trail_entries_entityType_entityId_idx" ON "public"."audit_trail_entries"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_trail_entries_changeType_timestamp_idx" ON "public"."audit_trail_entries"("changeType", "timestamp");

-- CreateIndex
CREATE INDEX "audit_trail_entries_campaignId_idx" ON "public"."audit_trail_entries"("campaignId");

-- CreateIndex
CREATE INDEX "audit_trail_entries_pricingJobId_idx" ON "public"."audit_trail_entries"("pricingJobId");

-- CreateIndex
CREATE INDEX "webhook_logs_shopifyShopId_webhookType_idx" ON "public"."webhook_logs"("shopifyShopId", "webhookType");

-- CreateIndex
CREATE INDEX "webhook_logs_status_createdAt_idx" ON "public"."webhook_logs"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "public"."campaigns" ADD CONSTRAINT "campaigns_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "public"."shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pricing_rules" ADD CONSTRAINT "pricing_rules_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pricing_rules" ADD CONSTRAINT "pricing_rules_pricingJobId_fkey" FOREIGN KEY ("pricingJobId") REFERENCES "public"."pricing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pricing_jobs" ADD CONSTRAINT "pricing_jobs_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "public"."shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."selected_variants" ADD CONSTRAINT "selected_variants_pricingJobId_fkey" FOREIGN KEY ("pricingJobId") REFERENCES "public"."pricing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_results" ADD CONSTRAINT "processing_results_pricingJobId_fkey" FOREIGN KEY ("pricingJobId") REFERENCES "public"."pricing_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."processing_results" ADD CONSTRAINT "processing_results_auditTrailId_fkey" FOREIGN KEY ("auditTrailId") REFERENCES "public"."audit_trail_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_trail_entries" ADD CONSTRAINT "audit_trail_entries_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "public"."shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."webhook_logs" ADD CONSTRAINT "webhook_logs_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "public"."shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
