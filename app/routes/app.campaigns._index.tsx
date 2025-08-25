import React from 'react';
import { json } from '@remix-run/node';
import type { LoaderFunctionArgs, ActionFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData, useNavigate, useSubmit, useNavigation, useRevalidator } from '@remix-run/react';
import { Page, Card, Text } from '@shopify/polaris';
import { TitleBar } from '@shopify/app-bridge-react';
import { CampaignDashboard } from '../components/campaigns/CampaignDashboard';
import { AuthErrorHandler, useAuthErrorHandler } from '../components/AuthErrorHandler';
import { CampaignService, type CampaignWithRules } from '../lib/services/CampaignService';
import { authenticate } from "../shopify.server";
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
    console.log('🔄 Campaign loader starting - checking authentication');
    
    // Standard authentication with App Bridge 3.0
    const { admin, session } = await authenticate.admin(request);
    console.log('✅ Authentication successful for shop:', session.shop);
    
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
    
    console.log('📋 Loaded campaigns successfully:', transformedCampaigns.length);
    
    return json({
      campaigns: transformedCampaigns,
      pagination: result.pagination,
      meta: result.meta,
      shopDomain: session.shop
    });
  } catch (error) {
    console.error('❌ Failed to load campaigns:', error);
    
    // Check if this is an authentication error
    if (error instanceof Response) {
      console.log('🚫 Authentication failed, redirecting to login');
      throw error; // Let Shopify handle the redirect
    }
    
    return json({
      campaigns: [],
      shopDomain: '',
      error: 'Failed to load campaigns. Please refresh the page.'
    }, { status: 500 });
  }
}

// Handle campaign status updates and deletions
export async function action({ request }: ActionFunctionArgs) {
  console.log('🎯 Campaign action initiated');
  try {
    // Standard authentication with App Bridge 3.0
    const { admin, session } = await authenticate.admin(request);
    console.log('✅ Campaign action authentication successful for shop:', session.shop);

    const formData = await request.formData();
    const action = formData.get('_action');
    const campaignId = formData.get('campaignId');
    
    console.log('📝 Action details:', { action, campaignId });

    if (!campaignId) {
      console.log('❌ Missing campaign ID');
      return json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const campaignService = new CampaignService(session.shop);

    switch (action) {
      case 'toggleStatus': {
        const newStatus = formData.get('status');
        if (!newStatus) {
          console.log('❌ Missing status for toggle');
          return json({ error: 'Status is required' }, { status: 400 });
        }

        console.log(`🔄 Updating campaign ${campaignId} to ${newStatus}`);
        await campaignService.updateCampaignStatus(campaignId as string, newStatus as any);
        console.log(`✅ Campaign ${campaignId} status updated to ${newStatus}`);
        
        return json({ 
          success: true, 
          message: `Campaign ${String(newStatus).toLowerCase()} successfully` 
        });
      }

      case 'delete': {
        console.log(`🗑️ Deleting campaign ${campaignId}`);
        await campaignService.updateCampaignStatus(campaignId as string, 'ARCHIVED');
        console.log(`✅ Campaign ${campaignId} successfully archived/deleted`);
        
        return json({ 
          success: true, 
          message: 'Campaign deleted successfully' 
        });
      }

      default:
        console.log('❌ Invalid action:', action);
        return json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ Action error:', error);
    // Check if it's an authentication error
    if (error instanceof Response && error.status === 302) {
      console.error('🔄 Authentication redirect detected in action');
      return json({ 
        error: 'Session expired. Please refresh the page.',
        needsRefresh: true
      }, { status: 401 });
    }
    return json({ 
      error: 'Operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}export default function CampaignsIndex() {
  const data = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const { handleAuthError } = useAuthErrorHandler();

  const isSubmitting = navigation.state === 'submitting';

  // Handle authentication errors
  React.useEffect(() => {
    if ('error' in data && data.error) {
      console.error('📋 Campaigns loader error:', data.error);
      
      // Check if it's an authentication-related error
      if (data.error.includes('session') || data.error.includes('auth')) {
        handleAuthError({ status: 401, message: data.error });
      }
    }
  }, [data, handleAuthError]);

  // Type guard to check if data has error
  if ('error' in data) {
    return (
      <AuthErrorHandler>
        <Page>
          <TitleBar title="Campaign Dashboard" />
          <Card>
            <div style={{ padding: '20px', textAlign: 'center' }}>
              <Text as="p" tone="critical">
                {data.error || 'Failed to load campaigns.'}
              </Text>
              <div style={{ marginTop: '16px' }}>
                <button 
                  onClick={() => revalidator.revalidate()}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#008060',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Refresh Data
                </button>
              </div>
            </div>
          </Card>
        </Page>
      </AuthErrorHandler>
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
    
    submit(
      {
        _action: 'toggleStatus',
        campaignId,
        status: newStatus
      },
      { method: 'POST' }
    );
  };

  const handleDeleteCampaign = (campaignId: string) => {
    console.log('🗑️ Delete campaign:', campaignId);
    
    if (!confirm('Are you sure you want to delete this campaign? This action cannot be undone.')) {
      return;
    }
    
    submit(
      {
        _action: 'delete',
        campaignId
      },
      { method: 'POST' }
    );
  };

  const handleViewDetails = (id: string) => {
    console.log('👁️ View campaign details:', id);
    navigate(`/app/campaigns/${id}`);
  };

  const handleRefresh = () => {
    console.log('🔄 Refresh campaigns using Remix revalidator');
    revalidator.revalidate();
  };

  return (
    <AuthErrorHandler>
      <Page>
        <TitleBar title="Campaign Dashboard" />
        
        <CampaignDashboard 
          campaigns={campaigns}
          isLoading={isSubmitting}
          onCreateCampaign={handleCreateCampaign}
          onEditCampaign={handleEditCampaign}
          onToggleCampaignStatus={handleToggleCampaignStatus}
          onDeleteCampaign={handleDeleteCampaign}
          onViewCampaignDetails={handleViewDetails}
          onRefresh={handleRefresh}
        />
      </Page>
    </AuthErrorHandler>
  );
}
