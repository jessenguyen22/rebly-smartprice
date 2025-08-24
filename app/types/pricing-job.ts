// Pricing job TypeScript types

export type PricingJobType = 'MANUAL' | 'CAMPAIGN' | 'WEBHOOK_SYNC';
export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface PricingJob {
  id: string;
  name: string;
  type: PricingJobType;
  status: JobStatus;
  totalVariants: number;
  processedCount: number;
  successCount: number;
  errorCount: number;
  startedAt?: Date;
  completedAt?: Date;
  userId?: string;
  exportPath?: string;
  shopifyShopId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SelectedVariant {
  id: string;
  variantId: string;
  productId: string;
  productTitle?: string;
  variantTitle?: string;
  currentPrice?: string;
  compareAtPrice?: string;
  inventory?: number;
  pricingJobId: string;
  createdAt: Date;
}

export interface ProcessingResult {
  id: string;
  variantId: string;
  productId: string;
  success: boolean;
  oldPrice?: string;
  newPrice?: string;
  oldCompareAt?: string;
  newCompareAt?: string;
  errorMessage?: string;
  processedAt: Date;
  pricingJobId: string;
  auditTrailId?: string;
}

export interface CreatePricingJobData {
  name: string;
  type?: PricingJobType;
  templateId?: string; // New: Optional template ID reference
  selectedVariants: CreateSelectedVariantData[];
  rules?: CreatePricingRuleData[];
}

export interface CreateSelectedVariantData {
  variantId: string;
  productId: string;
  productTitle?: string;
  variantTitle?: string;
  currentPrice?: string;
  compareAtPrice?: string;
  inventory?: number;
}

export interface CreatePricingRuleData {
  description?: string;
  whenCondition: string;
  whenOperator: string;
  whenValue: string;
  thenAction: string;
  thenMode: string;
  thenValue: string;
  changeCompareAt?: boolean;
}

export interface PricingJobWithDetails extends PricingJob {
  rules: any[];
  selectedVariants: SelectedVariant[];
  processingResults: ProcessingResult[];
}

export interface PricingJobFilters {
  status?: JobStatus;
  type?: PricingJobType;
  userId?: string;
  limit: number;
  offset?: number;
}
