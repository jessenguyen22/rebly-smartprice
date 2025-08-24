// Campaign types for the dashboard system
export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  targetProducts: TargetProduct[];
  pricingRules: PricingRule[];
  metrics: CampaignMetrics;
}

export interface CampaignMetrics {
  triggerCount: number;
  lastTriggered?: string;
  affectedProductsCount: number;
  totalPriceChanges: number;
  averagePriceChange: number;
  successRate: number; // Percentage of successful price updates
}

export interface TargetProduct {
  id: string;
  title: string;
  handle: string;
  image?: {
    url: string;
    altText?: string;
  };
}

export interface PricingRule {
  id: string;
  whenCondition: 'inventory_level' | 'inventory_percentage' | 'days_since_update';
  whenOperator: 'less_than' | 'greater_than' | 'equals' | 'between';
  whenValue: number;
  whenSecondValue?: number; // For 'between' operator
  thenAction: 'set_price' | 'adjust_percentage' | 'adjust_fixed';
  thenValue: number;
  isActive: boolean;
}

// Dashboard filter and search types
export interface CampaignFilters {
  status?: CampaignStatus[];
  dateRange?: {
    from: string;
    to: string;
  };
  searchQuery?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'triggerCount';
  sortOrder?: 'asc' | 'desc';
}

// Real-time update types
export interface CampaignUpdate {
  campaignId: string;
  type: 'status_change' | 'metrics_update' | 'rule_triggered';
  data: Partial<Campaign>;
  timestamp: string;
}

// Dashboard layout options
export type DashboardLayout = 'grid' | 'list';
