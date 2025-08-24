import { render, screen, fireEvent } from '../../../lib/test-utils';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CampaignCard, type CampaignData } from '../CampaignCard';

const mockCampaign: CampaignData = {
  id: '1',
  name: 'Test Campaign',
  description: 'A test campaign for validation',
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
};

describe('CampaignCard', () => {
  const mockHandlers = {
    onEdit: vi.fn(),
    onToggleStatus: vi.fn(),
    onDelete: vi.fn(),
    onViewDetails: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders campaign information correctly', () => {
    render(<CampaignCard campaign={mockCampaign} {...mockHandlers} />);
    
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    expect(screen.getByText('A test campaign for validation')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('displays all metrics correctly', () => {
    render(<CampaignCard campaign={mockCampaign} {...mockHandlers} />);
    
    expect(screen.getByText('25')).toBeInTheDocument(); // triggerCount
    expect(screen.getByText('150')).toBeInTheDocument(); // affectedProductsCount
    expect(screen.getByText('75')).toBeInTheDocument(); // totalPriceChanges
    expect(screen.getByText('-$12.50')).toBeInTheDocument(); // averagePriceChange
    expect(screen.getByText('94.2%')).toBeInTheDocument(); // successRate
  });

  it('formats dates correctly', () => {
    render(<CampaignCard campaign={mockCampaign} {...mockHandlers} />);
    
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument(); // createdAt
    expect(screen.getByText(/Jan 20, 2024/)).toBeInTheDocument(); // updatedAt
  });

  it('shows edit button for DRAFT campaigns', () => {
    const draftCampaign = { ...mockCampaign, status: 'DRAFT' as const };
    render(<CampaignCard campaign={draftCampaign} {...mockHandlers} />);
    
    fireEvent.click(screen.getByText('Edit'));
    expect(mockHandlers.onEdit).toHaveBeenCalledWith('1');
  });

  it('calls onViewDetails when View Details button is clicked', () => {
    render(<CampaignCard campaign={mockCampaign} {...mockHandlers} />);
    
    fireEvent.click(screen.getByText('View Details'));
    expect(mockHandlers.onViewDetails).toHaveBeenCalledWith('1');
  });

  it('shows appropriate status toggle button for ACTIVE campaign', () => {
    render(<CampaignCard campaign={mockCampaign} {...mockHandlers} />);
    
    expect(screen.getByText('Pause')).toBeInTheDocument();
  });

  it('shows appropriate status toggle button for PAUSED campaign', () => {
    const pausedCampaign = { ...mockCampaign, status: 'PAUSED' as const };
    render(<CampaignCard campaign={pausedCampaign} {...mockHandlers} />);
    
    expect(screen.getByText('Activate')).toBeInTheDocument();
  });

  it('calls onToggleStatus when status toggle button is clicked', () => {
    render(<CampaignCard campaign={mockCampaign} {...mockHandlers} />);
    
    fireEvent.click(screen.getByText('Pause'));
    expect(mockHandlers.onToggleStatus).toHaveBeenCalledWith('1', 'PAUSED');
  });

  it('handles campaign without metrics gracefully', () => {
    const campaignNoMetrics = {
      ...mockCampaign,
      metrics: {
        triggerCount: 0,
        lastTriggered: undefined,
        affectedProductsCount: 0,
        totalPriceChanges: 0,
        averagePriceChange: 0,
        successRate: 0
      }
    };
    
    expect(() => render(<CampaignCard campaign={campaignNoMetrics} {...mockHandlers} />)).not.toThrow();
    expect(screen.getByText('$0.00')).toBeInTheDocument(); // averagePriceChange
    expect(screen.getByText('0%')).toBeInTheDocument(); // successRate
  });

  it('handles COMPLETED status correctly', () => {
    const completedCampaign = { ...mockCampaign, status: 'COMPLETED' as const };
    render(<CampaignCard campaign={completedCampaign} {...mockHandlers} />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    // COMPLETED campaigns shouldn't have status toggle buttons
    expect(screen.queryByText('Pause')).not.toBeInTheDocument();
    expect(screen.queryByText('Resume')).not.toBeInTheDocument();
  });
});
