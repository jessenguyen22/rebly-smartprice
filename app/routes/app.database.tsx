import { useState, useEffect } from "react";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  DataTable,
  Badge,
  BlockStack,
  InlineStack
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import { prisma } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  // Get shop info
  const shop = await prisma.shopifyShop.findUnique({
    where: { shopDomain: session.shop }
  });

  if (!shop) {
    return json({ 
      shop: null,
      stats: null,
      campaigns: [],
      recentAudits: []
    });
  }

  // Get statistics
  const [campaignCount, auditCount, activeCount] = await Promise.all([
    prisma.campaign.count({ where: { shopifyShopId: shop.id } }),
    prisma.auditTrailEntry.count({ where: { shopifyShopId: shop.id } }),
    prisma.campaign.count({ 
      where: { 
        shopifyShopId: shop.id,
        status: 'ACTIVE'
      } 
    })
  ]);

  // Get recent campaigns
  const campaigns = await prisma.campaign.findMany({
    where: { shopifyShopId: shop.id },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: {
      rules: true
    }
  });

  // Get recent audit entries
  const recentAudits = await prisma.auditTrailEntry.findMany({
    where: { shopifyShopId: shop.id },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  return json({
    shop,
    stats: {
      totalCampaigns: campaignCount,
      totalAudits: auditCount,
      activeCampaigns: activeCount
    },
    campaigns,
    recentAudits
  });
};

export default function DatabaseDashboard() {
  const { shop, stats, campaigns, recentAudits } = useLoaderData<typeof loader>();

  if (!shop) {
    return (
      <Page>
        <TitleBar title="Database Dashboard" />
        <Card>
          <Text as="p" variant="bodyLg">No shop data found. Please use the app first to generate some data.</Text>
        </Card>
      </Page>
    );
  }

  // Prepare campaign table data
  const campaignRows = campaigns.map((campaign: any) => [
    campaign.name.substring(0, 30) + (campaign.name.length > 30 ? '...' : ''),
    <Badge key={campaign.id} tone={campaign.status === 'ACTIVE' ? 'success' : 'info'}>
      {campaign.status}
    </Badge>,
    campaign.triggerCount.toString(),
    new Date(campaign.createdAt).toLocaleDateString(),
    campaign.rules.length.toString()
  ]);

  // Prepare audit table data with product names
  const auditRows = recentAudits.map((audit: any) => {
    let displayName = audit.entityId.replace('gid://shopify/ProductVariant/', '');
    
    // Try to get product and variant names from metadata
    if (audit.metadata && typeof audit.metadata === 'object') {
      const metadata = audit.metadata as any;
      
      // Check if metadata has variant and product info
      if (metadata.variant && metadata.product) {
        displayName = `${metadata.product.title} - ${metadata.variant.title}`;
      } else if (metadata.productTitle && metadata.variantTitle) {
        displayName = `${metadata.productTitle} - ${metadata.variantTitle}`;
      } else if (metadata.productTitle) {
        displayName = metadata.productTitle;
      }
    }
    
    return [
      displayName,
      audit.changeType,
      `$${audit.oldValue} → $${audit.newValue}`,
      audit.triggerReason?.substring(0, 40) + (audit.triggerReason?.length > 40 ? '...' : '') || 'N/A',
      new Date(audit.timestamp).toLocaleString()
    ];
  });

  return (
    <Page>
      <TitleBar title="Database Dashboard" />
      <BlockStack gap="500">
        
        {/* Shop Info */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Shop Information</Text>
                <InlineStack gap="400">
                  <Text as="p" variant="bodyMd"><strong>Domain:</strong> {shop.shopDomain}</Text>
                  <Text as="p" variant="bodyMd"><strong>Currency:</strong> {shop.currency || 'N/A'}</Text>
                  <Text as="p" variant="bodyMd"><strong>Country:</strong> {shop.country || 'N/A'}</Text>
                  <Text as="p" variant="bodyMd"><strong>Timezone:</strong> {shop.timezone || 'N/A'}</Text>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Statistics */}
        <Layout>
          <Layout.Section>
            <InlineStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Total Campaigns</Text>
                  <Text as="p" variant="headingLg">{stats?.totalCampaigns || 0}</Text>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Active Campaigns</Text>
                  <Text as="p" variant="headingLg">{stats?.activeCampaigns || 0}</Text>
                </BlockStack>
              </Card>
              
              <Card>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">Audit Entries</Text>
                  <Text as="p" variant="headingLg">{stats?.totalAudits || 0}</Text>
                </BlockStack>
              </Card>
            </InlineStack>
          </Layout.Section>
        </Layout>

        {/* Recent Campaigns */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Recent Campaigns</Text>
                {campaigns.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'numeric', 'text', 'numeric']}
                    headings={['Campaign Name', 'Status', 'Triggers', 'Created', 'Rules']}
                    rows={campaignRows}
                  />
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">No campaigns found</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Recent Audit Entries */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Recent Price Changes</Text>
                {recentAudits.length > 0 ? (
                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                    headings={['Product / Variant', 'Action', 'Price Change', 'Reason', 'Timestamp']}
                    rows={auditRows}
                  />
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">No audit entries found</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

      </BlockStack>
    </Page>
  );
}
