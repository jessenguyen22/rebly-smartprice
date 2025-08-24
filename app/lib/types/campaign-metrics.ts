/**
 * Campaign Performance Metrics Interface
 */
export interface CampaignMetrics {
  campaignId: string;
  totalTriggers: number;
  lastTriggered: Date | null;
  affectedProducts: number;
  priceChanges: PriceChangeMetric[];
  webhookStatus: WebhookStatus;
  performanceStats: PerformanceStats;
}

export interface CampaignAggregateMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalTriggers: number;
  totalPriceChanges: number;
  avgSuccessRate: number;
  topPerformingCampaigns: CampaignPerformance[];
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  triggerCount: number;
  successRate: number;
  totalPriceChanges: number;
  avgResponseTime: number;
  lastActiveDate: Date;
}

export interface PriceChangeMetric {
  productId: string;
  variantId: string;
  productTitle: string;
  oldPrice: number;
  newPrice: number;
  changedAt: Date;
  changeAmount: number;
  changePercentage: number;
}

export interface WebhookStatus {
  isActive: boolean;
  lastProcessed: Date | null;
  processingErrors: number;
  avgProcessingTime: number; // in milliseconds
  successRate: number; // percentage 0-100
}

export interface PerformanceStats {
  totalRevenue: number;
  avgOrderValue: number;
  conversionRate: number;
  inventoryTurnover: number;
  priceOptimizationScore: number; // 0-100 score
}

export interface TriggerHistoryEntry {
  id: string;
  campaignId: string;
  triggeredAt: Date;
  triggerReason: string;
  productIds: string[];
  priceChanges: number;
  successful: boolean;
  errorMessage?: string;
  processingTime: number; // milliseconds
}

export interface CampaignAggregateMetrics {
  totalCampaigns: number;
  activeCampaigns: number;
  totalTriggers: number;
  totalPriceChanges: number;
  avgSuccessRate: number;
  topPerformingCampaigns: CampaignPerformance[];
}

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  triggerCount: number;
  successRate: number;
  totalPriceChanges: number;
  avgResponseTime: number;
  lastActiveDate: Date;
}
