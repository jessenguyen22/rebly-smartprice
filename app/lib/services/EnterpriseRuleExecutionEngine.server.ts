/**
 * Enterprise-Grade Rule Execution Engine
 * 
 * Implements state-based rule execution with threshold crossing detection
 * to prevent rule re-triggering oscillation - used by major e-commerce 
 * and financial trading systems worldwide.
 * 
 * Key Features:
 * - Threshold Crossing Detection
 * - Hysteresis Pattern Support
 * - State Machine Management
 * - Performance Optimized
 * - Full Audit Trail
 */

import { prisma } from '../../db.server';
import type { PricingRule, Campaign } from '@prisma/client';

// Define enum values manually to avoid import issues  
export enum RuleExecutionState {
  INACTIVE = 'INACTIVE',
  TRIGGERED = 'TRIGGERED', 
  COOLING_DOWN = 'COOLING_DOWN',
  RESET_PENDING = 'RESET_PENDING'
}

export enum ThresholdDirection {
  ABOVE = 'ABOVE',
  BELOW = 'BELOW',
  CROSSING_UP = 'CROSSING_UP',
  CROSSING_DOWN = 'CROSSING_DOWN'
}

export interface VariantStateSnapshot {
  variantId: string;
  productId: string;
  inventoryQuantity: number;
  priceAmount: number;
  compareAtPrice?: number;
  capturedAt: Date;
}

export interface RuleEvaluationContext {
  rule: PricingRule;
  campaign: Campaign;
  currentState: VariantStateSnapshot;
  previousState?: VariantStateSnapshot;
  executionState?: any; // RuleExecutionState record
}

export interface ThresholdCrossingResult {
  crossed: boolean;
  direction: ThresholdDirection;
  previousValue?: number;
  currentValue: number;
  threshold: number;
  shouldTrigger: boolean;
  reason: string;
}

export class EnterpriseRuleExecutionEngine {
  
  /**
   * CORE METHOD: Evaluate if rule should execute with enterprise-grade logic
   */
  static async shouldExecuteRule(context: RuleEvaluationContext): Promise<{
    shouldExecute: boolean;
    reason: string;
    crossingResult?: ThresholdCrossingResult;
    stateTransition?: string;
  }> {
    console.log(`🎯 [ENTERPRISE ENGINE] Evaluating rule ${context.rule.id} for variant ${context.currentState.variantId}`);
    
    try {
      // Step 1: Get current execution state
      const executionState = await this.getOrCreateExecutionState(
        context.rule.id,
        context.currentState.variantId,
        context.campaign.id,
        context.campaign.shopifyShopId
      );
      
      // Step 2: Check if rule is in cooldown
      if (await this.isInCooldown(executionState)) {
        return {
          shouldExecute: false,
          reason: 'Rule is in cooldown period',
          stateTransition: `${executionState.state} -> COOLING_DOWN`
        };
      }
      
      // Step 3: Evaluate threshold crossing (THE KEY INNOVATION)
      const crossingResult = await this.evaluateThresholdCrossing(context, executionState);
      
      // Step 4: Apply state machine logic
      const stateDecision = await this.evaluateStateTransition(executionState, crossingResult);
      
      console.log(`🎯 [DECISION] Rule ${context.rule.id}: ${stateDecision.shouldExecute ? 'EXECUTE' : 'SKIP'} - ${stateDecision.reason}`);
      
      return {
        shouldExecute: stateDecision.shouldExecute,
        reason: stateDecision.reason,
        crossingResult,
        stateTransition: stateDecision.stateTransition
      };
      
    } catch (error) {
      console.error(`❌ [ENTERPRISE ENGINE] Error evaluating rule:`, error);
      return {
        shouldExecute: false,
        reason: `Error in rule evaluation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  /**
   * THRESHOLD CROSSING DETECTION - Prevents oscillation
   */
  private static async evaluateThresholdCrossing(
    context: RuleEvaluationContext,
    executionState: any
  ): Promise<ThresholdCrossingResult> {
    const { rule, currentState, previousState } = context;
    
    console.log(`🔍 [CROSSING DETECTION] Rule: ${rule.description}`);
    console.log(`📊 Current inventory: ${currentState.inventoryQuantity}, Previous: ${previousState?.inventoryQuantity || 'N/A'}`);
    
    const threshold = parseFloat(rule.whenValue);
    const currentValue = currentState.inventoryQuantity;
    const previousValue = previousState?.inventoryQuantity || currentValue;
    
    // Determine current position relative to threshold
    const currentDirection = this.getThresholdDirection(currentValue, threshold, rule.whenCondition);
    const previousDirection = this.getThresholdDirection(previousValue, threshold, rule.whenCondition);
    
    // Check for threshold crossing
    const crossed = currentDirection !== previousDirection;
    
    // Determine if we should trigger based on state and crossing
    let shouldTrigger = false;
    let reason = '';
    
    if (executionState.state === RuleExecutionState.INACTIVE) {
      // Only trigger if condition is met AND we've crossed the threshold
      const conditionMet = this.evaluateCondition(currentValue, threshold, rule.whenCondition);
      if (conditionMet) {
        if (!previousState || crossed) {
          shouldTrigger = true;
          reason = crossed ? 
            `Threshold crossed: ${previousValue} -> ${currentValue} (threshold: ${threshold})` :
            `Initial condition met: ${currentValue} ${rule.whenOperator} ${threshold}`;
        } else {
          reason = `Condition met but no threshold crossing detected`;
        }
      } else {
        reason = `Condition not met: ${currentValue} not ${rule.whenOperator} ${threshold}`;
      }
    } else if (executionState.state === RuleExecutionState.TRIGGERED) {
      // Check if reset condition is met (hysteresis)
      const resetConditionMet = await this.checkResetCondition(rule, currentValue, executionState);
      if (resetConditionMet) {
        reason = `Reset condition met - rule can be re-triggered on next crossing`;
      } else {
        reason = `Rule already triggered - awaiting reset condition`;
      }
    }
    
    console.log(`🎯 [CROSSING RESULT] Crossed: ${crossed}, Direction: ${currentDirection}, Should Trigger: ${shouldTrigger}`);
    console.log(`📝 [REASON] ${reason}`);
    
    return {
      crossed,
      direction: currentDirection,
      previousValue,
      currentValue,
      threshold,
      shouldTrigger,
      reason
    };
  }
  
  /**
   * STATE MACHINE EVALUATION - Enterprise state management
   */
  private static async evaluateStateTransition(
    executionState: any,
    crossingResult: ThresholdCrossingResult
  ): Promise<{ shouldExecute: boolean; reason: string; stateTransition: string }> {
    
    const currentState = executionState.state as RuleExecutionState;
    
    switch (currentState) {
      case RuleExecutionState.INACTIVE:
        if (crossingResult.shouldTrigger) {
          await this.updateExecutionState(executionState.id, {
            state: RuleExecutionState.TRIGGERED,
            triggeredAt: new Date(),
            lastTriggerValue: crossingResult.currentValue,
            lastInventoryValue: crossingResult.currentValue,
            thresholdDirection: crossingResult.direction,
            triggerCount: executionState.triggerCount + 1
          });
          
          return {
            shouldExecute: true,
            reason: crossingResult.reason,
            stateTransition: `INACTIVE -> TRIGGERED`
          };
        }
        break;
        
      case RuleExecutionState.TRIGGERED:
        // Check if reset condition is met
        const resetConditionMet = await this.checkResetCondition(
          executionState, 
          crossingResult.currentValue, 
          executionState
        );
        
        if (resetConditionMet) {
          await this.updateExecutionState(executionState.id, {
            state: RuleExecutionState.RESET_PENDING,
            resetConditionMet: true
          });
          
          return {
            shouldExecute: false,
            reason: 'Reset condition met - rule ready for next trigger',
            stateTransition: `TRIGGERED -> RESET_PENDING`
          };
        }
        break;
        
      case RuleExecutionState.RESET_PENDING:
        if (crossingResult.shouldTrigger && crossingResult.crossed) {
          await this.updateExecutionState(executionState.id, {
            state: RuleExecutionState.TRIGGERED,
            triggeredAt: new Date(),
            lastTriggerValue: crossingResult.currentValue,
            lastInventoryValue: crossingResult.currentValue,
            thresholdDirection: crossingResult.direction,
            triggerCount: executionState.triggerCount + 1,
            resetConditionMet: false
          });
          
          return {
            shouldExecute: true,
            reason: `Re-triggered after reset: ${crossingResult.reason}`,
            stateTransition: `RESET_PENDING -> TRIGGERED`
          };
        }
        break;
        
      case RuleExecutionState.COOLING_DOWN:
        // Handled in cooldown check
        break;
    }
    
    return {
      shouldExecute: false,
      reason: `State machine decision: ${currentState} - no action required`,
      stateTransition: `${currentState} -> ${currentState}`
    };
  }
  
  /**
   * UTILITY METHODS
   */
  
  private static getThresholdDirection(value: number, threshold: number, operator: string): ThresholdDirection {
    switch (operator) {
      case 'less_than_abs':
      case 'less_than_pct':
        return value < threshold ? ThresholdDirection.BELOW : ThresholdDirection.ABOVE;
      case 'greater_than_abs':
      case 'greater_than_pct':
        return value > threshold ? ThresholdDirection.ABOVE : ThresholdDirection.BELOW;
      case 'equals':
        return value === threshold ? ThresholdDirection.ABOVE : ThresholdDirection.BELOW;
      default:
        return ThresholdDirection.BELOW;
    }
  }
  
  private static evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'less_than_abs':
      case 'less_than_pct':
        return value < threshold;
      case 'greater_than_abs':
      case 'greater_than_pct':
        return value > threshold;
      case 'equals':
        return value === threshold;
      default:
        return false;
    }
  }
  
  private static async checkResetCondition(rule: any, currentValue: number, executionState: any): Promise<boolean> {
    // Implement hysteresis: different threshold for reset
    // For now, use simple logic - can be enhanced with rule_threshold_configs table
    
    if (rule.whenOperator === 'less_than_abs') {
      // If rule triggers when inventory < 20, reset when inventory >= 25 (hysteresis)
      const resetThreshold = parseFloat(rule.whenValue) + 5;
      return currentValue >= resetThreshold;
    }
    
    // Add more reset conditions as needed
    return false;
  }
  
  /**
   * DATABASE OPERATIONS
   */
  
  private static async getOrCreateExecutionState(
    ruleId: string, 
    variantId: string, 
    campaignId: string,
    shopifyShopId: string
  ) {
    return await prisma.ruleExecutionState.upsert({
      where: {
        variantId_ruleId: { variantId, ruleId }
      },
      update: {
        updatedAt: new Date()
      },
      create: {
        ruleId,
        variantId,
        campaignId,
        shopifyShopId,
        state: RuleExecutionState.INACTIVE,
        triggerCount: 0,
        resetConditionMet: false
      }
    });
  }
  
  private static async updateExecutionState(executionStateId: string, updates: any) {
    return await prisma.ruleExecutionState.update({
      where: { id: executionStateId },
      data: {
        ...updates,
        updatedAt: new Date()
      }
    });
  }
  
  private static async isInCooldown(executionState: any): Promise<boolean> {
    if (!executionState.cooldownUntil) return false;
    return new Date() < executionState.cooldownUntil;
  }
  
  /**
   * VARIANT STATE TRACKING
   */
  
  static async captureVariantState(
    variantId: string,
    productId: string,
    inventoryQuantity: number,
    priceAmount: number,
    shopifyShopId: string,
    changeReason?: string
  ): Promise<void> {
    try {
      // Get previous state for change calculation
      const previousState = await prisma.variantStateHistory.findFirst({
        where: { variantId },
        orderBy: { capturedAt: 'desc' }
      });
      
      const inventoryChange = previousState ? 
        inventoryQuantity - previousState.inventoryQuantity : 0;
      const priceChange = previousState ? 
        priceAmount - previousState.priceAmount.toNumber() : 0;
      
      // Only capture if there's a meaningful change
      if (Math.abs(inventoryChange) > 0 || Math.abs(priceChange) > 0.01) {
        await prisma.variantStateHistory.create({
          data: {
            variantId,
            productId,
            inventoryQuantity,
            priceAmount,
            inventoryChange,
            priceChange,
            changeReason: changeReason || 'webhook_update',
            shopifyShopId
          }
        });
        
        console.log(`📊 [STATE CAPTURED] Variant ${variantId}: inventory ${inventoryChange > 0 ? '+' : ''}${inventoryChange}, price ${priceChange > 0 ? '+' : ''}${priceChange.toFixed(2)}`);
      }
    } catch (error) {
      console.error(`❌ Failed to capture variant state:`, error);
    }
  }
  
  static async getVariantStateHistory(variantId: string, limit: number = 2) {
    return await prisma.variantStateHistory.findMany({
      where: { variantId },
      orderBy: { capturedAt: 'desc' },
      take: limit
    });
  }
}

export default EnterpriseRuleExecutionEngine;
