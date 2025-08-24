import { json, type LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Page } from '@shopify/polaris';
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { CampaignDashboard } from '../components/campaigns/CampaignDashboard';
import type { CampaignData } from '../components/campaigns/CampaignCard';

// Mock data cho demo
const mockCampaigns: CampaignData[] = [
  {
    id: '1',
    name: 'Summer Sale Campaign',
    description: 'Automatic pricing for summer products based on inventory levels',
    status: 'ACTIVE',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    metrics: {
      triggerCount: 45,
      lastTriggered: '2024-01-20T14:30:00Z',
      affectedProductsCount: 125,
      totalPriceChanges: 340,
      averagePriceChange: -12.50,
      successRate: 92
    }
  },
  {
    id: '2',
    name: 'Inventory Clearance',
    description: 'Clear out old inventory with progressive discounts',
    status: 'PAUSED',
    createdAt: '2024-01-10T09:00:00Z',
    updatedAt: '2024-01-18T16:45:00Z',
    metrics: {
      triggerCount: 23,
      lastTriggered: '2024-01-18T16:45:00Z',
      affectedProductsCount: 67,
      totalPriceChanges: 89,
      averagePriceChange: -25.75,
      successRate: 88
    }
  },
  {
    id: '3',
    name: 'New Product Launch',
    description: 'Dynamic pricing strategy for new product launches',
    status: 'DRAFT',
    createdAt: '2024-01-22T11:15:00Z',
    updatedAt: '2024-01-22T11:15:00Z',
    metrics: {
      triggerCount: 0,
      affectedProductsCount: 15,
      totalPriceChanges: 0,
      averagePriceChange: 0,
      successRate: 0
    }
  },
  {
    id: '4',
    name: 'Black Friday Campaign',
    description: 'Completed campaign from last Black Friday',
    status: 'COMPLETED',
    createdAt: '2023-11-01T08:00:00Z',
    updatedAt: '2023-11-30T23:59:00Z',
    metrics: {
      triggerCount: 234,
      lastTriggered: '2023-11-30T20:15:00Z',
      affectedProductsCount: 450,
      totalPriceChanges: 1250,
      averagePriceChange: -18.25,
      successRate: 96
    }
  }
];

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);
  
  return json({
    campaigns: mockCampaigns
  });
}

export default function CampaignsDemoPage() {
  const { campaigns } = useLoaderData<typeof loader>();

  const handleCreateCampaign = () => {
    console.log('🎯 Create campaign clicked');
    alert('Create Campaign button clicked! (Check console for details)');
  };

  const handleEditCampaign = (campaignId: string) => {
    console.log('✏️ Edit campaign:', campaignId);
    alert(`Edit Campaign ${campaignId} clicked!`);
  };

  const handleToggleCampaignStatus = (campaignId: string, newStatus: string) => {
    console.log('🔄 Toggle campaign status:', campaignId, 'to', newStatus);
    alert(`Toggle Campaign ${campaignId} status to: ${newStatus}`);
  };

  const handleDeleteCampaign = (campaignId: string) => {
    console.log('🗑️ Delete campaign:', campaignId);
    alert(`Delete Campaign ${campaignId} clicked!`);
  };

  const handleViewCampaignDetails = (campaignId: string) => {
    console.log('👁️ View campaign details:', campaignId);
    alert(`View Details for Campaign ${campaignId}`);
  };

  const handleRefresh = () => {
    console.log('🔄 Refresh campaigns');
    alert('Refresh clicked! Campaigns refreshed.');
  };

  return (
    <Page>
      <TitleBar title="Campaign Dashboard Demo" />
      
      <CampaignDashboard
        campaigns={campaigns}
        onCreateCampaign={handleCreateCampaign}
        onEditCampaign={handleEditCampaign}
        onToggleCampaignStatus={handleToggleCampaignStatus}
        onDeleteCampaign={handleDeleteCampaign}
        onViewCampaignDetails={handleViewCampaignDetails}
        onRefresh={handleRefresh}
      />
    </Page>
  );
}
