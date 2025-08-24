import { useState, useCallback } from 'react';
import {
  Card,
  Text,
  Button,
  BlockStack,
  InlineStack,
  Select,
  TextField,
  Checkbox,
  Icon,
  InlineError,
  Divider
} from '@shopify/polaris';
import { PlusIcon, DeleteIcon } from '@shopify/polaris-icons';
import type { CreatePricingRuleData } from '../../types/campaign';

interface RuleBuilderProps {
  rules: CreatePricingRuleData[];
  onChange: (rules: CreatePricingRuleData[]) => void;
  error?: string;
}

const WHEN_CONDITIONS = [
  { label: 'Inventory decreases by (%)', value: 'decreases_by_percent' },
  { label: 'Inventory decreases by (Abs)', value: 'decreases_by_abs' },
  { label: 'Inventory is Less than (Abs)', value: 'less_than_abs' },
  { label: 'Inventory is More than (Abs)', value: 'more_than_abs' },
];

const THEN_ACTIONS = [
  { label: 'Reduce Price', value: 'reduce_price' },
  { label: 'Increase Price', value: 'increase_price' },
  { label: 'Change Price', value: 'change_price' },
];

const THEN_MODES = [
  { label: 'by Percentage (%)', value: 'percentage' },
  { label: 'by Absolute', value: 'absolute' },
];

function RuleEditor({ 
  rule, 
  onChange, 
  onDelete, 
  index 
}: { 
  rule: CreatePricingRuleData; 
  onChange: (rule: CreatePricingRuleData) => void;
  onDelete: () => void;
  index: number;
}) {
  const handleFieldChange = useCallback((field: keyof CreatePricingRuleData, value: string | boolean) => {
    onChange({ ...rule, [field]: value });
  }, [rule, onChange]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingSm" as="h4">
            Rule {index + 1}
          </Text>
          <Button
            variant="tertiary"
            tone="critical"
            icon={DeleteIcon}
            onClick={onDelete}
            accessibilityLabel={`Delete rule ${index + 1}`}
          />
        </InlineStack>

        <TextField
          label="Rule Description (Optional)"
          value={rule.description || ''}
          onChange={(value) => handleFieldChange('description', value)}
          placeholder="E.g., Black Friday inventory clearance rule"
          autoComplete="off"
        />

        <Divider />

        <Text variant="headingSm" as="h5">
          When (Trigger Condition)
        </Text>

        <InlineStack gap="400">
          <div style={{ flex: 2 }}>
            <Select
              label="Condition"
              options={WHEN_CONDITIONS}
              value={rule.whenCondition}
              onChange={(value) => handleFieldChange('whenCondition', value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <TextField
              label="Value"
              type="number"
              value={rule.whenValue}
              onChange={(value) => handleFieldChange('whenValue', value)}
              suffix={rule.whenCondition.includes('percent') ? '%' : rule.whenCondition.includes('abs') ? '' : ''}
              autoComplete="off"
            />
          </div>
        </InlineStack>

        <Divider />

        <Text variant="headingSm" as="h5">
          Then (Pricing Action)
        </Text>

        <InlineStack gap="400">
          <div style={{ flex: 2 }}>
            <Select
              label="Action"
              options={THEN_ACTIONS}
              value={rule.thenAction}
              onChange={(value) => handleFieldChange('thenAction', value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <Select
              label="Mode"
              options={THEN_MODES}
              value={rule.thenMode}
              onChange={(value) => handleFieldChange('thenMode', value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <TextField
              label="Value"
              type="number"
              value={rule.thenValue}
              onChange={(value) => handleFieldChange('thenValue', value)}
              prefix={rule.thenMode === 'fixed' ? '$' : ''}
              suffix={rule.thenMode === 'percentage' ? '%' : ''}
              autoComplete="off"
            />
          </div>
        </InlineStack>

        <Checkbox
          label="Also change compare-at price"
          checked={rule.changeCompareAt}
          onChange={(checked) => handleFieldChange('changeCompareAt', checked)}
          helpText="If enabled, the compare-at price will also be updated to maintain discount visibility"
        />
      </BlockStack>
    </Card>
  );
}

export function RuleBuilder({ rules, onChange, error }: RuleBuilderProps) {
  const handleAddRule = useCallback(() => {
    const newRule: CreatePricingRuleData = {
      description: '',
      whenCondition: 'less_than_abs',
      whenOperator: 'lte', // Default operator for compatibility  
      whenValue: '20',
      thenAction: 'increase_price',
      thenMode: 'absolute',
      thenValue: '10',
      changeCompareAt: false,
    };
    onChange([...rules, newRule]);
  }, [rules, onChange]);

  const handleRuleChange = useCallback((index: number, updatedRule: CreatePricingRuleData) => {
    const updatedRules = [...rules];
    updatedRules[index] = updatedRule;
    onChange(updatedRules);
  }, [rules, onChange]);

  const handleDeleteRule = useCallback((index: number) => {
    const updatedRules = rules.filter((_, i) => i !== index);
    onChange(updatedRules);
  }, [rules, onChange]);

  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h3">
            Pricing Rules
          </Text>
          <Button
            icon={PlusIcon}
            onClick={handleAddRule}
            variant="primary"
            tone="success"
          >
            Add Rule
          </Button>
        </InlineStack>

        {error && (
          <InlineError message={error} fieldID="rules-error" />
        )}

        {rules.length === 0 ? (
          <Text tone="subdued" as="p">
            No pricing rules defined. Click "Add Rule" to create your first automated pricing rule.
          </Text>
        ) : (
          <BlockStack gap="400">
            {rules.map((rule, index) => (
              <RuleEditor
                key={index}
                rule={rule}
                index={index}
                onChange={(updatedRule) => handleRuleChange(index, updatedRule)}
                onDelete={() => handleDeleteRule(index)}
              />
            ))}
          </BlockStack>
        )}

        <Text variant="bodySm" tone="subdued" as="p">
          Rules will be evaluated in order. The first matching rule will be applied when inventory conditions are met.
        </Text>
      </BlockStack>
    </Card>
  );
}
