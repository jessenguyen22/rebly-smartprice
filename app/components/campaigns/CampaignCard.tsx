import React from 'react';
import { 
  Card, 
  Text, 
  BlockStack, 
  InlineStack, 
  Button, 
  Divider,
  Badge,
  Tooltip
} from '@shopify/polaris';
import { StatusIndicator, type CampaignStatus } from './StatusIndicator';

export interface CampaignData {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  metrics: {
    triggerCount: number;
    lastTriggered?: string;
    affectedProductsCount: number;
    totalPriceChanges: number;
    averagePriceChange: number;
    successRate: number;
  };
}

interface CampaignCardProps {
  campaign: CampaignData;
  onEdit?: (campaignId: string) => void;
  onToggleStatus?: (campaignId: string, newStatus: CampaignStatus) => void;
  onDelete?: (campaignId: string) => void;
  onViewDetails?: (campaignId: string) => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getStatusActions(status: CampaignStatus): CampaignStatus[] {
  switch (status) {
    case 'DRAFT':
      return ['ACTIVE'];
    case 'ACTIVE':
      return ['PAUSED'];
    case 'PAUSED':
      return ['ACTIVE', 'COMPLETED'];
    case 'COMPLETED':
      return [];
    default:
      return [];
  }
}

function getActionLabel(status: CampaignStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'Activate';
    case 'PAUSED':
      return 'Pause';
    case 'COMPLETED':
      return 'Complete';
    default:
      return 'Update';
  }
}

export function CampaignCard({
  campaign,
  onEdit,
  onToggleStatus,
  onDelete,
  onViewDetails
}: CampaignCardProps) {
  const { metrics } = campaign;
  const availableActions = getStatusActions(campaign.status);
  
  const handleStatusChange = (newStatus: CampaignStatus) => {
    onToggleStatus?.(campaign.id, newStatus);
  };

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header with title and status */}
        <InlineStack align="space-between" blockAlign="start">
          <BlockStack gap="200">
            <Text variant="headingMd" as="h3">
              {campaign.name}
            </Text>
            {campaign.description && (
              <Text variant="bodyMd" tone="subdued" as="p">
                {campaign.description}
              </Text>
            )}
          </BlockStack>
          <StatusIndicator status={campaign.status} />
        </InlineStack>

        <Divider />

        {/* Metrics Grid */}
        <InlineStack gap="400" wrap={false}>
          <BlockStack gap="100">
            <Text variant="bodyMd" tone="subdued" as="span">
              Triggered
            </Text>
            <Text variant="headingSm" as="span">
              {metrics.triggerCount.toLocaleString()}
            </Text>
          </BlockStack>

          <BlockStack gap="100">
            <Text variant="bodyMd" tone="subdued" as="span">
              Products
            </Text>
            <Text variant="headingSm" as="span">
              {metrics.affectedProductsCount}
            </Text>
          </BlockStack>

          <BlockStack gap="100">
            <Text variant="bodyMd" tone="subdued" as="span">
              Success Rate
            </Text>
            <Text variant="headingSm" as="span">
              {metrics.successRate}%
            </Text>
          </BlockStack>

          <BlockStack gap="100">
            <Text variant="bodyMd" tone="subdued" as="span">
              Avg. Change
            </Text>
            <Tooltip content="Average price change per update">
              <Text variant="headingSm" as="span">
                {formatCurrency(metrics.averagePriceChange)}
              </Text>
            </Tooltip>
          </BlockStack>
        </InlineStack>

        {/* Last triggered and total changes */}
        <InlineStack gap="400" align="space-between">
          <BlockStack gap="100">
            <Text variant="bodyMd" tone="subdued" as="span">
              Last Triggered
            </Text>
            <Text variant="bodySm" as="span">
              {metrics.lastTriggered 
                ? formatDateTime(metrics.lastTriggered)
                : 'Never'
              }
            </Text>
          </BlockStack>
          
          <BlockStack gap="100">
            <Text variant="bodyMd" tone="subdued" as="span">
              Total Changes
            </Text>
            <Text variant="bodySm" as="span">
              {metrics.totalPriceChanges.toLocaleString()}
            </Text>
          </BlockStack>
        </InlineStack>

        <Divider />

        {/* Action Buttons */}
        <InlineStack gap="200" align="space-between">
          <InlineStack gap="200">
            <Button onClick={() => onViewDetails?.(campaign.id)}>
              View Details
            </Button>
            {campaign.status === 'DRAFT' && onEdit && (
              <Button onClick={() => onEdit(campaign.id)}>
                Edit
              </Button>
            )}
          </InlineStack>

          <InlineStack gap="200">
            {availableActions.map((action) => (
              <Button
                key={action}
                onClick={() => handleStatusChange(action)}
                variant={action === 'ACTIVE' ? 'primary' : 'secondary'}
                tone={action === 'COMPLETED' ? 'critical' : undefined}
              >
                {getActionLabel(action)}
              </Button>
            ))}
            
            {onDelete && campaign.status === 'DRAFT' && (
              <Button 
                onClick={() => onDelete(campaign.id)}
                variant="secondary"
                tone="critical"
              >
                Delete
              </Button>
            )}
          </InlineStack>
        </InlineStack>

        {/* Created/Updated dates */}
        <InlineStack gap="400" align="space-between">
          <Text variant="bodyXs" tone="subdued" as="span">
            Created {formatDate(campaign.createdAt)}
          </Text>
          <Text variant="bodyXs" tone="subdued" as="span">
            Updated {formatDate(campaign.updatedAt)}
          </Text>
        </InlineStack>
      </BlockStack>
    </Card>
  );
}
