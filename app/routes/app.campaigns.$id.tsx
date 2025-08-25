import { json, redirect } from '@remix-run/node';
import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from '@remix-run/node';
import { useLoaderData, Form } from '@remix-run/react';
import { Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Button, Divider } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import { authenticate } from '../shopify.server';
import { Breadcrumb } from '../components/navigation/Breadcrumb';
import { CampaignService } from '../lib/services/CampaignService';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';
import { prisma } from '../db.server';
import type { CampaignWithRules, PricingRule, TargetProductCriteria } from '../types/campaign';

// Helper function to ensure shop exists in database
async function ensureShopExists(shopDomain: string, accessToken?: string): Promise<void> {
  try {
    await prisma.shopifyShop.upsert({
      where: { shopDomain },
      update: { 
        accessToken: accessToken || undefined,
        updatedAt: new Date() 
      },
      create: {
        shopDomain,
        accessToken: accessToken || null,
      }
    });
  } catch (error) {
    console.error('Failed to ensure shop exists:', error);
    throw error;
  }
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  return [
    { title: data?.campaign ? `${data.campaign.name} - SmartPrice` : "Campaign - SmartPrice" },
    { name: "description", content: data?.campaign ? `Manage and monitor the ${data.campaign.name} pricing campaign.` : "View campaign details and performance metrics." },
  ];
};

export async function action({ request, params }: ActionFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader({
      request,
      params,
      context: {}
    });
    
    if (!params.id) {
      throw new Error('Campaign ID is required');
    }

    const formData = await request.formData();
    const actionType = formData.get('action');
    
    const campaignService = new CampaignService(session.shop);
    
    switch (actionType) {
      case 'activate':
        await campaignService.updateCampaignStatus(params.id, 'ACTIVE');
        break;
      case 'pause':
        await campaignService.updateCampaignStatus(params.id, 'PAUSED');
        break;
      case 'delete':
        // Use soft delete (archive) instead of hard delete to support all campaign statuses
        await campaignService.updateCampaignStatus(params.id, 'ARCHIVED');
        return redirect('/app/campaigns');
      default:
        throw new Error('Invalid action');
    }
    
    return redirect(`/app/campaigns/${params.id}`);
  } catch (error: any) {
    console.error('Campaign action failed:', error);
    return json({ error: error.message }, { status: 400 });
  }
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader({
      request,
      params,
      context: {}
    });
    
    // Ensure shop exists in database
    await ensureShopExists(session.shop, session.accessToken);
    
    if (!params.id) {
      throw new Error('Campaign ID is required');
    }

    const campaignService = new CampaignService(session.shop);
    const campaign = await campaignService.getCampaign(params.id);
    
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    
    // Debug targetProducts structure
    console.log('Campaign data:', JSON.stringify(campaign, null, 2));
    console.log('Target products type:', typeof campaign.targetProducts);
    console.log('Target products value:', campaign.targetProducts);
    
    return json({
      campaign,
      shopDomain: session.shop
    });
  } catch (error: any) {
    console.error('Failed to load campaign:', error);
    return json({
      campaign: null,
      shopDomain: '',
      error: error.message || 'Failed to load campaign'
    }, { status: error.message === 'Campaign not found' ? 404 : 500 });
  }
}

export default function CampaignDetail() {
  const data = useLoaderData<typeof loader>();
  
  // Type guard to check if data has error
  if ('error' in data && (data.error || !data.campaign)) {
    return (
      <Page>
        <TitleBar title="Campaign Not Found" />
        <Card>
          <Text as="p">
            {data.error || 'The requested campaign could not be found.'}
          </Text>
        </Card>
      </Page>
    );
  }

  const { campaign } = data;

  if (!campaign) {
    return (
      <Page>
        <TitleBar title="Campaign Not Found" />
        <Card>
          <Text as="p">Campaign not found</Text>
        </Card>
      </Page>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'success';
      case 'PAUSED': return 'warning';  
      case 'DRAFT': return 'info';
      default: return 'critical';
    }
  };

  // Helper function to get target products count
  const getTargetProductsCount = (targetProducts: any) => {
    if (!targetProducts) return 0;
    
    let count = 0;
    if (targetProducts.productIds?.length) count += targetProducts.productIds.length;
    if (targetProducts.collections?.length) count += targetProducts.collections.length;
    if (targetProducts.tags?.length) count += targetProducts.tags.length;
    if (targetProducts.vendors?.length) count += targetProducts.vendors.length;
    if (targetProducts.productTypes?.length) count += targetProducts.productTypes.length;
    
    return count;
  };

  const targetProductsCount = getTargetProductsCount(campaign.targetProducts);
  
  // Cast targetProducts to proper type to access properties
  const targetProducts = campaign.targetProducts as any;

  return (
    <Page
      backAction={{
        content: 'Campaigns',
        url: '/app/campaigns'
      }}
      title={campaign.name}
    >
      <TitleBar 
        title={campaign.name}
      />
      
      <BlockStack gap="500">
        <Breadcrumb items={[
          {label: 'Campaigns', url: '/app/campaigns'},
          {label: campaign.name}
        ]} />
      
        <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {/* Campaign Info */}
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingLg">Campaign Details</Text>
                  <Badge tone={getStatusColor(campaign.status) as any}>
                    {campaign.status}
                  </Badge>
                </InlineStack>
                
                <Text as="p" variant="bodyMd">
                  {campaign.description}
                </Text>
                
                <InlineStack gap="400">
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="semibold">Created:</Text>{' '}
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </Text>
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="semibold">Updated:</Text>{' '}
                    {new Date(campaign.updatedAt).toLocaleDateString()}
                  </Text>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* Metrics */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Performance Summary</Text>
                
                <Layout>
                  <Layout.Section variant="oneThird">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="p" variant="headingXl">{campaign.triggerCount}</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Total Triggers</Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                  
                  <Layout.Section variant="oneThird">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="p" variant="headingXl">{targetProductsCount}</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Target Products</Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                  
                  <Layout.Section variant="oneThird">
                    <Card>
                      <BlockStack gap="200">
                        <Text as="p" variant="headingXl">{campaign.rules?.length || 0}</Text>
                        <Text as="p" variant="bodyMd" tone="subdued">Active Rules</Text>
                      </BlockStack>
                    </Card>
                  </Layout.Section>
                </Layout>
                
                {campaign.lastTriggered && (
                  <Text as="p" variant="bodyMd">
                    <Text as="span" fontWeight="semibold">Last Triggered:</Text>{' '}
                    {new Date(campaign.lastTriggered).toLocaleString()}
                  </Text>
                )}
              </BlockStack>
            </Card>

            {/* Pricing Rules */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Pricing Rules</Text>
                
                {Array.isArray(campaign.rules) && campaign.rules.map((rule: any, index: number) => (
                  <Card key={rule.id} background="bg-surface-secondary">
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingMd">Rule {index + 1}</Text>
                        <Badge tone={rule.isActive ? 'success' : 'critical'}>
                          {rule.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </InlineStack>
                      
                      <Text as="p" variant="bodyMd">
                        <Text as="span" fontWeight="semibold">When:</Text>{' '}
                        {rule.whenCondition} {rule.whenOperator} {rule.whenValue}
                      </Text>
                      
                      <Text as="p" variant="bodyMd">
                        <Text as="span" fontWeight="semibold">Then:</Text>{' '}
                        {rule.thenAction} by {rule.thenValue}
                        {rule.thenAction === 'adjust_percentage' ? '%' : ''}
                      </Text>
                    </BlockStack>
                  </Card>
                ))}
              </BlockStack>
            </Card>

            {/* Target Products */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Target Products</Text>
                
                {targetProductsCount > 0 ? (
                  <BlockStack gap="300">
                    {/* Display Product IDs */}
                    {targetProducts?.productIds?.length > 0 && (
                      <div>
                        <Text as="h3" variant="headingMd" fontWeight="semibold">Products ({targetProducts.productIds.length})</Text>
                        <BlockStack gap="200">
                          {targetProducts.productIds.map((productId: string, index: number) => (
                            <Card key={productId} background="bg-surface-secondary">
                              <InlineStack align="space-between">
                                <BlockStack gap="200">
                                  <Text as="p" variant="bodyMd">Product ID: {productId}</Text>
                                </BlockStack>
                                <Button variant="secondary" size="micro">
                                  View Product
                                </Button>
                              </InlineStack>
                            </Card>
                          ))}
                        </BlockStack>
                      </div>
                    )}

                    {/* Display Collections */}
                    {targetProducts?.collections?.length > 0 && (
                      <div>
                        <Text as="h3" variant="headingMd" fontWeight="semibold">Collections ({targetProducts.collections.length})</Text>
                        <BlockStack gap="200">
                          {targetProducts.collections.map((collectionId: string, index: number) => (
                            <Card key={collectionId} background="bg-surface-secondary">
                              <Text as="p" variant="bodyMd">Collection ID: {collectionId}</Text>
                            </Card>
                          ))}
                        </BlockStack>
                      </div>
                    )}

                    {/* Display Tags */}
                    {targetProducts?.tags?.length > 0 && (
                      <div>
                        <Text as="h3" variant="headingMd" fontWeight="semibold">Tags ({targetProducts.tags.length})</Text>
                        <InlineStack gap="200">
                          {targetProducts.tags.map((tag: string, index: number) => (
                            <Badge key={tag} tone="info">{tag}</Badge>
                          ))}
                        </InlineStack>
                      </div>
                    )}

                    {/* Display Vendors */}
                    {targetProducts?.vendors?.length > 0 && (
                      <div>
                        <Text as="h3" variant="headingMd" fontWeight="semibold">Vendors ({targetProducts.vendors.length})</Text>
                        <InlineStack gap="200">
                          {targetProducts.vendors.map((vendor: string, index: number) => (
                            <Badge key={vendor} tone="success">{vendor}</Badge>
                          ))}
                        </InlineStack>
                      </div>
                    )}

                    {/* Display Product Types */}
                    {targetProducts?.productTypes?.length > 0 && (
                      <div>
                        <Text as="h3" variant="headingMd" fontWeight="semibold">Product Types ({targetProducts.productTypes.length})</Text>
                        <InlineStack gap="200">
                          {targetProducts.productTypes.map((type: string, index: number) => (
                            <Badge key={type} tone="warning">{type}</Badge>
                          ))}
                        </InlineStack>
                      </div>
                    )}
                  </BlockStack>
                ) : (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No target products configured
                  </Text>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <BlockStack gap="400">
            {/* Quick Actions */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">Actions</Text>
                
                <Form method="post">
                  <BlockStack gap="300">
                    <input type="hidden" name="action" value={campaign.status === 'ACTIVE' ? 'pause' : 'activate'} />
                    <Button 
                      variant="primary" 
                      fullWidth
                      submit
                      tone={campaign.status === 'ACTIVE' ? 'critical' : 'success'}
                    >
                      {campaign.status === 'ACTIVE' ? 'Pause Campaign' : 'Activate Campaign'}
                    </Button>
                  </BlockStack>
                </Form>
                
                {campaign.status === 'DRAFT' && (
                  <Button variant="secondary" fullWidth>
                    Edit Campaign
                  </Button>
                )}
                
                <Button variant="secondary" fullWidth>
                  View History
                </Button>
                
                <Button variant="secondary" fullWidth>
                  Export Results
                </Button>
                
                <Divider />
                
                <Button variant="secondary" tone="critical" fullWidth>
                  Rollback Campaign
                </Button>
                
                <Form method="post">
                  <input type="hidden" name="action" value="delete" />
                  <Button 
                    variant="secondary" 
                    tone="critical" 
                    fullWidth
                    submit
                  >
                    Delete Campaign
                  </Button>
                </Form>
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
      </BlockStack>
    </Page>
  );
}
