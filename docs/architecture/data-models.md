# Data Models

Based on PRD requirements, I've identified the core business entities that will be shared between frontend and backend. These models form the foundation of the campaign automation system while preserving existing manual pricing functionality.

### Campaign

**Purpose:** Represents automated pricing campaigns that respond to inventory changes via webhooks. Central entity for the new automation features.

**Key Attributes:**
- id: string - Unique campaign identifier
- name: string - Human-readable campaign name ("Black Friday Auto-Pricing")
- status: CampaignStatus - Current campaign state (active, paused, completed)
- rules: PricingRule[] - Array of inventory-based pricing conditions
- createdAt: Date - Campaign creation timestamp
- updatedAt: Date - Last modification timestamp
- userId: string - Shopify user who created the campaign
- triggerCount: number - Number of times campaign has been triggered

#### TypeScript Interface

```typescript
interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  description?: string;
  rules: PricingRule[];
  targetProducts: string[]; // Shopify product IDs
  startDate?: Date;
  endDate?: Date;
  triggerCount: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  shopifyShop: string;
}

type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
```

#### Relationships
- Has many AuditTrailEntry records (campaign execution history)
- Has many PricingJobResult records (price changes made by campaign)
- Belongs to ShopifyShop (multi-tenant support)

### PricingRule

**Purpose:** Defines inventory-based conditional logic for both manual pricing jobs and automated campaigns. Preserves existing rule structure while enabling reuse.

**Key Attributes:**
- whenCondition: string - Inventory change trigger condition
- whenValue: string - Threshold value for trigger
- thenAction: string - Pricing action to execute
- thenMode: string - How to apply pricing change (percentage/absolute)
- thenValue: string - Amount of pricing change
- changeCompareAt: boolean - Whether to update compare-at price

#### TypeScript Interface

```typescript
interface PricingRule {
  id?: string;
  whenCondition: 'decreases_by_percent' | 'increases_by_percent' | 
                 'decreases_by_abs' | 'increases_by_abs' | 
                 'less_than_abs' | 'more_than_abs';
  whenValue: string;
  thenAction: 'reduce_price' | 'increase_price' | 'change_price';
  thenMode: 'percentage' | 'absolute';
  thenValue: string;
  changeCompareAt: boolean;
  description?: string;
}
```

#### Relationships
- Belongs to Campaign (for automated rules)
- Belongs to PricingJob (for manual rules)
- Used in ProcessingResult records

### PricingJob

**Purpose:** Represents manual pricing operations (enhanced version of current admin.tsx functionality). Maintains existing workflow while adding audit capabilities.

#### TypeScript Interface

```typescript
interface PricingJob {
  id: string;
  name: string;
  type: 'manual_bulk' | 'manual_rules' | 'campaign_auto';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  selectedVariants: SelectedVariant[];
  rules?: PricingRule[];
  bulkAmount?: string;
  bulkType?: 'increase' | 'decrease';
  results: ProcessingResult[];
  createdAt: Date;
  completedAt?: Date;
  userId: string;
  shopifyShop: string;
}
```

#### Relationships
- Has many ProcessingResult records (detailed execution results)
- Has many AuditTrailEntry records (change tracking)
- May have PricingRule records (for rules-based jobs)

### AuditTrailEntry

**Purpose:** Comprehensive audit logging for all pricing changes, supporting compliance requirements and rollback functionality.

#### TypeScript Interface

```typescript
interface AuditTrailEntry {
  id: string;
  entityType: 'variant' | 'product';
  entityId: string; // Shopify GID
  changeType: 'price_update' | 'compare_at_update' | 'inventory_sync';
  oldValue: string;
  newValue: string;
  triggerReason: string;
  campaignId?: string;
  pricingJobId?: string;
  userId?: string;
  timestamp: Date;
  shopifyShop: string;
  metadata?: Record<string, any>;
}
```

#### Relationships
- Belongs to Campaign (if campaign-triggered)
- Belongs to PricingJob (if job-triggered)
- References Shopify entities (variants, products)

### ProcessingResult

**Purpose:** Detailed execution results for individual variant processing, preserving existing result structure while adding audit references.

#### TypeScript Interface

```typescript
interface ProcessingResult {
  id: string;
  variantId: string;
  success: boolean;
  oldPrice?: string;
  newPrice?: string;
  productTitle?: string;
  variantTitle?: string;
  inventory?: number;
  error?: string;
  reason?: string;
  ruleApplied?: string;
  processedAt: Date;
  auditTrailId?: string;
}
```

#### Relationships
- Belongs to PricingJob (execution context)
- References AuditTrailEntry (audit logging)
- References Shopify variant (external entity)
