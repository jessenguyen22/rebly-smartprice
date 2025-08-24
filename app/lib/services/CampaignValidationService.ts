import type { ValidationResult } from '../validation/campaignValidation';

export interface PricingRuleInput {
  description?: string;
  whenCondition: string;
  whenOperator: string;
  whenValue: string;
  thenAction: string;
  thenMode: string;
  thenValue: string;
  changeCompareAt: boolean;
}

export class CampaignValidationService {
  
  /**
   * Validate campaign pricing rules for business logic
   */
  async validateCampaignRules(rules: PricingRuleInput[]): Promise<ValidationResult> {
    const errors: string[] = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const ruleErrors = this.validateSingleRule(rule, i + 1);
      errors.push(...ruleErrors);
    }

    // Check for rule conflicts
    const conflictErrors = this.checkRuleConflicts(rules);
    errors.push(...conflictErrors);

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate a single pricing rule
   */
  private validateSingleRule(rule: PricingRuleInput, ruleNumber: number): string[] {
    const errors: string[] = [];

    // Validate when condition values
    const whenErrors = this.validateWhenCondition(rule, ruleNumber);
    errors.push(...whenErrors);

    // Validate then action values
    const thenErrors = this.validateThenAction(rule, ruleNumber);
    errors.push(...thenErrors);

    // Validate logical consistency
    const logicErrors = this.validateRuleLogic(rule, ruleNumber);
    errors.push(...logicErrors);

    return errors;
  }

  /**
   * Validate when condition part of rule
   */
  private validateWhenCondition(rule: PricingRuleInput, ruleNumber: number): string[] {
    const errors: string[] = [];

    // Validate numeric values for numeric operators
    if (['greater_than', 'less_than', 'between'].includes(rule.whenOperator)) {
      if (rule.whenCondition === 'inventory_level' || rule.whenCondition === 'current_price') {
        if (rule.whenOperator === 'between') {
          const [min, max] = rule.whenValue.split(',');
          if (!min || !max || isNaN(Number(min)) || isNaN(Number(max))) {
            errors.push(`Rule ${ruleNumber}: Between operator requires two comma-separated numbers`);
          } else if (Number(min) >= Number(max)) {
            errors.push(`Rule ${ruleNumber}: First value must be less than second value for between operator`);
          }
        } else {
          if (isNaN(Number(rule.whenValue))) {
            errors.push(`Rule ${ruleNumber}: Numeric operator requires a valid number`);
          }
        }
      }
    }

    // Validate inventory level conditions
    if (rule.whenCondition === 'inventory_level') {
      const value = Number(rule.whenValue);
      if (rule.whenOperator !== 'between' && (value < 0 || value > 10000)) {
        errors.push(`Rule ${ruleNumber}: Inventory level must be between 0 and 10,000`);
      }
    }

    // Validate price conditions
    if (rule.whenCondition === 'current_price') {
      const value = Number(rule.whenValue);
      if (rule.whenOperator !== 'between' && (value < 0 || value > 100000)) {
        errors.push(`Rule ${ruleNumber}: Price must be between $0 and $100,000`);
      }
    }

    return errors;
  }

  /**
   * Validate then action part of rule
   */
  private validateThenAction(rule: PricingRuleInput, ruleNumber: number): string[] {
    const errors: string[] = [];

    const value = Number(rule.thenValue);

    if (rule.thenAction === 'percentage') {
      if (isNaN(value) || value <= 0 || value > 100) {
        errors.push(`Rule ${ruleNumber}: Percentage value must be between 0.01 and 100`);
      }
      
      // Warn about extreme percentage changes
      if (value > 50) {
        errors.push(`Rule ${ruleNumber}: Warning - Percentage changes over 50% may be too extreme`);
      }
    }

    if (rule.thenAction === 'fixed_amount') {
      if (isNaN(value) || value <= 0) {
        errors.push(`Rule ${ruleNumber}: Fixed amount must be a positive number`);
      }
      
      if (value > 1000) {
        errors.push(`Rule ${ruleNumber}: Warning - Fixed amount changes over $1000 may be too extreme`);
      }
    }

    if (rule.thenAction === 'set_price') {
      if (isNaN(value) || value <= 0 || value > 100000) {
        errors.push(`Rule ${ruleNumber}: Set price must be between $0.01 and $100,000`);
      }
    }

    return errors;
  }

  /**
   * Validate rule logic consistency
   */
  private validateRuleLogic(rule: PricingRuleInput, ruleNumber: number): string[] {
    const errors: string[] = [];

    // Check for logical inconsistencies
    if (rule.whenCondition === 'inventory_level' && rule.whenOperator === 'greater_than') {
      if (rule.thenMode === 'increase') {
        errors.push(`Rule ${ruleNumber}: Warning - Increasing price when inventory is high may reduce sales`);
      }
    }

    if (rule.whenCondition === 'inventory_level' && rule.whenOperator === 'less_than') {
      if (rule.thenMode === 'decrease') {
        errors.push(`Rule ${ruleNumber}: Warning - Decreasing price when inventory is low may not be optimal`);
      }
    }

    // Validate compare at price logic
    if (rule.changeCompareAt && rule.thenMode === 'increase') {
      errors.push(`Rule ${ruleNumber}: Warning - Increasing compare at price with price increase may confuse customers`);
    }

    return errors;
  }

  /**
   * Check for conflicts between rules
   */
  private checkRuleConflicts(rules: PricingRuleInput[]): string[] {
    const errors: string[] = [];

    for (let i = 0; i < rules.length; i++) {
      for (let j = i + 1; j < rules.length; j++) {
        const rule1 = rules[i];
        const rule2 = rules[j];

        // Check for overlapping conditions
        if (this.rulesOverlap(rule1, rule2)) {
          errors.push(`Rules ${i + 1} and ${j + 1} have overlapping conditions and may conflict`);
        }

        // Check for contradictory actions
        if (this.rulesContradict(rule1, rule2)) {
          errors.push(`Rules ${i + 1} and ${j + 1} have contradictory actions`);
        }
      }
    }

    return errors;
  }

  /**
   * Check if two rules have overlapping conditions
   */
  private rulesOverlap(rule1: PricingRuleInput, rule2: PricingRuleInput): boolean {
    if (rule1.whenCondition !== rule2.whenCondition) {
      return false;
    }

    // Simple overlap detection for same condition types
    if (rule1.whenOperator === 'equals' && rule2.whenOperator === 'equals') {
      return rule1.whenValue === rule2.whenValue;
    }

    // Add more sophisticated overlap detection as needed
    return false;
  }

  /**
   * Check if two rules contradict each other
   */
  private rulesContradict(rule1: PricingRuleInput, rule2: PricingRuleInput): boolean {
    if (rule1.whenCondition === rule2.whenCondition && rule1.whenValue === rule2.whenValue) {
      // Same trigger condition but opposite actions
      if (rule1.thenMode === 'increase' && rule2.thenMode === 'decrease') {
        return true;
      }
      if (rule1.thenMode === 'decrease' && rule2.thenMode === 'increase') {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate campaign can be activated
   */
  async validateCampaignActivation(campaignId: string): Promise<ValidationResult> {
    const errors: string[] = [];

    // Add activation-specific validations
    // - Check if products still exist
    // - Validate rules against current inventory
    // - Check for active conflicting campaigns
    // etc.

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate campaign targeting
   */
  validateTargetProducts(targetProducts: any): ValidationResult {
    const errors: string[] = [];

    if (!targetProducts.productIds && !targetProducts.collections && 
        !targetProducts.tags && !targetProducts.vendors && !targetProducts.productTypes) {
      errors.push('Campaign must target at least one product, collection, tag, vendor, or product type');
    }

    // Validate arrays are not empty if provided
    Object.entries(targetProducts).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length === 0) {
        errors.push(`${key} array cannot be empty if provided`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
