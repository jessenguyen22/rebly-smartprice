import {
  Card,
  BlockStack,
  Text,
  Button,
  InlineStack,
  Badge,
  Tooltip,
  Collapsible,
  List,
  Divider
} from '@shopify/polaris';
import { useState } from 'react';

interface PricingRule {
  whenCondition: string;
  whenValue: string;
  thenAction: string;
  thenMode: string;
  thenValue: string;
  changeCompareAt: boolean;
}

interface CampaignIntegrationHintProps {
  jobName: string;
  rules?: PricingRule[];
  bulkAmount?: string;
  bulkType?: 'increase' | 'decrease';
  successCount?: number;
  totalProcessed?: number;
}

export function CampaignIntegrationHint({
  jobName,
  rules,
  bulkAmount,
  bulkType,
  successCount = 0,
  totalProcessed = 0
}: CampaignIntegrationHintProps) {
  const [showPreview, setShowPreview] = useState(false);

  const formatRulePreview = (rule: PricingRule) => {
    const conditions: Record<string, string> = {
      'less_than_abs': 'Inventory drops below',
      'more_than_abs': 'Inventory rises above',
      'decreases_by_percent': 'Inventory decreases by',
      'increases_by_percent': 'Inventory increases by',
      'decreases_by_abs': 'Inventory decreases by',
      'increases_by_abs': 'Inventory increases by'
    };

    const actions: Record<string, string> = {
      'reduce_price': 'reduce price',
      'increase_price': 'increase price',
      'change_price': 'change price'
    };

    const modes: Record<string, string> = {
      'percentage': '%',
      'absolute': '$'
    };

    return `When ${conditions[rule.whenCondition] || rule.whenCondition} ${rule.whenValue}${rule.whenCondition.includes('percent') ? '%' : ''}, then ${actions[rule.thenAction] || rule.thenAction} by ${rule.thenValue}${modes[rule.thenMode] || ''}`;
  };

  const formatBulkPreview = () => {
    if (!bulkAmount || !bulkType) return null;
    return `Automatically ${bulkType} all selected product prices by $${bulkAmount}`;
  };

  return (
    <Card>
      <BlockStack gap="400">
        {/* Header Section */}
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <div style={{ fontSize: '18px' }}>🤖</div>
            <Text as="h3" variant="headingMd">
              Convert to Automated Campaign
            </Text>
            <Badge tone="info" size="small">Coming Soon</Badge>
          </InlineStack>
          
          <Tooltip content="This feature will be available in the Campaign module. Get notified when it's ready!">
            <div style={{ fontSize: '16px', cursor: 'help' }}>ℹ️</div>
          </Tooltip>
        </InlineStack>

        {/* Description */}
        <Text variant="bodyMd" as="p" tone="subdued">
          Turn this successful pricing job into an automated campaign that runs continuously based on real-time inventory changes.
        </Text>

        {/* Success Metrics */}
        {successCount > 0 && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: '#f0f9f0',
            borderRadius: '8px',
            border: '1px solid #b3d99b'
          }}>
            <Text variant="bodyMd" as="p">
              <strong>Great results!</strong> This job successfully updated {successCount} of {totalProcessed} variants. 
              An automated campaign could maintain these optimizations continuously.
            </Text>
          </div>
        )}

        {/* Preview Toggle */}
        <InlineStack gap="200">
          <Button
            variant="plain"
            onClick={() => setShowPreview(!showPreview)}
            disclosure={showPreview ? "up" : "down"}
          >
            Preview Campaign Automation
          </Button>
        </InlineStack>

        {/* Campaign Preview */}
        <Collapsible
          open={showPreview}
          id="campaign-preview-collapsible"
          transition={{duration: '150ms', timingFunction: 'ease-in-out'}}
        >
          <BlockStack gap="300">
            <Divider />
            
            <Text as="h4" variant="headingSm">
              How "{jobName}" would work as an automated campaign:
            </Text>

            <div style={{
              padding: '16px',
              backgroundColor: '#f6f6f7',
              borderRadius: '8px',
              borderLeft: '4px solid #006fbb'
            }}>
              <BlockStack gap="200">
                <Text variant="bodySm" as="p" fontWeight="semibold">
                  🔄 Campaign Rules (Auto-Generated):
                </Text>

                <List type="bullet">
                  {rules && rules.length > 0 ? (
                    rules.map((rule, index) => (
                      <List.Item key={index}>
                        {formatRulePreview(rule)}
                      </List.Item>
                    ))
                  ) : bulkAmount && bulkType ? (
                    <List.Item>
                      {formatBulkPreview()}
                    </List.Item>
                  ) : (
                    <List.Item>
                      Rules will be converted from your current pricing job configuration
                    </List.Item>
                  )}
                </List>

                <Text variant="bodySm" as="p" fontWeight="semibold">
                  ⚡ Real-Time Triggers:
                </Text>

                <List type="bullet">
                  <List.Item>Shopify inventory webhooks detect changes within 30-60 seconds</List.Item>
                  <List.Item>Campaign evaluates rules automatically and applies pricing updates</List.Item>
                  <List.Item>All changes logged to audit trail with campaign attribution</List.Item>
                  <List.Item>Dashboard shows live activity: "15:34 - Inventory changed, price updated in 45 seconds"</List.Item>
                </List>

                <Text variant="bodySm" as="p" fontWeight="semibold">
                  🎯 Campaign Management:
                </Text>

                <List type="bullet">
                  <List.Item>Pause/Resume campaign with immediate effect</List.Item>
                  <List.Item>Real-time performance analytics and revenue impact tracking</List.Item>
                  <List.Item>One-click rollback to pre-campaign pricing states</List.Item>
                  <List.Item>Campaign templates for easy setup of similar automation</List.Item>
                </List>
              </BlockStack>
            </div>

            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fff9e6',
              borderRadius: '8px',
              border: '1px solid #ffd580'
            }}>
              <Text variant="bodyMd" as="p">
                <strong>💡 Pro Tip:</strong> Save this job as a template now, so you can quickly create a campaign when the feature launches!
              </Text>
            </div>
          </BlockStack>
        </Collapsible>

        {/* Action Buttons */}
        <InlineStack gap="200">
          <Tooltip content="Campaign feature coming soon! We'll notify you when it's ready.">
            <Button
              variant="primary"
              disabled
            >
              🤖 Convert to Auto Campaign
            </Button>
          </Tooltip>
          
          <Button
            variant="secondary"
            url="mailto:support@rebly.com?subject=Notify me about Campaign feature&body=Hi! Please notify me when the Campaign automation feature is available. I'm interested in converting my pricing jobs to automated campaigns."
            external
          >
            Get Notified
          </Button>
        </InlineStack>

        {/* Additional Help */}
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <Text variant="bodySm" as="p" tone="subdued">
            <strong>What's the difference?</strong> Manual pricing jobs run once when you click "Execute". 
            Automated campaigns run continuously, monitoring inventory changes and applying your rules automatically 24/7.
          </Text>
        </div>
      </BlockStack>
    </Card>
  );
}
