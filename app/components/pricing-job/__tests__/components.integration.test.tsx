/**
 * Integration Tests for Enhanced UI Components
 * 
 * Tests TemplateSelector, EnhancedResultsTable, and CampaignIntegrationHint components
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateSelector } from '../TemplateSelector';
import { EnhancedResultsTable } from '../EnhancedResultsTable';
import { CampaignIntegrationHint } from '../CampaignIntegrationHint';
import type { PricingJobTemplate } from '../../models/pricing-job-template.server';

// Mock Polaris components for testing
vi.mock('@shopify/polaris', () => ({
  Select: ({ options, value, onChange, label }: any) => (
    <div>
      <label>{label}</label>
      <select 
        data-testid="template-select" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  ),
  Button: ({ children, onClick, loading, disabled }: any) => (
    <button 
      data-testid="button" 
      onClick={onClick} 
      disabled={loading || disabled}
    >
      {loading ? 'Loading...' : children}
    </button>
  ),
  Card: ({ children }: any) => <div data-testid="card">{children}</div>,
  BlockStack: ({ children }: any) => <div data-testid="block-stack">{children}</div>,
  InlineStack: ({ children }: any) => <div data-testid="inline-stack">{children}</div>,
  Text: ({ children, variant }: any) => <span data-variant={variant}>{children}</span>,
  TextField: ({ value, onChange, label, placeholder }: any) => (
    <div>
      <label>{label}</label>
      <input
        data-testid="text-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  ),
  IndexTable: ({ children, headings }: any) => (
    <table data-testid="index-table">
      <thead>
        <tr>
          {headings.map((heading: any, i: number) => (
            <th key={i}>{heading.title || heading}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  ),
  IndexTable: {
    Row: ({ children }: any) => <tr data-testid="table-row">{children}</tr>,
    Cell: ({ children }: any) => <td data-testid="table-cell">{children}</td>,
  },
  Badge: ({ children, tone }: any) => (
    <span data-testid="badge" data-tone={tone}>{children}</span>
  ),
  ProgressBar: ({ progress }: any) => (
    <div data-testid="progress-bar" data-progress={progress}>
      Progress: {progress}%
    </div>
  ),
  Tooltip: ({ content, children }: any) => (
    <div data-testid="tooltip" title={content}>
      {children}
    </div>
  ),
  Banner: ({ children, tone }: any) => (
    <div data-testid="banner" data-tone={tone}>
      {children}
    </div>
  ),
  Collapsible: ({ open, children }: any) => (
    <div data-testid="collapsible" data-open={open} style={{ display: open ? 'block' : 'none' }}>
      {children}
    </div>
  ),
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('TemplateSelector Component', () => {
  const mockTemplates: PricingJobTemplate[] = [
    {
      id: 'template-1',
      name: 'Budget Template',
      description: 'For low-price items',
      rules: [
        {
          whenCondition: 'less_than',
          whenValue: '20',
          thenAction: 'increase',
          thenMode: 'fixed',
          thenValue: '5',
          changeCompareAt: false,
        },
      ],
      bulkAmount: '10',
      bulkType: 'increase',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
      userId: 'user-1',
      shopifyShopId: 'shop-1',
    },
    {
      id: 'template-2',
      name: 'Premium Template',
      description: 'For high-value items',
      rules: [
        {
          whenCondition: 'greater_than',
          whenValue: '100',
          thenAction: 'decrease',
          thenMode: 'percentage',
          thenValue: '10',
          changeCompareAt: true,
        },
      ],
      bulkAmount: null,
      bulkType: null,
      createdAt: new Date('2024-01-02'),
      updatedAt: new Date('2024-01-02'),
      userId: 'user-1',
      shopifyShopId: 'shop-1',
    },
  ];

  const defaultProps = {
    templates: mockTemplates,
    selectedTemplateId: '',
    onTemplateSelect: vi.fn(),
    onTemplateSave: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders template options correctly', () => {
    render(<TemplateSelector {...defaultProps} />);

    expect(screen.getByTestId('template-select')).toBeInTheDocument();
    expect(screen.getByText('Budget Template')).toBeInTheDocument();
    expect(screen.getByText('Premium Template')).toBeInTheDocument();
  });

  it('calls onTemplateSelect when template is chosen', async () => {
    const user = userEvent.setup();
    render(<TemplateSelector {...defaultProps} />);

    const select = screen.getByTestId('template-select');
    await user.selectOptions(select, 'template-1');

    expect(defaultProps.onTemplateSelect).toHaveBeenCalledWith('template-1');
  });

  it('shows template details when template is selected', () => {
    render(<TemplateSelector {...defaultProps} selectedTemplateId="template-1" />);

    expect(screen.getByText('For low-price items')).toBeInTheDocument();
    expect(screen.getByText(/1 pricing rule/)).toBeInTheDocument();
  });

  it('allows saving current rules as template', async () => {
    const user = userEvent.setup();
    const mockSaveHandler = vi.fn();
    
    render(
      <TemplateSelector 
        {...defaultProps} 
        onTemplateSave={mockSaveHandler}
        currentRules={mockTemplates[0].rules}
      />
    );

    // Fill template name
    const nameField = screen.getByTestId('text-field');
    await user.type(nameField, 'New Template');

    // Click save button
    const saveButton = screen.getByText('Save as Template');
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockSaveHandler).toHaveBeenCalledWith({
        name: 'New Template',
        description: '',
        rules: mockTemplates[0].rules,
      });
    });
  });

  it('handles loading state correctly', () => {
    render(<TemplateSelector {...defaultProps} isLoading={true} />);

    const loadingButton = screen.getByText('Loading...');
    expect(loadingButton).toBeInTheDocument();
    expect(loadingButton).toBeDisabled();
  });
});

describe('EnhancedResultsTable Component', () => {
  const mockResults = [
    {
      variantId: 'variant-1',
      success: true,
      oldPrice: '15.00',
      newPrice: '20.00',
      productTitle: 'Test Product 1',
      variantTitle: 'Small / Blue',
      inventory: 50,
    },
    {
      variantId: 'variant-2',
      success: false,
      error: 'Price too low',
      productTitle: 'Test Product 2',
      variantTitle: 'Large / Red',
      inventory: 25,
    },
    {
      variantId: 'variant-3',
      success: true,
      oldPrice: '30.00',
      newPrice: '25.00',
      productTitle: 'Test Product 3',
      variantTitle: 'Medium / Green',
      inventory: 100,
      reason: 'Applied discount rule',
    },
  ];

  const defaultProps = {
    results: mockResults,
    isLoading: false,
    jobName: 'Test Job',
    onExport: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['test data'], { type: 'text/csv' })),
    });
  });

  it('renders results table with correct data', () => {
    render(<EnhancedResultsTable {...defaultProps} />);

    expect(screen.getByTestId('index-table')).toBeInTheDocument();
    expect(screen.getByText('Test Product 1')).toBeInTheDocument();
    expect(screen.getByText('Test Product 2')).toBeInTheDocument();
    expect(screen.getByText('Test Product 3')).toBeInTheDocument();
  });

  it('displays success and error indicators correctly', () => {
    render(<EnhancedResultsTable {...defaultProps} />);

    const badges = screen.getAllByTestId('badge');
    expect(badges.some(badge => badge.textContent === 'Success')).toBe(true);
    expect(badges.some(badge => badge.textContent === 'Error')).toBe(true);
  });

  it('shows pricing changes for successful updates', () => {
    render(<EnhancedResultsTable {...defaultProps} />);

    expect(screen.getByText('$15.00 → $20.00')).toBeInTheDocument();
    expect(screen.getByText('$30.00 → $25.00')).toBeInTheDocument();
  });

  it('displays error messages for failed updates', () => {
    render(<EnhancedResultsTable {...defaultProps} />);

    expect(screen.getByText('Price too low')).toBeInTheDocument();
  });

  it('handles CSV export correctly', async () => {
    const user = userEvent.setup();
    const mockExportHandler = vi.fn();
    
    render(<EnhancedResultsTable {...defaultProps} onExport={mockExportHandler} />);

    const exportButton = screen.getByText('Export CSV');
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockExportHandler).toHaveBeenCalledWith('csv');
    });
  });

  it('shows summary statistics', () => {
    render(<EnhancedResultsTable {...defaultProps} />);

    // Should show total processed, success count, etc.
    expect(screen.getByText(/3 variants/)).toBeInTheDocument();
    expect(screen.getByText(/2 successful/)).toBeInTheDocument();
    expect(screen.getByText(/1 failed/)).toBeInTheDocument();
  });

  it('handles empty results gracefully', () => {
    render(<EnhancedResultsTable {...defaultProps} results={[]} />);

    expect(screen.getByText(/No results to display/)).toBeInTheDocument();
  });
});

describe('CampaignIntegrationHint Component', () => {
  const mockJobResult = {
    success: true,
    totalProcessed: 10,
    successCount: 8,
    failureCount: 2,
    results: [],
    actionType: 'manual_pricing' as const,
  };

  const defaultProps = {
    jobResult: mockJobResult,
    pricingRules: [
      {
        whenCondition: 'less_than' as const,
        whenValue: '20',
        thenAction: 'increase' as const,
        thenMode: 'fixed' as const,
        thenValue: '5',
        changeCompareAt: false,
      },
    ],
    onNotifySignup: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  it('renders campaign conversion hint for successful jobs', () => {
    render(<CampaignIntegrationHint {...defaultProps} />);

    expect(screen.getByText(/Convert to Auto Campaign/)).toBeInTheDocument();
    expect(screen.getByText(/Coming Soon/)).toBeInTheDocument();
  });

  it('does not render for failed jobs', () => {
    const failedProps = {
      ...defaultProps,
      jobResult: { ...mockJobResult, success: false, successCount: 0 },
    };

    const { container } = render(<CampaignIntegrationHint {...failedProps} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows campaign automation preview', () => {
    render(<CampaignIntegrationHint {...defaultProps} />);

    expect(screen.getByText(/Automated Price Monitoring/)).toBeInTheDocument();
    expect(screen.getByText(/Real-time Webhooks/)).toBeInTheDocument();
  });

  it('handles email signup for notifications', async () => {
    const user = userEvent.setup();
    const mockSignupHandler = vi.fn();
    
    render(<CampaignIntegrationHint {...defaultProps} onNotifySignup={mockSignupHandler} />);

    // Open email signup
    const getNotifiedButton = screen.getByText('Get Notified');
    await user.click(getNotifiedButton);

    // Fill email
    const emailField = screen.getByPlaceholderText(/your-email@example.com/);
    await user.type(emailField, 'test@example.com');

    // Submit
    const signupButton = screen.getByText('Sign Up');
    await user.click(signupButton);

    await waitFor(() => {
      expect(mockSignupHandler).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('displays proper tooltips with explanations', () => {
    render(<CampaignIntegrationHint {...defaultProps} />);

    const tooltip = screen.getByTestId('tooltip');
    expect(tooltip).toHaveAttribute('title', expect.stringContaining('automation features'));
  });

  it('shows campaign rule translation preview', () => {
    render(<CampaignIntegrationHint {...defaultProps} />);

    // Should show how the manual rule would translate to automation
    expect(screen.getByText(/When price is less than \$20/)).toBeInTheDocument();
    expect(screen.getByText(/→ Increase by \$5/)).toBeInTheDocument();
  });

  it('displays performance metrics for campaign preview', () => {
    render(<CampaignIntegrationHint {...defaultProps} />);

    expect(screen.getByText(/8 variants would be monitored/)).toBeInTheDocument();
    expect(screen.getByText(/80% success rate/)).toBeInTheDocument();
  });
});
