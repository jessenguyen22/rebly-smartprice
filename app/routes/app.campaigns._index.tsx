import { json } from '@remix-run/node';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData, useNavigate } from '@remix-run/react';
import { Page, Card, Text } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import { authenticate } from '../shopify.server';
import { CampaignDashboard } from '../components/campaigns/CampaignDashboard';
import { CampaignService, type CampaignWithRules } from '../lib/services/CampaignService';
import { initializeCampaignProcessing } from '../services/campaign-session-integration.server';
import { prisma } from '../db.server';
import type { CampaignData } from '../components/campaigns/CampaignCard';

// Helper function to transform campaign data for UI
function transformCampaignForUI(campaign: CampaignWithRules): CampaignData {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description || '',
    status: campaign.status as CampaignData['status'],
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
    metrics: {
      triggerCount: campaign.triggerCount,
      lastTriggered: campaign.lastTriggered?.toISOString(),
      affectedProductsCount: 0, // Would need to calculate from targetProducts
      totalPriceChanges: campaign.triggerCount, // Using triggerCount as proxy
      averagePriceChange: 0, // Would need historical data
      successRate: 100 // Would need to calculate from logs
    }
  };
}
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

export const meta: MetaFunction = () => {
  return [
    { title: "Campaigns - SmartPrice" },
    { name: "description", content: "Manage your automated pricing campaigns and monitor performance." },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { admin, session } = await initializeCampaignProcessing.initializeCampaignProcessingFromLoader({
      request,
      params: {},
      context: {}
    });
    
    // Ensure shop exists in database
    await ensureShopExists(session.shop, session.accessToken);
    
    const campaignService = new CampaignService(session.shop);
    const result = await campaignService.getCampaigns({
      page: 1,
      limit: 20,
      sortBy: 'createdAt',
      sortOrder: 'desc'
    });
    
    // Transform campaigns for UI
    const transformedCampaigns = result.campaigns.map(transformCampaignForUI);
    
    console.log('📋 Loaded campaigns:', transformedCampaigns.length);
    
    return json({
      campaigns: transformedCampaigns,
      pagination: result.pagination,
      meta: result.meta,
      shopDomain: session.shop
    });
  } catch (error) {
    console.error('Failed to load campaigns:', error);
    return json({
      campaigns: [],
      shopDomain: '',
      error: 'Failed to load campaigns'
    });
  }
}export default function CampaignsIndex() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();

  // Type guard to check if data has error
  if ('error' in data) {
    return (
      <Page>
        <TitleBar title="Campaign Dashboard" />
        <Card>
          <Text as="p">
            {data.error || 'Failed to load campaigns.'}
          </Text>
        </Card>
      </Page>
    );
  }

  const { campaigns } = data;

  const handleCreateCampaign = () => {
    console.log('🎯 Create campaign clicked');
    navigate('/app/campaigns/create');
  };

  const handleEditCampaign = (id: string) => {
    console.log('✏️ Edit campaign:', id);
    navigate(`/app/campaigns/${id}/edit`);
  };

  const handleToggleCampaignStatus = (campaignId: string, newStatus: any) => {
    console.log('🔄 Toggle campaign status:', campaignId, 'to', newStatus);
    // Implementation for status toggle
  };

  const handleDeleteCampaign = (campaignId: string) => {
    console.log('🗑️ Delete campaign:', campaignId);
    // Implementation for campaign deletion
  };

  const handleViewDetails = (id: string) => {
    console.log('👁️ View campaign details:', id);
    navigate(`/app/campaigns/${id}`);
  };

  const handleRefresh = () => {
    console.log('🔄 Refresh campaigns');
    // Implementation for refresh
  };

  return (
    <Page>
      <TitleBar title="Campaign Dashboard" />
      
      <CampaignDashboard 
        campaigns={campaigns}
        onCreateCampaign={handleCreateCampaign}
        onEditCampaign={handleEditCampaign}
        onToggleCampaignStatus={handleToggleCampaignStatus}
        onDeleteCampaign={handleDeleteCampaign}
        onViewCampaignDetails={handleViewDetails}
        onRefresh={handleRefresh}
      />
    </Page>
  );
}
