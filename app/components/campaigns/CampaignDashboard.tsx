import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Page,
  Layout,
  InlineStack,
  BlockStack,
  Button,
  EmptyState,
  Spinner,
  SkeletonDisplayText,
  SkeletonBodyText,
  Card,
  ButtonGroup,
  Text
} from '@shopify/polaris';
import { PlusIcon, ViewIcon } from '@shopify/polaris-icons';
import { CampaignCard, type CampaignData } from './CampaignCard';
import { SearchAndFilter, type CampaignFilters } from './SearchAndFilter';
import type { CampaignStatus } from './StatusIndicator';

export type DashboardLayout = 'grid' | 'list';

interface CampaignDashboardProps {
  campaigns?: CampaignData[];
  isLoading?: boolean;
  error?: string;
  onCreateCampaign?: () => void;
  onEditCampaign?: (campaignId: string) => void;
  onToggleCampaignStatus?: (campaignId: string, newStatus: CampaignStatus) => void;
  onDeleteCampaign?: (campaignId: string) => void;
  onViewCampaignDetails?: (campaignId: string) => void;
  onRefresh?: () => void;
}

// Mock data for development
const mockCampaigns: CampaignData[] = [
  {
    id: '1',
    name: 'Winter Sale Campaign',
    description: 'Automatic price adjustments for winter inventory',
    status: 'ACTIVE',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    metrics: {
      triggerCount: 45,
      lastTriggered: '2024-01-20T14:30:00Z',
      affectedProductsCount: 150,
      totalPriceChanges: 234,
      averagePriceChange: -12.50,
      successRate: 98.5
    }
  },
  {
    id: '2',
    name: 'Spring Collection Pricing',
    description: 'Dynamic pricing for new spring arrivals',
    status: 'DRAFT',
    createdAt: '2024-01-18T09:00:00Z',
    updatedAt: '2024-01-18T16:45:00Z',
    metrics: {
      triggerCount: 0,
      lastTriggered: undefined,
      affectedProductsCount: 75,
      totalPriceChanges: 0,
      averagePriceChange: 0,
      successRate: 0
    }
  },
  {
    id: '3',
    name: 'Clearance Automation',
    description: 'Aggressive price reductions for clearance items',
    status: 'PAUSED',
    createdAt: '2024-01-10T11:00:00Z',
    updatedAt: '2024-01-19T08:20:00Z',
    metrics: {
      triggerCount: 23,
      lastTriggered: '2024-01-19T08:20:00Z',
      affectedProductsCount: 89,
      totalPriceChanges: 167,
      averagePriceChange: -25.75,
      successRate: 94.2
    }
  },
  {
    id: '4',
    name: 'Holiday Promotions',
    description: 'Completed holiday season campaign',
    status: 'COMPLETED',
    createdAt: '2023-11-01T10:00:00Z',
    updatedAt: '2024-01-02T23:59:59Z',
    metrics: {
      triggerCount: 156,
      lastTriggered: '2024-01-02T18:45:00Z',
      affectedProductsCount: 320,
      totalPriceChanges: 892,
      averagePriceChange: -18.25,
      successRate: 96.8
    }
  }
];

function CampaignSkeleton() {
  return (
    <Card>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <BlockStack gap="200">
            <SkeletonDisplayText size="medium" />
            <SkeletonBodyText lines={2} />
          </BlockStack>
          <div style={{ width: '80px', height: '24px', backgroundColor: '#f0f0f0', borderRadius: '4px' }} />
        </InlineStack>
        <div style={{ height: '1px', backgroundColor: '#e1e1e1' }} />
        <SkeletonBodyText lines={3} />
        <div style={{ height: '1px', backgroundColor: '#e1e1e1' }} />
        <InlineStack align="space-between">
          <div style={{ width: '100px', height: '32px', backgroundColor: '#f0f0f0', borderRadius: '4px' }} />
          <div style={{ width: '120px', height: '32px', backgroundColor: '#f0f0f0', borderRadius: '4px' }} />
        </InlineStack>
      </BlockStack>
    </Card>
  );
}

export function CampaignDashboard({
  campaigns = mockCampaigns,
  isLoading = false,
  error,
  onCreateCampaign,
  onEditCampaign,
  onToggleCampaignStatus,
  onDeleteCampaign,
  onViewCampaignDetails,
  onRefresh
}: CampaignDashboardProps) {
  const [layout, setLayout] = useState<DashboardLayout>('grid');
  const [filters, setFilters] = useState<CampaignFilters>({
    searchQuery: '',
    status: [],
    dateRange: null,
    sortBy: 'updatedAt',
    sortOrder: 'desc'
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Real-time updates - fetch campaigns every 30 seconds
  useEffect(() => {
    const fetchCampaigns = async () => {
      if (onRefresh) {
        setIsRefreshing(true);
        try {
          await onRefresh();
          setLastUpdated(new Date());
        } catch (error) {
          console.error('Error refreshing campaigns:', error);
        } finally {
          setIsRefreshing(false);
        }
      }
    };

    const interval = setInterval(fetchCampaigns, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [onRefresh]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    if (onRefresh && !isRefreshing) {
      setIsRefreshing(true);
      try {
        await onRefresh();
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Error refreshing campaigns:', error);
      } finally {
        setIsRefreshing(false);
      }
    }
  }, [onRefresh, isRefreshing]);

  // Filter and sort campaigns based on current filters
  const filteredCampaigns = useMemo(() => {
    let filtered = campaigns;

    // Apply search filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(campaign => 
        campaign.name.toLowerCase().includes(query) ||
        campaign.description.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (filters.status.length > 0) {
      filtered = filtered.filter(campaign => 
        filters.status.includes(campaign.status)
      );
    }

    // Apply sorting
    filtered = [...filtered].sort((a, b) => {
      let aValue: any, bValue: any;

      switch (filters.sortBy) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'createdAt':
          aValue = new Date(a.createdAt);
          bValue = new Date(b.createdAt);
          break;
        case 'updatedAt':
          aValue = new Date(a.updatedAt);
          bValue = new Date(b.updatedAt);
          break;
        case 'triggerCount':
          aValue = a.metrics.triggerCount;
          bValue = b.metrics.triggerCount;
          break;
        default:
          aValue = a.updatedAt;
          bValue = b.updatedAt;
      }

      if (filters.sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [campaigns, filters]);

  const handleLayoutChange = useCallback((newLayout: DashboardLayout) => {
    setLayout(newLayout);
  }, []);

  if (error) {
    return (
      <Page
        title="Campaigns"
        primaryAction={{ content: 'Create Campaign', onAction: onCreateCampaign }}
      >
        <Layout>
          <Layout.Section>
            <EmptyState
              heading="Error loading campaigns"
              image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            >
              <Text variant="bodyMd" as="p">
                {error}
              </Text>
              <div style={{ marginTop: '16px' }}>
                <Button onClick={onRefresh}>
                  Try Again
                </Button>
              </div>
            </EmptyState>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page
      title="Campaign Dashboard"
      primaryAction={{
        content: 'Create Campaign',
        onAction: onCreateCampaign,
        icon: PlusIcon
      }}
      secondaryActions={[
        {
          content: isRefreshing ? 'Refreshing...' : 'Refresh',
          onAction: handleManualRefresh,
          loading: isRefreshing
        }
      ]}
    >
      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {/* Search and Filter Controls */}
            <SearchAndFilter
              filters={filters}
              onFiltersChange={setFilters}
              totalCount={campaigns.length}
              filteredCount={filteredCampaigns.length}
            />

            {/* Layout Toggle */}
            <InlineStack align="end">
              <ButtonGroup>
                <Button
                  pressed={layout === 'grid'}
                  onClick={() => handleLayoutChange('grid')}
                >
                  Grid View
                </Button>
                <Button
                  pressed={layout === 'list'}
                  onClick={() => handleLayoutChange('list')}
                >
                  List View
                </Button>
              </ButtonGroup>
            </InlineStack>

            {/* Campaign Grid/List */}
            {isLoading ? (
              <div 
                className="campaign-skeleton-grid"
                style={{ 
                  display: 'grid', 
                  gap: '16px',
                  gridTemplateColumns: layout === 'grid' ? 'repeat(auto-fill, minmax(400px, 1fr))' : '1fr'
                }}
              >
                {[1, 2, 3, 4].map(i => (
                  <CampaignSkeleton key={i} />
                ))}
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <EmptyState
                heading={filters.searchQuery || filters.status.length > 0 ? "No campaigns match your filters" : "No campaigns yet"}
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
              >
                <Text variant="bodyMd" as="p">
                  {filters.searchQuery || filters.status.length > 0
                    ? "Try adjusting your search or filters to see more campaigns."
                    : "Create your first automated pricing campaign to get started."
                  }
                </Text>
                <div style={{ marginTop: '16px' }}>
                  {filters.searchQuery || filters.status.length > 0 ? (
                    <Button onClick={() => setFilters({
                      searchQuery: '',
                      status: [],
                      dateRange: null,
                      sortBy: 'updatedAt',
                      sortOrder: 'desc'
                    })}>
                      Clear Filters
                    </Button>
                  ) : (
                    <Button variant="primary" onClick={onCreateCampaign}>
                      Create Campaign
                    </Button>
                  )}
                </div>
              </EmptyState>
            ) : (
              <div 
                className={layout === 'grid' ? 'campaign-grid' : 'campaign-list'}
                style={{ 
                  display: 'grid', 
                  gap: '16px',
                  gridTemplateColumns: layout === 'grid' ? 'repeat(auto-fill, minmax(400px, 1fr))' : '1fr'
                }}
              >
                {filteredCampaigns.map(campaign => (
                  <CampaignCard
                    key={campaign.id}
                    campaign={campaign}
                    onEdit={onEditCampaign}
                    onToggleStatus={onToggleCampaignStatus}
                    onDelete={onDeleteCampaign}
                    onViewDetails={onViewCampaignDetails}
                  />
                ))}
              </div>
            )}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
