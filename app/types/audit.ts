// Audit trail TypeScript types

export interface AuditTrailEntry {
  id: string;
  entityType: string;
  entityId: string;
  changeType: string;
  oldValue?: string;
  newValue?: string;
  triggerReason: string;
  userId?: string;
  campaignId?: string;
  pricingJobId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  shopifyShopId: string;
}

export interface CreateAuditTrailEntry {
  entityType: string;
  entityId: string;
  changeType: string;
  oldValue?: string;
  newValue?: string;
  triggerReason: string;
  userId?: string;
  campaignId?: string;
  pricingJobId?: string;
  metadata?: Record<string, any>;
}

export interface AuditTrailFilters {
  entityType?: string;
  entityId?: string;
  changeType?: string;
  campaignId?: string;
  pricingJobId?: string;
  startDate?: Date;
  endDate?: Date;
  limit: number;
  offset?: number;
}

export interface PriceChangeAuditData {
  oldPrice?: string;
  newPrice?: string;
  oldCompareAt?: string;
  newCompareAt?: string;
  variant: {
    id: string;
    title?: string;
  };
  product: {
    id: string;
    title?: string;
  };
}
