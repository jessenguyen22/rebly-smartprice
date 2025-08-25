-- CreateEnum
CREATE TYPE "RuleExecutionState" AS ENUM ('INACTIVE', 'TRIGGERED', 'COOLING_DOWN', 'RESET_PENDING');

-- CreateEnum  
CREATE TYPE "ThresholdDirection" AS ENUM ('ABOVE', 'BELOW', 'CROSSING_UP', 'CROSSING_DOWN');

-- Rule Execution States Table - Track rule state per variant
CREATE TABLE "rule_execution_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ruleId" UUID NOT NULL,
    "variantId" TEXT NOT NULL,
    "campaignId" UUID NOT NULL,
    "state" "RuleExecutionState" NOT NULL DEFAULT 'INACTIVE',
    
    -- Threshold tracking for crossing detection
    "lastTriggerValue" DECIMAL(10,2),
    "lastInventoryValue" INTEGER,
    "thresholdDirection" "ThresholdDirection",
    
    -- Timing and cooldown management
    "triggeredAt" TIMESTAMP(3),
    "cooldownUntil" TIMESTAMP(3),
    "resetConditionMet" BOOLEAN NOT NULL DEFAULT false,
    
    -- Metadata for debugging and analytics
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,
    
    -- Audit fields
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "rule_execution_states_pkey" PRIMARY KEY ("id")
);

-- Variant State History - Track inventory changes for threshold detection
CREATE TABLE "variant_state_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "variantId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    
    -- State snapshots
    "inventoryQuantity" INTEGER NOT NULL,
    "priceAmount" DECIMAL(10,2) NOT NULL,
    "compareAtPrice" DECIMAL(10,2),
    
    -- Change detection
    "inventoryChange" INTEGER NOT NULL DEFAULT 0,
    "priceChange" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "changeReason" TEXT,
    
    -- Timing
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shopifyShopId" UUID NOT NULL,

    CONSTRAINT "variant_state_history_pkey" PRIMARY KEY ("id")
);

-- Rule Threshold Configurations - Define hysteresis patterns
CREATE TABLE "rule_threshold_configs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ruleId" UUID NOT NULL,
    
    -- Primary threshold (existing rule logic)
    "triggerThreshold" DECIMAL(10,2) NOT NULL,
    "triggerOperator" TEXT NOT NULL,
    
    -- Hysteresis thresholds (prevent oscillation)
    "resetThreshold" DECIMAL(10,2),
    "resetOperator" TEXT,
    
    -- Advanced configuration
    "minimumCooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "requiresResetCondition" BOOLEAN NOT NULL DEFAULT true,
    "maxTriggersPerDay" INTEGER DEFAULT 5,
    
    -- Audit
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_threshold_configs_pkey" PRIMARY KEY ("id")
);

-- Indexes for performance
CREATE INDEX "rule_execution_states_variant_rule_idx" ON "rule_execution_states"("variantId", "ruleId");
CREATE INDEX "rule_execution_states_campaign_state_idx" ON "rule_execution_states"("campaignId", "state");
CREATE INDEX "rule_execution_states_cooldown_idx" ON "rule_execution_states"("cooldownUntil") WHERE "cooldownUntil" IS NOT NULL;

CREATE INDEX "variant_state_history_variant_time_idx" ON "variant_state_history"("variantId", "capturedAt");
CREATE INDEX "variant_state_history_shop_time_idx" ON "variant_state_history"("shopifyShopId", "capturedAt");

CREATE INDEX "rule_threshold_configs_rule_idx" ON "rule_threshold_configs"("ruleId");

-- Foreign key constraints
ALTER TABLE "rule_execution_states" ADD CONSTRAINT "rule_execution_states_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "pricing_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rule_execution_states" ADD CONSTRAINT "rule_execution_states_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "rule_execution_states" ADD CONSTRAINT "rule_execution_states_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "variant_state_history" ADD CONSTRAINT "variant_state_history_shopifyShopId_fkey" FOREIGN KEY ("shopifyShopId") REFERENCES "shopify_shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rule_threshold_configs" ADD CONSTRAINT "rule_threshold_configs_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "pricing_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Unique constraints to prevent duplicates
ALTER TABLE "rule_execution_states" ADD CONSTRAINT "rule_execution_states_variant_rule_unique" UNIQUE ("variantId", "ruleId");
ALTER TABLE "rule_threshold_configs" ADD CONSTRAINT "rule_threshold_configs_rule_unique" UNIQUE ("ruleId");
