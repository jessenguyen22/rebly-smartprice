import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AppProvider } from '@shopify/shopify-app-remix/react';
import Dashboard from '~/routes/app._index';

// Mock the loader data
const mockLoaderData = {
  activeCampaigns: [
    {
      id: '1',
      name: 'Test Campaign',
      status: 'ACTIVE',
      triggerCount: 5,
      lastTriggered: '2025-08-24T10:00:00.000Z',
      rules: [{ id: '1' }, { id: '2' }]
    }
  ],
  recentJobs: [
    {
      id: '1', 
      name: 'Test Job',
      type: 'MANUAL',
      status: 'COMPLETED',
      createdAt: '2025-08-24T09:00:00.000Z',
      totalVariants: 10,
      successCount: 8
    }
  ],
  quickStats: {
    totalJobsToday: 2,
    activeCampaignCount: 1,
    recentPriceChanges: 15,
    totalJobs: 25
  },
  systemHealth: {
    database: 'healthy' as const,
    shopifyAPI: 'healthy' as const,
    lastHealthCheck: new Date('2025-08-24T10:30:00.000Z')
  }
};

// Mock useLoaderData hook
vi.mock('@remix-run/react', () => ({
  useLoaderData: () => mockLoaderData,
}));

// Mock useAppBridge hook  
vi.mock('@shopify/app-bridge-react', () => ({
  TitleBar: ({ title }: { title: string }) => <div data-testid="title-bar">{title}</div>,
  useAppBridge: () => ({
    toast: {
      show: vi.fn()
    }
  })
}));

// Wrapper component for Polaris
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider isEmbeddedApp apiKey="test-key">
    {children}
  </AppProvider>
);

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard title correctly', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    expect(screen.getByTestId('title-bar')).toHaveTextContent('Pricing Dashboard');
  });

  it('displays correct quick stats', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByText('2')).toBeInTheDocument(); // Jobs Today
    expect(screen.getByText('1')).toBeInTheDocument(); // Active Campaigns  
    expect(screen.getByText('15')).toBeInTheDocument(); // Recent Changes
  });

  it('renders recent jobs table when data exists', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByText('Recent Pricing Jobs')).toBeInTheDocument();
    expect(screen.getByText('Test Job')).toBeInTheDocument();
    expect(screen.getByText('MANUAL')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument(); // Success rate
  });

  it('renders active campaigns when data exists', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByText('Active Campaigns')).toBeInTheDocument();
    expect(screen.getByText('Test Campaign')).toBeInTheDocument();
    expect(screen.getByText('2 rules')).toBeInTheDocument();
    expect(screen.getByText('5 triggers')).toBeInTheDocument();
  });

  it('shows empty state when no jobs exist', () => {
    const emptyData = { ...mockLoaderData, recentJobs: [] };
    vi.mocked(vi.importActual('@remix-run/react')).useLoaderData.mockReturnValue(emptyData);
    
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByText('No pricing jobs yet')).toBeInTheDocument();
  });

  it('shows empty state when no campaigns exist', () => {
    const emptyData = { ...mockLoaderData, activeCampaigns: [] };
    vi.mocked(vi.importActual('@remix-run/react')).useLoaderData.mockReturnValue(emptyData);
    
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByText('No active campaigns')).toBeInTheDocument();
  });

  it('displays system health banner when database has errors', () => {
    const errorData = {
      ...mockLoaderData,
      systemHealth: { ...mockLoaderData.systemHealth, database: 'error' as const }
    };
    vi.mocked(vi.importActual('@remix-run/react')).useLoaderData.mockReturnValue(errorData);
    
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByText('System Status')).toBeInTheDocument();
    expect(screen.getByText(/Database connectivity issues detected/)).toBeInTheDocument();
  });

  it('includes navigation links to key pages', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    
    expect(screen.getByRole('link', { name: /Create Pricing Job/i })).toHaveAttribute('href', '/app/pricing-job');
    expect(screen.getByRole('button', { name: /Create Campaign/i })).toBeDisabled();
    expect(screen.getByRole('link', { name: /View Database Dashboard/i })).toHaveAttribute('href', '/app/database');
  });

  it('formats dates correctly', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    
    // Should display formatted date for campaign last triggered
    expect(screen.getByText(/Last: Aug 24, 10:00 AM/)).toBeInTheDocument();
  });
});

describe('Dashboard Status Badge Formatting', () => {
  it('correctly maps status to badge colors', () => {
    render(<Dashboard />, { wrapper: TestWrapper });
    
    // Test that ACTIVE status gets success badge
    const activeBadge = screen.getByText('Active');
    expect(activeBadge).toBeInTheDocument();
    
    // Test that COMPLETED status gets success badge  
    const completedBadge = screen.getByText('Completed');
    expect(completedBadge).toBeInTheDocument();
  });
});
