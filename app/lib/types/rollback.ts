export interface RollbackJob {
  id: string;
  campaignId: string;
  campaignName: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  type: 'CAMPAIGN_ROLLBACK' | 'PARTIAL_ROLLBACK';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  totalVariants: number;
  processedVariants: number;
  successfulVariants: number;
  failedVariants: number;
  errorMessage?: string;
  originalPrices: OriginalPriceEntry[];
  rollbackFilters?: RollbackFilters;
}

export interface OriginalPriceEntry {
  variantId: string;
  productId: string;
  productTitle: string;
  variantTitle: string;
  originalPrice: number;
  currentPrice: number;
  priceChangeDate: Date;
  auditTrailId: string;
}

export interface RollbackFilters {
  productIds?: string[];
  variantIds?: string[];
  dateRange?: {
    from: Date;
    to: Date;
  };
  priceChangeThreshold?: {
    min?: number;
    max?: number;
  };
}

export interface RollbackProgress {
  jobId: string;
  status: RollbackJob['status'];
  progress: number; // 0-100
  currentVariant?: string;
  estimatedTimeRemaining?: number;
  errors: RollbackError[];
}

export interface RollbackError {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  error: string;
  timestamp: Date;
}

export interface RollbackConfirmation {
  campaignId: string;
  campaignName: string;
  affectedProducts: number;
  affectedVariants: number;
  totalPriceChanges: number;
  estimatedDuration: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  warnings: string[];
}
