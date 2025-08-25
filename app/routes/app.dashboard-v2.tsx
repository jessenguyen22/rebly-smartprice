import { useEffect } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  IndexTable,
  EmptyState,
  Banner,
  Icon,
  Box,
  Divider,
} from "@shopify/polaris";
import { 
  TitleBar,
  useAppBridge
} from "@shopify/app-bridge-react";
import { 
  ClockIcon,
  CalendarIcon,
  StatusActiveIcon,
  AlertTriangleIcon,
  CheckIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { createDatabaseManager } from "../models/database-manager.server";
import { initializeCampaignProcessing } from "../services/campaign-session-integration.server";
import { ClientOnly } from "../components/ClientOnly";
import { json } from "@remix-run/node";
import { prisma } from "../db.server";

export const loader = async (args: LoaderFunctionArgs) => {
  const { session, admin } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader(args);
  
  try {
    // Get shop ID for queries
    const shop = await prisma.shopifyShop.findUnique({
      where: { shopDomain: session.shop },
      select: { id: true }
    });

    if (!shop) {
      throw new Error('Shop not found');
    }

    // 1. ENTERPRISE RULE ENGINE STATUS - Core feature of SmartPrice
    const ruleExecutionStates = await prisma.ruleExecutionState.findMany({
      where: { 
        shopifyShopId: shop.id,
        campaign: { status: 'ACTIVE' }
      },
      include: {
        campaign: { 
          select: { 
            id: true, 
            name: true, 
            status: true, 
            triggerCount: true,
            lastTriggered: true 
          } 
        },
        rule: { 
          select: { 
            description: true, 
            whenCondition: true, 
            whenOperator: true, 
            whenValue: true,
            thenAction: true,
            thenMode: true,
            thenValue: true
          } 
        }
      },
      orderBy: { updatedAt: 'desc' },
      take: 15
    });

    // 2. RECENT PRICE CHANGES - Actual price changes from audit trail
    const recentPriceChanges = await prisma.auditTrailEntry.findMany({
      where: {
        shopifyShopId: shop.id,
        changeType: 'PRICE_CHANGE',
        entityType: 'VARIANT',
        timestamp: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 20,
      select: {
        id: true,
        entityId: true,
        oldValue: true,
        newValue: true,
        triggerReason: true,
        timestamp: true,
        userId: true,
        metadata: true,
        campaignId: true,
        pricingJobId: true
      }
    });

    // 3. PROCESSING RESULTS - Success/failure rates
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const processingResults = await prisma.processingResult.findMany({
      where: {
        processedAt: { gte: todayStart }
      },
      orderBy: { processedAt: 'desc' },
      take: 50,
      include: {
        pricingJob: {
          select: { 
            name: true, 
            type: true, 
            status: true,
            totalVariants: true,
            successCount: true,
            errorCount: true
          }
        }
      }
    });

    // 4. ACTIVE CAMPAIGNS with comprehensive data
    const activeCampaigns = await prisma.campaign.findMany({
      where: { 
        shopifyShopId: shop.id,
        status: 'ACTIVE' 
      },
      include: {
        rules: true,
        _count: {
          select: { 
            rules: true,
            executionStates: true 
          }
        }
      },
      orderBy: { lastTriggered: 'desc' }
    });

    // 5. RECENT PRICING JOBS for activity monitoring
    const recentPricingJobs = await prisma.pricingJob.findMany({
      where: { shopifyShopId: shop.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        selectedVariants: {
          take: 1,
          select: {
            productTitle: true,
            variantTitle: true
          }
        },
        _count: {
          select: { selectedVariants: true }
        }
      }
    });

    // Calculate metrics for dashboard
    const totalActiveRules = ruleExecutionStates.length;
    const triggeredRulesToday = ruleExecutionStates.filter(rs => 
      rs.triggeredAt && rs.triggeredAt >= todayStart
    ).length;
    
    const priceChangesToday = recentPriceChanges.filter(pc => 
      pc.timestamp >= todayStart
    ).length;

    const successfulProcesses = processingResults.filter(pr => pr.success).length;
    const totalProcesses = processingResults.length;
    const successRate = totalProcesses > 0 ? Math.round((successfulProcesses / totalProcesses) * 100) : 0;

    // Enterprise engine health metrics
    const ruleStateDistribution = {
      INACTIVE: ruleExecutionStates.filter(rs => rs.state === 'INACTIVE').length,
      TRIGGERED: ruleExecutionStates.filter(rs => rs.state === 'TRIGGERED').length,
      COOLING_DOWN: ruleExecutionStates.filter(rs => rs.state === 'COOLING_DOWN').length,
      RESET_PENDING: ruleExecutionStates.filter(rs => rs.state === 'RESET_PENDING').length,
    };

    return json({
      shop: session.shop,
      // Enterprise metrics
      ruleExecutionStates,
      ruleStateDistribution,
      enterpriseStats: {
        totalActiveRules,
        triggeredRulesToday,
        priceChangesToday,
        successRate
      },
      // Price change data
      recentPriceChanges,
      // Campaign data
      activeCampaigns,
      // Job activity
      recentPricingJobs,
      processingResults,
      systemHealth: {
        database: 'healthy' as const,
        shopifyAPI: 'healthy' as const,
        lastHealthCheck: new Date()
      }
    });

  } catch (error) {
    console.error('🚨 Dashboard loading error:', error);
    
    return json({
      shop: session.shop,
      ruleExecutionStates: [],
      ruleStateDistribution: { INACTIVE: 0, TRIGGERED: 0, COOLING_DOWN: 0, RESET_PENDING: 0 },
      enterpriseStats: { totalActiveRules: 0, triggeredRulesToday: 0, priceChangesToday: 0, successRate: 0 },
      recentPriceChanges: [],
      activeCampaigns: [],
      recentPricingJobs: [],
      processingResults: [],
      systemHealth: {
        database: 'error' as const,
        shopifyAPI: 'healthy' as const,
        lastHealthCheck: new Date()
      }
    });
  }
};

export default function SmartPriceDashboard() {
  const { 
    ruleExecutionStates, 
    ruleStateDistribution, 
    enterpriseStats, 
    recentPriceChanges,
    activeCampaigns,
    recentPricingJobs,
    systemHealth 
  } = useLoaderData<typeof loader>();
  
  const shopify = useAppBridge();

  const formatDateTime = (dateString: string | Date) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const getRuleStateBadge = (state: string) => {
    const stateMap: Record<string, { tone: any; children: string }> = {
      'INACTIVE': { tone: 'info', children: 'Inactive' },
      'TRIGGERED': { tone: 'success', children: 'Triggered' },
      'COOLING_DOWN': { tone: 'warning', children: 'Cooling Down' },
      'RESET_PENDING': { tone: 'attention', children: 'Reset Pending' },
    };
    return stateMap[state] || { tone: undefined, children: state };
  };

  const getJobStatusBadge = (status: string) => {
    const statusMap: Record<string, { tone: any; children: string }> = {
      'PENDING': { tone: 'info', children: 'Pending' },
      'RUNNING': { tone: 'attention', children: 'Running' },
      'COMPLETED': { tone: 'success', children: 'Completed' },
      'FAILED': { tone: 'critical', children: 'Failed' },
    };
    return statusMap[status] || { tone: undefined, children: status };
  };

  return (
    <Page>
      <TitleBar title="SmartPrice Enterprise Dashboard" />
      
      {/* System Health Alert */}
      {systemHealth.database === 'error' && (
        <Banner tone="critical" title="System Alert">
          Database connectivity issues detected. Enterprise rule engine may be impacted.
        </Banner>
      )}
      
      <BlockStack gap="500">
        {/* Enterprise Metrics Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Active Rules</Text>
                  <Icon source={StatusActiveIcon} tone="success" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{enterpriseStats.totalActiveRules}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Enterprise rules monitoring</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Triggers Today</Text>
                  <Icon source={AlertTriangleIcon} tone="warning" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{enterpriseStats.triggeredRulesToday}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Rules triggered today</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Price Changes</Text>
                  <Icon source={CalendarIcon} tone="subdued" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{enterpriseStats.priceChangesToday}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Automated changes today</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Rule State Distribution */}
        <Card>
          <BlockStack gap="400">
            <Text as="h2" variant="headingLg">Enterprise Rule Engine Status</Text>
            <Layout>
              <Layout.Section variant="oneThird">
                <Box padding="400" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200" align="center">
                    <Text as="p" variant="headingXl">{ruleStateDistribution.INACTIVE}</Text>
                    <Badge tone="info">Inactive</Badge>
                  </BlockStack>
                </Box>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <Box padding="400" background="bg-surface-success" borderRadius="200">
                  <BlockStack gap="200" align="center">
                    <Text as="p" variant="headingXl">{ruleStateDistribution.TRIGGERED}</Text>
                    <Badge tone="success">Triggered</Badge>
                  </BlockStack>
                </Box>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <Box padding="400" background="bg-surface-warning" borderRadius="200">
                  <BlockStack gap="200" align="center">
                    <Text as="p" variant="headingXl">{ruleStateDistribution.COOLING_DOWN}</Text>
                    <Badge tone="warning">Cooling</Badge>
                  </BlockStack>
                </Box>
              </Layout.Section>
            </Layout>
            <Box padding="400" background="bg-surface-caution" borderRadius="200">
              <BlockStack gap="200" align="center">
                <Text as="p" variant="headingXl">{ruleStateDistribution.RESET_PENDING}</Text>
                <Badge tone="attention">Reset Pending</Badge>
              </BlockStack>
            </Box>
          </BlockStack>
        </Card>

        {/* Main Content Layout */}
        <Layout>
          <Layout.Section>
            <BlockStack gap="500">
              {/* Recent Price Changes */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Recent Automated Price Changes</Text>
                    <Button url="/app/database" variant="secondary">View All Data</Button>
                  </InlineStack>
                  
                  {recentPriceChanges.length > 0 ? (
                    <ClientOnly fallback={<Text as="p">Loading price changes...</Text>}>
                      <IndexTable
                        itemCount={recentPriceChanges.length}
                        headings={[
                          { title: 'Variant ID' },
                          { title: 'Price Change' },
                          { title: 'Trigger' },
                          { title: 'Time' },
                          { title: 'Job' }
                        ]}
                        selectable={false}
                      >
                        {recentPriceChanges.map((change: any, index: number) => {
                          const variantId = change.entityId.split('/').pop();
                          const oldPrice = formatCurrency(change.oldValue);
                          const newPrice = formatCurrency(change.newValue);
                          const priceChangeAmount = parseFloat(change.newValue) - parseFloat(change.oldValue);
                          const isIncrease = priceChangeAmount > 0;
                          
                          return (
                            <IndexTable.Row id={change.id} key={change.id} position={index}>
                              <IndexTable.Cell>
                                <Text as="span" variant="bodyMd" fontWeight="medium">
                                  ...{variantId}
                                </Text>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <InlineStack gap="200">
                                  <Text as="span" variant="bodyMd">
                                    {oldPrice} → {newPrice}
                                  </Text>
                                  <Badge tone={isIncrease ? 'success' : 'critical'}>
                                    {(isIncrease ? '+' : '') + formatCurrency(priceChangeAmount)}
                                  </Badge>
                                </InlineStack>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  {change.triggerReason.length > 40 
                                    ? `${change.triggerReason.substring(0, 40)}...` 
                                    : change.triggerReason}
                                </Text>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  {formatDateTime(change.timestamp)}
                                </Text>
                              </IndexTable.Cell>
                              <IndexTable.Cell>
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  {change.pricingJobId ? '✓' : '—'}
                                </Text>
                              </IndexTable.Cell>
                            </IndexTable.Row>
                          );
                        })}
                      </IndexTable>
                    </ClientOnly>
                  ) : (
                    <EmptyState
                      heading="No recent price changes"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Automated price changes from active campaigns will appear here.</p>
                    </EmptyState>
                  )}
                </BlockStack>
              </Card>

              {/* Rule Execution States */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Rule Execution Monitor</Text>
                    <Text as="span" variant="bodyMd" tone="subdued">
                      Live enterprise rule states
                    </Text>
                  </InlineStack>
                  
                  {ruleExecutionStates.length > 0 ? (
                    <ClientOnly fallback={<Text as="p">Loading rule states...</Text>}>
                      <IndexTable
                        itemCount={ruleExecutionStates.length}
                        headings={[
                          { title: 'Campaign' },
                          { title: 'Rule Condition' },
                          { title: 'State' },
                          { title: 'Last Trigger' },
                          { title: 'Count' }
                        ]}
                        selectable={false}
                      >
                        {ruleExecutionStates.map((state: any, index: number) => (
                          <IndexTable.Row id={state.id} key={state.id} position={index}>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd" fontWeight="medium">
                                {state.campaign?.name || 'Unknown Campaign'}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {state.rule?.whenCondition} {state.rule?.whenOperator} {state.rule?.whenValue}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Badge {...getRuleStateBadge(state.state)} />
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd" tone="subdued">
                                {state.triggeredAt ? formatDateTime(state.triggeredAt) : 'Never'}
                              </Text>
                            </IndexTable.Cell>
                            <IndexTable.Cell>
                              <Text as="span" variant="bodyMd">
                                {state.triggerCount}
                              </Text>
                            </IndexTable.Cell>
                          </IndexTable.Row>
                        ))}
                      </IndexTable>
                    </ClientOnly>
                  ) : (
                    <EmptyState
                      heading="No active rule states"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Enterprise rule execution states will appear when campaigns are active.</p>
                    </EmptyState>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Active Campaigns */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Active Campaigns</Text>
                    <Button url="/app/campaigns" variant="primary">Manage</Button>
                  </InlineStack>
                  
                  {activeCampaigns.length > 0 ? (
                    <BlockStack gap="300">
                      {activeCampaigns.map((campaign: any) => (
                        <Card key={campaign.id} background="bg-surface-secondary">
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodyMd" fontWeight="medium">
                                {campaign.name}
                              </Text>
                              <Badge tone="success">Active</Badge>
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text as="span" variant="bodyMd" tone="subdued">
                                {campaign._count.rules} rules
                              </Text>
                              <Text as="span" variant="bodyMd" tone="subdued">
                                {campaign.triggerCount} triggers
                              </Text>
                            </InlineStack>
                            {campaign.lastTriggered && (
                              <Text as="span" variant="bodyMd" tone="subdued">
                                Last: {formatDateTime(campaign.lastTriggered)}
                              </Text>
                            )}
                            <Divider />
                            <Text as="span" variant="bodyMd" tone="subdued">
                              Products: {Array.isArray(campaign.targetProducts?.productIds) ? 
                                campaign.targetProducts.productIds.length : 0}
                            </Text>
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>
                  ) : (
                    <EmptyState
                      heading="No active campaigns"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Create campaigns to automate pricing based on inventory levels.</p>
                      <div style={{ marginTop: '16px' }}>
                        <Button url="/app/campaigns/create" variant="primary">Create Campaign</Button>
                      </div>
                    </EmptyState>
                  )}
                </BlockStack>
              </Card>

              {/* Recent Job Activity */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingLg">Recent Job Activity</Text>
                  
                  {recentPricingJobs.length > 0 ? (
                    <BlockStack gap="300">
                      {recentPricingJobs.slice(0, 5).map((job: any) => {
                        const jobTypeBadge = job.type === 'CAMPAIGN' ? { tone: 'success' as const, children: 'Auto' } : 
                                           { tone: 'info' as const, children: 'Manual' };
                        
                        return (
                          <Card key={job.id} background="bg-surface-tertiary">
                            <BlockStack gap="200">
                              <InlineStack align="space-between">
                                <Text as="span" variant="bodyMd" fontWeight="medium">
                                  {job.name.length > 30 ? `${job.name.substring(0, 30)}...` : job.name}
                                </Text>
                                <Badge {...jobTypeBadge} />
                              </InlineStack>
                              <InlineStack align="space-between">
                                <Badge {...getJobStatusBadge(job.status)} />
                                <Text as="span" variant="bodyMd" tone="subdued">
                                  {job._count.selectedVariants} variants
                                </Text>
                              </InlineStack>
                              <Text as="span" variant="bodyMd" tone="subdued">
                                {formatDateTime(job.createdAt)}
                              </Text>
                            </BlockStack>
                          </Card>
                        );
                      })}
                    </BlockStack>
                  ) : (
                    <EmptyState
                      heading="No recent jobs"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Pricing job activity will appear here.</p>
                    </EmptyState>
                  )}
                </BlockStack>
              </Card>

              {/* Quick Actions */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingLg">Quick Actions</Text>
                  <BlockStack gap="200">
                    <Button url="/app/campaigns/create" variant="primary" size="large">
                      Create Campaign
                    </Button>
                    <Button url="/app/campaigns" variant="secondary" size="large">
                      Manage Campaigns  
                    </Button>
                    <Button url="/app/database" variant="secondary" size="large">
                      View All Data
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
