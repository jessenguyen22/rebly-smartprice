// Campaign-related TypeScript types

export type CampaignStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  targetProducts: TargetProductCriteria[];
  priority: number;
  triggerCount: number;
  lastTriggered?: Date;
  userId?: string;
  shopifyShopId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PricingRule {
  id: string;
  description?: string;
  whenCondition: string;
  whenOperator: string;
  whenValue: string;
  thenAction: string;
  thenMode: string;
  thenValue: string;
  changeCompareAt: boolean;
  campaignId?: string;
  pricingJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCampaignData {
  name: string;
  description?: string;
  targetProducts: TargetProductCriteria[];
  rules: CreatePricingRuleData[];
  priority?: number;
  status?: CampaignStatus;
}

export interface TargetProductCriteria {
  type: 'all' | 'collection' | 'product' | 'variant' | 'tag';
  value?: string | string[];
  conditions?: {
    inventoryLevel?: { operator: string; value: number };
    priceRange?: { min?: number; max?: number };
    tags?: string[];
  };
  _metadata?: {
    titles?: string[];
    images?: string[];
    [key: string]: any;
  };
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

export interface CampaignWithRules extends Campaign {
  rules: PricingRule[];
}

export interface CampaignListFilters {
  status?: CampaignStatus;
  limit: number;
  offset?: number;
}
