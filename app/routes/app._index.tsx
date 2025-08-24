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
} from "@shopify/polaris";
import { 
  TitleBar,
  useAppBridge
} from "@shopify/app-bridge-react";
import { 
  ClockIcon,
  CalendarIcon,
  StatusActiveIcon
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { createDatabaseManager } from "../models/database-manager.server";
import { initializeCampaignProcessing } from "../services/campaign-session-integration.server";
import { ClientOnly } from "../components/ClientOnly";
import { json } from "@remix-run/node";

export const loader = async (args: LoaderFunctionArgs) => {
  // Initialize campaign processing with admin client registration
  const { session, admin } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader(args);
  
  try {
    // Use database manager for optimized connection handling
    const dbManager = createDatabaseManager(session.shop);
    
    // Load all dashboard data with connection optimization
    const { activeCampaigns, recentAuditEntries, recentJobs, jobCounts } = 
      await dbManager.getDashboardData();

    console.log('📊 Dashboard data loaded:', {
      activeCampaigns: activeCampaigns?.length || 0,
      recentJobs: recentJobs?.length || 0,
      jobCounts,
      recentAuditEntries: recentAuditEntries?.length || 0
    });

    // Calculate quick stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Count actual pricing jobs created today
    const actualTodayJobs = recentJobs?.filter((job: any) => {
      const jobDate = new Date(job?.createdAt || new Date());
      return jobDate.getTime() >= today.getTime();
    }).length || 0;

    // Use actual pricing jobs for Recent Pricing Jobs table
    const allRecentJobs = recentJobs || [];
    console.log('🔍 Recent jobs for display:', allRecentJobs.map(job => ({
      id: job?.id,
      name: job?.name,
      type: job?.type,
      status: job?.status,
      totalVariants: job?.totalVariants
    })));

    const recentPriceChanges = recentAuditEntries?.filter((entry: any) => 
      entry?.entityType === 'variant' && entry?.changeType === 'price_update'
    ).length || 0;

    // System health check
    const systemHealth = {
      database: 'healthy' as const,
      shopifyAPI: 'healthy' as const,
      lastHealthCheck: new Date()
    };

    return json({
      shop: session.shop,
      activeCampaigns: activeCampaigns || [],
      recentJobs: allRecentJobs,
      quickStats: {
        totalJobsToday: actualTodayJobs,
        activeCampaignCount: activeCampaigns?.length || 0,
        recentPriceChanges,
        totalJobs: jobCounts || 0
      },
      systemHealth
    });
  } catch (error) {
    console.error('Dashboard data loading error:', error);
    
    // Return minimal error state to prevent cascade failures
    return json({
      shop: session.shop,
      activeCampaigns: [],
      recentJobs: [],
      quickStats: {
        totalJobsToday: 0,
        activeCampaignCount: 0,
        recentPriceChanges: 0,
        totalJobs: 0
      },
      systemHealth: {
        database: 'error' as const,
        shopifyAPI: 'healthy' as const,
        lastHealthCheck: new Date()
      }
    });
  }
};

export default function Dashboard() {
  const { activeCampaigns, recentJobs, quickStats, systemHealth } = useLoaderData<typeof loader>();
  
  const shopify = useAppBridge();
  
  useEffect(() => {
    if (systemHealth.database === 'error') {
      shopify.toast.show("Database connection issues detected", { isError: true });
    }
  }, [systemHealth.database, shopify]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { status: any; children: string }> = {
      'ACTIVE': { status: 'success', children: 'Active' },
      'PENDING': { status: 'info', children: 'Pending' },
      'RUNNING': { status: 'attention', children: 'Running' },
      'COMPLETED': { status: 'success', children: 'Completed' },
      'FAILED': { status: 'critical', children: 'Failed' },
      'DRAFT': { status: '', children: 'Draft' },
      'PAUSED': { status: 'warning', children: 'Paused' }
    };
    
    return statusMap[status] || { status: '', children: status };
  };

  const recentJobsTableData = recentJobs?.map((job: any) => ({
    id: job?.id || '',
    name: job?.name || 'Pricing Job',  // Use job name directly from PricingJob table
    type: job?.type || 'MANUAL',       // Should be MANUAL, CAMPAIGN, etc.
    status: job?.status || 'COMPLETED', // Should be PENDING, RUNNING, COMPLETED, FAILED
    createdAt: job?.createdAt || new Date().toISOString(),
    totalVariants: job?.totalVariants || 0,  // From PricingJob.totalVariants
    successCount: job?.successCount || 0     // From PricingJob.successCount
  })) || [];

  const activeCampaignsTableData = activeCampaigns?.map((campaign: any) => ({
    id: campaign?.id || '',
    name: campaign?.name || 'Campaign',
    status: campaign?.status || 'DRAFT',
    triggerCount: campaign?.triggerCount || 0,
    lastTriggered: campaign?.lastTriggered,
    rulesCount: campaign?.rules?.length || 0
  })) || [];

  return (
    <Page>
      <TitleBar title="Pricing Dashboard" />
      
      {/* System Health Banner */}
      {systemHealth.database === 'error' && (
        <Banner tone="critical" title="System Status">
          Database connectivity issues detected. Some features may be limited.
        </Banner>
      )}
      
      <BlockStack gap="500">
        {/* Quick Stats Cards */}
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Jobs Today</Text>
                  <Icon source={CalendarIcon} tone="subdued" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{quickStats.totalJobsToday}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Pricing jobs created today</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Active Campaigns</Text>
                  <Icon source={StatusActiveIcon} tone="subdued" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{quickStats.activeCampaignCount}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Currently running campaigns</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <InlineStack align="space-between">
                  <Text as="h3" variant="headingMd">Recent Changes</Text>
                  <Icon source={ClockIcon} tone="subdued" />
                </InlineStack>
                <Text as="p" variant="heading2xl">{quickStats.recentPriceChanges}</Text>
                <Text as="p" variant="bodyMd" tone="subdued">Price updates in recent activity</Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Main Content */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">Recent Pricing Jobs</Text>
                  <Button url="/app/pricing-job" variant="primary">Create Pricing Job</Button>
                </InlineStack>
                
                {recentJobsTableData.length > 0 ? (
                  <ClientOnly 
                    fallback={
                      <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <Text variant="bodyMd" as="p">Loading recent jobs...</Text>
                      </div>
                    }
                  >
                    <IndexTable
                      itemCount={recentJobsTableData.length}
                      headings={[
                        { title: 'Job Name' },
                        { title: 'Type' },
                        { title: 'Status' },
                        { title: 'Variants' },
                        { title: 'Success Rate' },
                        { title: 'Created' }
                      ]}
                      selectable={false}
                    >
                      {recentJobsTableData.map((job: any, index: number) => (
                        <IndexTable.Row id={job.id} key={job.id} position={index}>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd" fontWeight="medium">
                              {job.name}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Badge tone="info">{job.type}</Badge>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Badge {...getStatusBadge(job.status)} />
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {job.totalVariants}
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd">
                              {job.totalVariants > 0 ? 
                                `${Math.round((job.successCount / job.totalVariants) * 100)}%` : 
                                'N/A'
                              }
                            </Text>
                          </IndexTable.Cell>
                          <IndexTable.Cell>
                            <Text as="span" variant="bodyMd" tone="subdued">
                              {formatDateTime(job.createdAt)}
                            </Text>
                          </IndexTable.Cell>
                        </IndexTable.Row>
                      ))}
                    </IndexTable>
                  </ClientOnly>
                ) : (
                  <EmptyState
                    heading="No pricing jobs yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Start by creating your first pricing job to see activity here.</p>
                    <div style={{ marginTop: '16px' }}>
                      <Button url="/app/pricing-job" variant="primary">Create Pricing Job</Button>
                    </div>
                  </EmptyState>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              {/* Active Campaigns */}
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between">
                    <Text as="h2" variant="headingLg">Active Campaigns</Text>
                    <Button url="/app/campaigns" disabled>Create Campaign</Button>
                  </InlineStack>
                  
                  {activeCampaignsTableData.length > 0 ? (
                    <BlockStack gap="300">
                      {activeCampaignsTableData.slice(0, 3).map((campaign: any) => (
                        <Card key={campaign.id} background="bg-surface-secondary">
                          <BlockStack gap="200">
                            <InlineStack align="space-between">
                              <Text as="span" variant="bodyMd" fontWeight="medium">
                                {campaign.name}
                              </Text>
                              <Badge {...getStatusBadge(campaign.status)} />
                            </InlineStack>
                            <InlineStack gap="400">
                              <Text as="span" variant="bodyMd" tone="subdued">
                                {campaign.rulesCount} rules
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
                          </BlockStack>
                        </Card>
                      ))}
                    </BlockStack>
                  ) : (
                    <EmptyState
                      heading="No active campaigns"
                      image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                    >
                      <p>Automated campaigns will appear here when activated.</p>
                    </EmptyState>
                  )}
                </BlockStack>
              </Card>

              {/* Quick Actions */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingLg">Quick Actions</Text>
                  <BlockStack gap="200">
                    <Button url="/app/pricing-job" variant="primary" size="large">
                      Create Pricing Job
                    </Button>
                    <Button url="/app/campaigns" disabled size="large">
                      Create Campaign (Coming Soon)
                    </Button>
                    <Button url="/app/database" variant="secondary" size="large">
                      View Database Dashboard
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
