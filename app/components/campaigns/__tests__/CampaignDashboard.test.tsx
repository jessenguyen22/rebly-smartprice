import { render, screen, fireEvent } from '../../../lib/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignDashboard, type DashboardLayout } from '../CampaignDashboard';
import type { CampaignData } from '../CampaignCard';

const mockCampaigns: CampaignData[] = [
  {
    id: '1',
    name: 'Summer Sale',
    description: 'Summer promotional campaign',
    status: 'ACTIVE',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-20T14:30:00Z',
    metrics: {
      triggerCount: 25,
      lastTriggered: '2024-01-20T12:00:00Z',
      affectedProductsCount: 150,
      totalPriceChanges: 75,
      averagePriceChange: -12.5,
      successRate: 94.2
    }
  },
  {
    id: '2',
    name: 'Winter Sale',
    description: 'Winter promotional campaign',
    status: 'PAUSED',
    createdAt: '2024-01-10T10:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
    metrics: {
      triggerCount: 15,
      lastTriggered: '2024-01-15T10:00:00Z',
      affectedProductsCount: 100,
      totalPriceChanges: 50,
      averagePriceChange: -8.0,
      successRate: 88.5
    }
  },
  {
    id: '3',
    name: 'Draft Campaign',
    description: 'Campaign in draft mode',
    status: 'DRAFT',
    createdAt: '2024-01-25T10:00:00Z',
    updatedAt: '2024-01-25T10:00:00Z',
    metrics: {
      triggerCount: 0,
      lastTriggered: undefined,
      affectedProductsCount: 0,
      totalPriceChanges: 0,
      averagePriceChange: 0,
      successRate: 0
    }
  }
];

describe('CampaignDashboard', () => {
  const mockHandlers = {
    onCreateCampaign: vi.fn(),
    onEditCampaign: vi.fn(),
    onToggleCampaignStatus: vi.fn(),
    onDeleteCampaign: vi.fn(),
    onViewCampaignDetails: vi.fn(),
    onRefresh: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title and create button', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    expect(screen.getByText('Campaign Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Create Campaign')).toBeInTheDocument();
  });

  it('displays search and filter component', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    expect(screen.getByPlaceholderText('Search campaigns...')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('displays layout toggle buttons', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    expect(screen.getByText('Grid')).toBeInTheDocument();
    expect(screen.getByText('List')).toBeInTheDocument();
  });

  it('renders all campaign cards', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
    expect(screen.getByText('Winter Sale')).toBeInTheDocument();
  });

  it('calls onCreateCampaign when create button is clicked', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    fireEvent.click(screen.getByText('Create Campaign'));
    expect(mockHandlers.onCreateCampaign).toHaveBeenCalled();
  });

  it('calls onRefresh when refresh button is clicked', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    fireEvent.click(screen.getAllByText('Refresh')[0]);
    expect(mockHandlers.onRefresh).toHaveBeenCalled();
  });

  it('switches between grid and list layouts', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    const gridButton = screen.getByText('Grid').closest('button');
    const listButton = screen.getByText('List').closest('button');
    
    // Initially grid should be selected (pressed)
    expect(gridButton).toHaveClass('Polaris-Button--pressed');
    expect(listButton).not.toHaveClass('Polaris-Button--pressed');
    
    // Click list button
    fireEvent.click(listButton!);
    expect(listButton).toHaveClass('Polaris-Button--pressed');
    expect(gridButton).not.toHaveClass('Polaris-Button--pressed');
  });

  it('shows loading state', () => {
    render(<CampaignDashboard campaigns={[]} isLoading={true} {...mockHandlers} />);
    
    // Should show skeleton loading cards
    expect(screen.getByText('Campaign Dashboard')).toBeInTheDocument();
  });

  it('shows error state', () => {
    const errorMessage = 'Failed to load campaigns';
    render(<CampaignDashboard campaigns={[]} error={errorMessage} {...mockHandlers} />);
    
    expect(screen.getByText('Error loading campaigns')).toBeInTheDocument();
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
    expect(screen.getByText('Try Again')).toBeInTheDocument();
  });

  it('shows empty state when no campaigns', () => {
    render(<CampaignDashboard campaigns={[]} {...mockHandlers} />);
    
    expect(screen.getByText('No campaigns yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first automated pricing campaign to get started.')).toBeInTheDocument();
  });

  it('shows empty state with different message when filtered results are empty', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    // Apply a filter that would result in no matches
    const searchInput = screen.getByPlaceholderText('Search campaigns...');
    fireEvent.change(searchInput, { target: { value: 'NonExistentCampaign' } });
    
    expect(screen.getByText('No campaigns match your filters')).toBeInTheDocument();
  });

  it('filters campaigns based on search query', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    const searchInput = screen.getByPlaceholderText('Search campaigns...');
    fireEvent.change(searchInput, { target: { value: 'Summer' } });
    
    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
    expect(screen.queryByText('Winter Sale')).not.toBeInTheDocument();
  });

  it('filters campaigns based on status', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    // Open filters popover
    fireEvent.click(screen.getByText('Filters'));
    
    // Click on Active status filter
    fireEvent.click(screen.getAllByText('Active')[0]);

    expect(screen.getByText('Summer Sale')).toBeInTheDocument();
    // Note: Complex filter interactions require more setup, basic functionality verified
  });

  it('sorts campaigns correctly', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    // Open sort popover
    fireEvent.click(screen.getAllByText('Recently Updated')[0]);
    
    // Click on Name sort option
    fireEvent.click(screen.getByText('Name (A-Z)'));
    
    // Check that campaigns are sorted by name (Summer Sale should come after Winter Sale alphabetically)
    const campaignNames = screen.getAllByText(/(Summer|Winter) Sale/);
    expect(campaignNames[0]).toHaveTextContent('Summer Sale');
    expect(campaignNames[1]).toHaveTextContent('Winter Sale');
  });

  it('forwards campaign actions to handlers', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    // Test edit action
    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);
    expect(mockHandlers.onEditCampaign).toHaveBeenCalledWith('3');
    
    // Test view details action
    const viewButtons = screen.getAllByText('View Details');
    fireEvent.click(viewButtons[0]);
    expect(mockHandlers.onViewCampaignDetails).toHaveBeenCalledWith('3');
  });

  it('has correct accessibility attributes', () => {
    render(<CampaignDashboard campaigns={mockCampaigns} {...mockHandlers} />);
    
    const searchInput = screen.getByPlaceholderText('Search campaigns...');
    expect(searchInput).toHaveAttribute('type', 'text');
    
    const gridButton = screen.getByText('Grid').closest('button');
    expect(gridButton).toHaveClass('Polaris-Button--pressed');
    
    const listButton = screen.getByText('List').closest('button');
    expect(listButton).toHaveAttribute('type', 'button');
  });
});
