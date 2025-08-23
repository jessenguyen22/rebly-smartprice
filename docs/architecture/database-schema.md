# Database Schema

The database schema transforms the conceptual data models into concrete PostgreSQL structures, optimized for campaign management, audit trail queries, and high-volume pricing operations.

```sql
-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shopify shops for multi-tenant support
CREATE TABLE shopify_shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign management table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('active', 'paused', 'completed', 'draft')),
    target_products TEXT[] NOT NULL, -- Array of Shopify product IDs
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(255) NOT NULL,
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE
);

-- Index for active campaign queries
CREATE INDEX idx_campaigns_active ON campaigns (shopify_shop_id, status) 
WHERE status = 'active';

-- Index for campaign dashboard queries
CREATE INDEX idx_campaigns_user_recent ON campaigns (user_id, created_at DESC);

-- Pricing rules for both campaigns and manual jobs
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    pricing_job_id UUID REFERENCES pricing_jobs(id) ON DELETE CASCADE,
    when_condition VARCHAR(50) NOT NULL 
        CHECK (when_condition IN ('decreases_by_percent', 'increases_by_percent', 
                                 'decreases_by_abs', 'increases_by_abs', 
                                 'less_than_abs', 'more_than_abs')),
    when_value DECIMAL(10,2) NOT NULL,
    then_action VARCHAR(50) NOT NULL 
        CHECK (then_action IN ('reduce_price', 'increase_price', 'change_price')),
    then_mode VARCHAR(20) NOT NULL 
        CHECK (then_mode IN ('percentage', 'absolute')),
    then_value DECIMAL(10,2) NOT NULL,
    change_compare_at BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure rule belongs to either campaign or pricing job, not both
    CONSTRAINT pricing_rules_parent_check 
        CHECK ((campaign_id IS NOT NULL AND pricing_job_id IS NULL) OR 
               (campaign_id IS NULL AND pricing_job_id IS NOT NULL))
);

-- Manual pricing jobs table
CREATE TABLE pricing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL 
        CHECK (type IN ('manual_bulk', 'manual_rules', 'campaign_auto')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    bulk_amount DECIMAL(10,2), -- For bulk price changes
    bulk_type VARCHAR(20) CHECK (bulk_type IN ('increase', 'decrease')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    user_id VARCHAR(255) NOT NULL,
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE
);

-- Index for job history queries
CREATE INDEX idx_pricing_jobs_user_recent ON pricing_jobs (user_id, created_at DESC);

-- Selected variants for pricing jobs
CREATE TABLE selected_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_job_id UUID NOT NULL REFERENCES pricing_jobs(id) ON DELETE CASCADE,
    shopify_variant_id VARCHAR(255) NOT NULL,
    shopify_product_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    current_price DECIMAL(10,2),
    inventory_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing results for individual variant operations
CREATE TABLE processing_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_job_id UUID NOT NULL REFERENCES pricing_jobs(id) ON DELETE CASCADE,
    variant_id VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    product_title VARCHAR(500),
    variant_title VARCHAR(500),
    inventory INTEGER,
    error_message TEXT,
    reason TEXT,
    rule_applied TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    audit_trail_id UUID REFERENCES audit_trail_entries(id)
);

-- Index for result aggregation queries
CREATE INDEX idx_processing_results_job ON processing_results (pricing_job_id, success);

-- Comprehensive audit trail for compliance
CREATE TABLE audit_trail_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL 
        CHECK (entity_type IN ('variant', 'product')),
    entity_id VARCHAR(255) NOT NULL, -- Shopify GID
    change_type VARCHAR(30) NOT NULL 
        CHECK (change_type IN ('price_update', 'compare_at_update', 'inventory_sync', 'rollback')),
    old_value VARCHAR(100),
    new_value VARCHAR(100),
    trigger_reason TEXT NOT NULL,
    campaign_id UUID REFERENCES campaigns(id),
    pricing_job_id UUID REFERENCES pricing_jobs(id),
    user_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE,
    metadata JSONB -- Additional context data
);

-- Critical indexes for audit trail performance
CREATE INDEX idx_audit_trail_entity ON audit_trail_entries (entity_id, timestamp DESC);
CREATE INDEX idx_audit_trail_campaign ON audit_trail_entries (campaign_id, timestamp DESC);
CREATE INDEX idx_audit_trail_job ON audit_trail_entries (pricing_job_id, timestamp DESC);
CREATE INDEX idx_audit_trail_shop_time ON audit_trail_entries (shopify_shop_id, timestamp DESC);
CREATE INDEX idx_audit_trail_rollback ON audit_trail_entries (campaign_id, change_type) 
WHERE change_type != 'rollback'; -- For rollback operations

-- Webhook processing log for reliability
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_type VARCHAR(50) NOT NULL,
    shopify_webhook_id VARCHAR(255),
    payload JSONB NOT NULL,
    signature_valid BOOLEAN NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE
);

-- Index for webhook processing queries
CREATE INDEX idx_webhook_logs_processing ON webhook_logs (processed, processing_attempts, received_at);
CREATE INDEX idx_webhook_logs_shop_recent ON webhook_logs (shopify_shop_id, received_at DESC);

-- Session storage (migrated from SQLite)
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    shop VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT false,
    scope VARCHAR(1000),
    expires TIMESTAMP WITH TIME ZONE,
    access_token VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for session queries
CREATE INDEX idx_sessions_shop ON sessions (shop);

-- Performance optimization: Partitioning for audit trail by month
-- (Implementation note: Consider partitioning audit_trail_entries by timestamp 
-- for better performance with 2+ years of data retention)

-- Triggers for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_shops_updated_at 
    BEFORE UPDATE ON shopify_shops 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```
