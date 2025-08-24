import { z } from 'zod';

// Campaign input validation schema
const CampaignInputSchema = z.object({
  name: z.string()
    .min(1, 'Campaign name is required')
    .max(255, 'Campaign name must be less than 255 characters'),
  
  description: z.string()
    .max(1000, 'Description must be less than 1000 characters')
    .optional(),
  
  targetProducts: z.object({
    productIds: z.array(z.string()).optional(),
    collections: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    vendors: z.array(z.string()).optional(),
    productTypes: z.array(z.string()).optional(),
  }),
  
  rules: z.array(z.object({
    description: z.string().optional(),
    whenCondition: z.string().min(1, 'When condition is required'),
    whenOperator: z.enum(['equals', 'greater_than', 'less_than', 'contains', 'between']),
    whenValue: z.string().min(1, 'When value is required'),
    thenAction: z.enum(['percentage', 'fixed_amount', 'set_price']),
    thenMode: z.enum(['increase', 'decrease', 'set']),
    thenValue: z.string().min(1, 'Then value is required'),
    changeCompareAt: z.boolean().default(false),
  })).min(1, 'At least one rule is required'),

  priority: z.number()
    .min(1, 'Priority must be at least 1')
    .max(100, 'Priority must be at most 100')
    .default(1),
});

// Status update validation schema  
export const StatusUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']),
  reason: z.string().optional(),
});

// Campaign query filters schema
const CampaignFiltersSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED']).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt', 'updatedAt', 'lastTriggered', 'triggerCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
});

export type CampaignInput = z.infer<typeof CampaignInputSchema>;
export type StatusUpdate = z.infer<typeof StatusUpdateSchema>;
export type CampaignFilters = z.infer<typeof CampaignFiltersSchema>;

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  data?: any;
}

export function validateCampaignInput(input: unknown): ValidationResult {
  try {
    const data = CampaignInputSchema.parse(input);
    return {
      isValid: true,
      errors: [],
      data
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      isValid: false,
      errors: ['Invalid input format']
    };
  }
}

export function validateStatusUpdate(input: unknown): ValidationResult {
  try {
    const data = StatusUpdateSchema.parse(input);
    return {
      isValid: true,
      errors: [],
      data
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      isValid: false,
      errors: ['Invalid status update format']
    };
  }
}

export function validateCampaignFilters(input: unknown): ValidationResult {
  try {
    const data = CampaignFiltersSchema.parse(input);
    return {
      isValid: true,
      errors: [],
      data
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.issues.map((err: z.ZodIssue) => `${err.path.join('.')}: ${err.message}`)
      };
    }
    return {
      isValid: false,
      errors: ['Invalid filters format']
    };
  }
}
