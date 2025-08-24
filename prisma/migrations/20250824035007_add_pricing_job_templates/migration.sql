-- AlterTable
ALTER TABLE "public"."pricing_jobs" ADD COLUMN     "templateId" UUID;

-- CreateTable
CREATE TABLE "public"."pricing_job_templates" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB,
    "bulkAmount" TEXT,
    "bulkType" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "pricing_job_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_job_templates_shopifyShopId_updatedAt_idx" ON "public"."pricing_job_templates"("shopifyShopId", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_job_templates_shopifyShopId_name_key" ON "public"."pricing_job_templates"("shopifyShopId", "name");

-- CreateIndex
CREATE INDEX "pricing_jobs_templateId_idx" ON "public"."pricing_jobs"("templateId");

-- AddForeignKey
ALTER TABLE "public"."pricing_jobs" ADD CONSTRAINT "pricing_jobs_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."pricing_job_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pricing_job_templates" ADD CONSTRAINT "pricing_job_templates_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "public"."shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
