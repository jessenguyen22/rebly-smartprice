import type { CreateCampaignData, CreatePricingRuleData, TargetProductCriteria } from '../types/campaign';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validates campaign form data
 */
export function validateCampaignData(data: CreateCampaignData): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate campaign name
  if (!data.name || !data.name.trim()) {
    errors.push({
      field: 'name',
      message: 'Campaign name is required'
    });
  } else if (data.name.trim().length < 3) {
    errors.push({
      field: 'name',
      message: 'Campaign name must be at least 3 characters long'
    });
  } else if (data.name.trim().length > 100) {
    errors.push({
      field: 'name',
      message: 'Campaign name cannot exceed 100 characters'
    });
  }

  // Validate description length if provided
  if (data.description && data.description.length > 500) {
    errors.push({
      field: 'description',
      message: 'Description cannot exceed 500 characters'
    });
  }

  // Validate pricing rules
  if (!data.rules || data.rules.length === 0) {
    errors.push({
      field: 'rules',
      message: 'At least one pricing rule is required'
    });
  } else {
    const ruleErrors = validatePricingRules(data.rules);
    errors.push(...ruleErrors);
  }

  // Validate target products
  if (!data.targetProducts || data.targetProducts.length === 0) {
    errors.push({
      field: 'targetProducts',
      message: 'Target products must be specified'
    });
  } else {
    const targetErrors = validateTargetProducts(data.targetProducts);
    errors.push(...targetErrors);
  }

  // Validate priority
  if (data.priority !== undefined && (data.priority < 1 || data.priority > 10)) {
    errors.push({
      field: 'priority',
      message: 'Priority must be between 1 and 10'
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates pricing rules array
 */
export function validatePricingRules(rules: CreatePricingRuleData[]): ValidationError[] {
  const errors: ValidationError[] = [];

  rules.forEach((rule, index) => {
    const ruleErrors = validateSinglePricingRule(rule, index);
    errors.push(...ruleErrors);
  });

  return errors;
}

/**
 * Validates a single pricing rule
 */
export function validateSinglePricingRule(rule: CreatePricingRuleData, index: number = 0): ValidationError[] {
  const errors: ValidationError[] = [];
  const fieldPrefix = `rules[${index}]`;

  // Validate when condition values
  if (!rule.whenCondition) {
    errors.push({
      field: `${fieldPrefix}.whenCondition`,
      message: 'When condition is required'
    });
  }

  if (!rule.whenOperator) {
    errors.push({
      field: `${fieldPrefix}.whenOperator`,
      message: 'When operator is required'
    });
  }

  if (!rule.whenValue || rule.whenValue.trim() === '') {
    errors.push({
      field: `${fieldPrefix}.whenValue`,
      message: 'When value is required'
    });
  } else {
    const whenNum = parseFloat(rule.whenValue);
    if (isNaN(whenNum)) {
      errors.push({
        field: `${fieldPrefix}.whenValue`,
        message: 'When value must be a valid number'
      });
    } else if (whenNum < 0) {
      errors.push({
        field: `${fieldPrefix}.whenValue`,
        message: 'When value must be positive'
      });
    } else if (rule.whenCondition.includes('percent') && whenNum > 100) {
      errors.push({
        field: `${fieldPrefix}.whenValue`,
        message: 'Percentage values cannot exceed 100%'
      });
    }
  }

  // Validate then action values
  if (!rule.thenAction) {
    errors.push({
      field: `${fieldPrefix}.thenAction`,
      message: 'Then action is required'
    });
  }

  if (!rule.thenMode) {
    errors.push({
      field: `${fieldPrefix}.thenMode`,
      message: 'Then mode is required'
    });
  }

  if (!rule.thenValue || rule.thenValue.trim() === '') {
    errors.push({
      field: `${fieldPrefix}.thenValue`,
      message: 'Then value is required'
    });
  } else {
    const thenNum = parseFloat(rule.thenValue);
    if (isNaN(thenNum)) {
      errors.push({
        field: `${fieldPrefix}.thenValue`,
        message: 'Then value must be a valid number'
      });
    } else if (thenNum < 0) {
      errors.push({
        field: `${fieldPrefix}.thenValue`,
        message: 'Then value must be positive'
      });
    } else if (rule.thenMode === 'percentage') {
      if (thenNum > 100) {
        errors.push({
          field: `${fieldPrefix}.thenValue`,
          message: 'Percentage adjustments cannot exceed 100%'
        });
      }
      // Warn about potentially destructive percentage reductions
      if (rule.thenAction === 'reduce_price' && thenNum > 50) {
        errors.push({
          field: `${fieldPrefix}.thenValue`,
          message: 'Price reduction of more than 50% may be too aggressive. Consider using a smaller percentage.'
        });
      }
    } else if (rule.thenMode === 'fixed') {
      // Validate fixed amounts are reasonable
      if (thenNum > 10000) {
        errors.push({
          field: `${fieldPrefix}.thenValue`,
          message: 'Fixed amount seems unusually high. Please verify the value.'
        });
      }
    }
  }

  // Validate rule logic combinations
  if (rule.thenAction === 'set_price' && rule.thenMode === 'percentage') {
    errors.push({
      field: `${fieldPrefix}.thenAction`,
      message: 'Set price action requires fixed mode, not percentage'
    });
  }

  return errors;
}

/**
 * Validates target products criteria
 */
export function validateTargetProducts(targetProducts: TargetProductCriteria[]): ValidationError[] {
  const errors: ValidationError[] = [];

  targetProducts.forEach((criteria, index) => {
    const criteriaErrors = validateSingleTargetCriteria(criteria, index);
    errors.push(...criteriaErrors);
  });

  // Check for conflicting targeting (e.g., both "all" and specific products)
  const hasAllProducts = targetProducts.some(criteria => criteria.type === 'all');
  if (hasAllProducts && targetProducts.length > 1) {
    errors.push({
      field: 'targetProducts',
      message: 'Cannot combine "all products" with other targeting criteria'
    });
  }

  return errors;
}

/**
 * Validates a single target criteria
 */
export function validateSingleTargetCriteria(criteria: TargetProductCriteria, index: number = 0): ValidationError[] {
  const errors: ValidationError[] = [];
  const fieldPrefix = `targetProducts[${index}]`;

  if (!criteria.type) {
    errors.push({
      field: `${fieldPrefix}.type`,
      message: 'Target type is required'
    });
    return errors;
  }

  // Validate based on target type
  switch (criteria.type) {
    case 'product':
    case 'collection':
    case 'variant':
      if (!criteria.value || (Array.isArray(criteria.value) && criteria.value.length === 0)) {
        errors.push({
          field: `${fieldPrefix}.value`,
          message: `At least one ${criteria.type} must be selected`
        });
      }
      break;

    case 'tag':
      if (!criteria.value || 
          (Array.isArray(criteria.value) && criteria.value.length === 0) ||
          (typeof criteria.value === 'string' && !criteria.value.trim())) {
        errors.push({
          field: `${fieldPrefix}.value`,
          message: 'At least one tag must be specified'
        });
      }
      break;

    case 'all':
      // No validation needed for "all" type
      break;

    default:
      errors.push({
        field: `${fieldPrefix}.type`,
        message: 'Invalid target type'
      });
  }

  // Validate conditions if present
  if (criteria.conditions) {
    // Validate inventory level condition
    if (criteria.conditions.inventoryLevel) {
      const { operator, value } = criteria.conditions.inventoryLevel;
      if (!operator) {
        errors.push({
          field: `${fieldPrefix}.conditions.inventoryLevel.operator`,
          message: 'Inventory level operator is required'
        });
      }
      if (value === undefined || value < 0) {
        errors.push({
          field: `${fieldPrefix}.conditions.inventoryLevel.value`,
          message: 'Inventory level value must be a non-negative number'
        });
      }
    }

    // Validate price range
    if (criteria.conditions.priceRange) {
      const { min, max } = criteria.conditions.priceRange;
      if (min !== undefined && min < 0) {
        errors.push({
          field: `${fieldPrefix}.conditions.priceRange.min`,
          message: 'Minimum price must be non-negative'
        });
      }
      if (max !== undefined && max < 0) {
        errors.push({
          field: `${fieldPrefix}.conditions.priceRange.max`,
          message: 'Maximum price must be non-negative'
        });
      }
      if (min !== undefined && max !== undefined && min > max) {
        errors.push({
          field: `${fieldPrefix}.conditions.priceRange`,
          message: 'Minimum price cannot be greater than maximum price'
        });
      }
    }

    // Validate tags
    if (criteria.conditions.tags && criteria.conditions.tags.length === 0) {
      errors.push({
        field: `${fieldPrefix}.conditions.tags`,
        message: 'If tags condition is specified, at least one tag must be provided'
      });
    }
  }

  return errors;
}

/**
 * Validates numeric input with specific constraints
 */
export function validateNumericInput(
  value: string,
  options: {
    required?: boolean;
    min?: number;
    max?: number;
    allowDecimals?: boolean;
    maxDecimals?: number;
  } = {}
): string | null {
  const { required = false, min, max, allowDecimals = true, maxDecimals = 2 } = options;

  // Check if required
  if (required && (!value || value.trim() === '')) {
    return 'This field is required';
  }

  // Allow empty for non-required fields
  if (!value || value.trim() === '') {
    return null;
  }

  // Check if numeric
  const num = parseFloat(value);
  if (isNaN(num)) {
    return 'Must be a valid number';
  }

  // Check decimal constraint
  if (!allowDecimals && value.includes('.')) {
    return 'Decimal values are not allowed';
  }

  // Check decimal places
  if (allowDecimals && value.includes('.')) {
    const decimals = value.split('.')[1];
    if (decimals && decimals.length > maxDecimals) {
      return `Cannot have more than ${maxDecimals} decimal places`;
    }
  }

  // Check min/max constraints
  if (min !== undefined && num < min) {
    return `Value must be at least ${min}`;
  }

  if (max !== undefined && num > max) {
    return `Value cannot exceed ${max}`;
  }

  return null;
}

/**
 * Formats validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): Record<string, string> {
  const formatted: Record<string, string> = {};
  
  errors.forEach(error => {
    // Convert array notation to dot notation for easier access
    const key = error.field.replace(/\[(\d+)\]/g, '.$1');
    formatted[key] = error.message;
  });

  return formatted;
}
