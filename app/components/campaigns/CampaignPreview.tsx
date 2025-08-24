import { useState } from 'react';
import {
  Card,
  Text,
  Button,
  ButtonGroup,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  List,
  Box,
  Icon
} from '@shopify/polaris';
import { EditIcon, ViewIcon, CheckIcon } from '@shopify/polaris-icons';
import type { CreateCampaignData } from '../../types/campaign';

interface CampaignPreviewProps {
  data: CreateCampaignData;
  onEdit: () => void;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function CampaignPreview({ 
  data, 
  onEdit, 
  onConfirm, 
  onCancel, 
  isSubmitting = false 
}: CampaignPreviewProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
    } finally {
      setIsConfirming(false);
    }
  };

  const formatTargetProducts = (targetProducts: typeof data.targetProducts) => {
    return targetProducts.map((criteria, index) => {
      let description = '';
      
      switch (criteria.type) {
        case 'all':
          description = 'All products in store';
          break;
        case 'product':
          const productCount = Array.isArray(criteria.value) ? criteria.value.length : 0;
          description = `${productCount} specific product${productCount !== 1 ? 's' : ''}`;
          break;
        case 'collection':
          const collectionCount = Array.isArray(criteria.value) ? criteria.value.length : 0;
          description = `Products from ${collectionCount} collection${collectionCount !== 1 ? 's' : ''}`;
          break;
        case 'variant':
          const variantCount = Array.isArray(criteria.value) ? criteria.value.length : 0;
          description = `${variantCount} specific variant${variantCount !== 1 ? 's' : ''}`;
          break;
        case 'tag':
          const tags = Array.isArray(criteria.value) ? criteria.value : [criteria.value];
          description = `Products tagged with: ${tags.filter(Boolean).join(', ')}`;
          break;
        default:
          description = 'Unknown targeting criteria';
      }

      // Add conditions if present
      const conditions = [];
      if (criteria.conditions?.inventoryLevel) {
        conditions.push(
          `Inventory ${criteria.conditions.inventoryLevel.operator} ${criteria.conditions.inventoryLevel.value}`
        );
      }
      if (criteria.conditions?.priceRange?.min !== undefined || criteria.conditions?.priceRange?.max !== undefined) {
        const min = criteria.conditions.priceRange.min;
        const max = criteria.conditions.priceRange.max;
        if (min !== undefined && max !== undefined) {
          conditions.push(`Price between $${min.toFixed(2)} - $${max.toFixed(2)}`);
        } else if (min !== undefined) {
          conditions.push(`Price above $${min.toFixed(2)}`);
        } else if (max !== undefined) {
          conditions.push(`Price below $${max.toFixed(2)}`);
        }
      }
      if (criteria.conditions?.tags && criteria.conditions.tags.length > 0) {
        conditions.push(`Must have tags: ${criteria.conditions.tags.join(', ')}`);
      }

      if (conditions.length > 0) {
        description += ` (${conditions.join(', ')})`;
      }

      return description;
    });
  };

  const formatRule = (rule: typeof data.rules[0], index: number) => {
    const whenText = `When inventory ${rule.whenCondition.replace(/_/g, ' ')} ${rule.whenOperator} ${rule.whenValue}${rule.whenCondition.includes('percent') ? '%' : ''}`;
    const thenText = `Then ${rule.thenAction.replace(/_/g, ' ')} by ${rule.thenValue}${rule.thenMode === 'percentage' ? '%' : ` $`}`;
    const compareAtText = rule.changeCompareAt ? ' (including compare-at price)' : '';
    
    return {
      condition: whenText,
      action: thenText + compareAtText,
      description: rule.description
    };
  };

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingLg" as="h1">
              Campaign Preview
            </Text>
            <Badge tone="info">Draft</Badge>
          </InlineStack>
          
          <Text tone="subdued" as="p">
            Review your campaign configuration before creating. You can edit any details or proceed to create the campaign.
          </Text>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            Campaign Details
          </Text>
          
          <InlineStack align="space-between">
            <Box>
              <Text variant="headingSm" as="h3" tone="subdued">
                Name
              </Text>
              <Text variant="bodyLg" as="p">
                {data.name}
              </Text>
            </Box>
            <Button
              variant="tertiary"
              icon={EditIcon}
              onClick={onEdit}
              accessibilityLabel="Edit campaign details"
            />
          </InlineStack>

          {data.description && (
            <>
              <Divider />
              <Box>
                <Text variant="headingSm" as="h3" tone="subdued">
                  Description
                </Text>
                <Text variant="bodyMd" as="p">
                  {data.description}
                </Text>
              </Box>
            </>
          )}

          <Divider />
          <Box>
            <Text variant="headingSm" as="h3" tone="subdued">
              Priority
            </Text>
            <Text variant="bodyMd" as="p">
              {data.priority || 1} (Higher numbers = higher priority)
            </Text>
          </Box>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">
              Pricing Rules ({data.rules.length})
            </Text>
            <Button
              variant="tertiary"
              icon={EditIcon}
              onClick={onEdit}
              accessibilityLabel="Edit pricing rules"
            />
          </InlineStack>

          <BlockStack gap="300">
            {data.rules.map((rule, index) => {
              const formattedRule = formatRule(rule, index);
              return (
                <Card key={index} background="bg-surface-secondary">
                  <BlockStack gap="200">
                    <Text variant="headingSm" as="h4">
                      Rule {index + 1}
                      {formattedRule.description && (
                        <Text variant="bodySm" tone="subdued" as="span">
                          {' - '}{formattedRule.description}
                        </Text>
                      )}
                    </Text>
                    
                    <List type="bullet">
                      <List.Item>
                        <Text variant="bodyMd" as="span">
                          <strong>Condition:</strong> {formattedRule.condition}
                        </Text>
                      </List.Item>
                      <List.Item>
                        <Text variant="bodyMd" as="span">
                          <strong>Action:</strong> {formattedRule.action}
                        </Text>
                      </List.Item>
                    </List>
                  </BlockStack>
                </Card>
              );
            })}
          </BlockStack>

          <Text variant="bodySm" tone="subdued" as="p">
            Rules will be evaluated in the order shown above. The first matching rule will be applied.
          </Text>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <InlineStack align="space-between">
            <Text variant="headingMd" as="h2">
              Target Products
            </Text>
            <Button
              variant="tertiary"
              icon={EditIcon}
              onClick={onEdit}
              accessibilityLabel="Edit target products"
            />
          </InlineStack>

          <List type="bullet">
            {formatTargetProducts(data.targetProducts).map((description, index) => (
              <List.Item key={index}>
                <Text variant="bodyMd" as="span">
                  {description}
                </Text>
              </List.Item>
            ))}
          </List>

          <Text variant="bodySm" tone="subdued" as="p">
            Products matching any of the above criteria will be included in this campaign.
          </Text>
        </BlockStack>
      </Card>

      <Card>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h2">
            What Happens Next?
          </Text>
          
          <List type="number">
            <List.Item>
              <Text variant="bodyMd" as="span">
                Campaign will be created in <Badge tone="warning">Draft</Badge> status
              </Text>
            </List.Item>
            <List.Item>
              <Text variant="bodyMd" as="span">
                You can review and test the campaign configuration
              </Text>
            </List.Item>
            <List.Item>
              <Text variant="bodyMd" as="span">
                Activate the campaign to start monitoring inventory changes
              </Text>
            </List.Item>
            <List.Item>
              <Text variant="bodyMd" as="span">
                Webhooks will automatically trigger pricing updates when conditions are met
              </Text>
            </List.Item>
          </List>

          <Box background="bg-surface-caution" padding="300" borderRadius="200">
            <InlineStack gap="200" align="start">
              <Icon source={ViewIcon} tone="caution" />
              <BlockStack gap="200">
                <Text variant="headingSm" as="h4" tone="caution">
                  Important Reminder
                </Text>
                <Text variant="bodyMd" as="p">
                  Once activated, this campaign will automatically modify product prices when inventory conditions are met. 
                  Always test with a small subset of products first and monitor the results carefully.
                </Text>
              </BlockStack>
            </InlineStack>
          </Box>
        </BlockStack>
      </Card>

      <Card>
        <InlineStack gap="300" align="end">
          <Button
            onClick={onCancel}
            disabled={isSubmitting || isConfirming}
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={onEdit}
            disabled={isSubmitting || isConfirming}
            icon={EditIcon}
          >
            Edit Campaign
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={isSubmitting || isConfirming}
            icon={CheckIcon}
          >
            Create Campaign
          </Button>
        </InlineStack>
      </Card>
    </BlockStack>
  );
}
