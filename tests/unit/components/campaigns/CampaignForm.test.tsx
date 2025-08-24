import { render, screen, fireEvent, waitFor } from '../../../utils/test-utils';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import { CampaignForm } from '../../../../app/components/campaigns/CampaignForm';
import type { CreateCampaignData } from '../../../../app/types/campaign';

// Mock the child components
vi.mock('../../../../app/components/campaigns/RuleBuilder', () => ({
  RuleBuilder: ({ rules, onChange, error }: any) => (
    <div data-testid="rule-builder">
      <div>Rules: {rules.length}</div>
      {error && <div data-testid="rules-error">{error}</div>}
      <button
        data-testid="add-rule"
        onClick={() => onChange([...rules, { 
          whenCondition: 'decreases_by_percent',
          whenOperator: 'gte',
          whenValue: '10',
          thenAction: 'reduce_price',
          thenMode: 'percentage',
          thenValue: '5',
          changeCompareAt: false
        }])}
      >
        Add Rule
      </button>
    </div>
  )
}));

vi.mock('../../../../app/components/campaigns/ProductTargeting', () => ({
  ProductTargeting: ({ targetProducts, onChange, error }: any) => (
    <div data-testid="product-targeting">
      <div>Target Products: {targetProducts.length}</div>
      {error && <div data-testid="targeting-error">{error}</div>}
      <button
        data-testid="add-target"
        onClick={() => onChange([...targetProducts, { type: 'all', value: [], conditions: {} }])}
      >
        Add Target
      </button>
    </div>
  )
}));

vi.mock('../../../../app/components/campaigns/CampaignPreview', () => ({
  CampaignPreview: ({ data, onEdit, onConfirm, onCancel }: any) => (
    <div data-testid="campaign-preview">
      <div>Preview: {data.name}</div>
      <button data-testid="edit-from-preview" onClick={onEdit}>Edit</button>
      <button data-testid="confirm-from-preview" onClick={() => onConfirm()}>Confirm</button>
      <button data-testid="cancel-from-preview" onClick={onCancel}>Cancel</button>
    </div>
  )
}));

const mockOnSubmit = vi.fn();
const mockOnCancel = vi.fn();

const defaultProps = {
  onSubmit: mockOnSubmit,
  onCancel: mockOnCancel,
  isSubmitting: false
};

describe('CampaignForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders campaign form with all required fields', () => {
    render(<CampaignForm {...defaultProps} />);
    
    expect(screen.getByLabelText(/campaign name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByTestId('rule-builder')).toBeInTheDocument();
    expect(screen.getByTestId('product-targeting')).toBeInTheDocument();
    expect(screen.getByText(/preview campaign/i)).toBeInTheDocument();
    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
  });

  test('displays validation errors for empty required fields', async () => {
    render(<CampaignForm {...defaultProps} />);
    
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/campaign name is required/i)).toBeInTheDocument();
    });
  });

  test('validates campaign name length', async () => {
    render(<CampaignForm {...defaultProps} />);
    
    const nameInput = screen.getByLabelText(/campaign name/i);
    fireEvent.change(nameInput, { target: { value: 'AB' } }); // Too short
    
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/campaign name must be at least 3 characters/i)).toBeInTheDocument();
    });
  });

  test('allows form submission with valid data', async () => {
    render(<CampaignForm {...defaultProps} />);
    
    // Fill in campaign name
    const nameInput = screen.getByLabelText(/campaign name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Campaign' } });
    
    // Add a rule
    const addRuleButton = screen.getByTestId('add-rule');
    fireEvent.click(addRuleButton);
    
    // Add target products
    const addTargetButton = screen.getByTestId('add-target');
    fireEvent.click(addTargetButton);
    
    // Preview campaign
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('campaign-preview')).toBeInTheDocument();
      expect(screen.getByText(/preview: test campaign/i)).toBeInTheDocument();
    });
    
    // Confirm from preview
    const confirmButton = screen.getByTestId('confirm-from-preview');
    fireEvent.click(confirmButton);
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        name: 'Test Campaign',
        description: '',
        rules: [{
          whenCondition: 'decreases_by_percent',
          whenOperator: 'gte',
          whenValue: '10',
          thenAction: 'reduce_price',
          thenMode: 'percentage',
          thenValue: '5',
          changeCompareAt: false
        }],
        targetProducts: [{ type: 'all', value: [], conditions: {} }],
        priority: 1,
        status: 'DRAFT'
      });
    });
  });

  test('can navigate back from preview to edit form', async () => {
    render(<CampaignForm {...defaultProps} />);
    
    // Fill minimum required data
    const nameInput = screen.getByLabelText(/campaign name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Campaign' } });
    
    const addRuleButton = screen.getByTestId('add-rule');
    fireEvent.click(addRuleButton);
    
    const addTargetButton = screen.getByTestId('add-target');
    fireEvent.click(addTargetButton);
    
    // Go to preview
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('campaign-preview')).toBeInTheDocument();
    });
    
    // Go back to edit
    const editButton = screen.getByTestId('edit-from-preview');
    fireEvent.click(editButton);
    
    await waitFor(() => {
      expect(screen.getByLabelText(/campaign name/i)).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Campaign')).toBeInTheDocument();
    });
  });

  test('displays loading state during submission', () => {
    render(<CampaignForm {...defaultProps} isSubmitting={true} />);
    
    const previewButton = screen.getByRole('button', { name: /preview campaign/i });
    expect(previewButton).toHaveAttribute('aria-disabled', 'true');
    
    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    expect(cancelButton).toHaveAttribute('aria-disabled', 'true');
  });

  test('handles submission errors gracefully', async () => {
    const errorMessage = 'Campaign creation failed';
    mockOnSubmit.mockRejectedValue(new Error(errorMessage));
    
    render(<CampaignForm {...defaultProps} />);
    
    // Fill minimum required data
    const nameInput = screen.getByLabelText(/campaign name/i);
    fireEvent.change(nameInput, { target: { value: 'Test Campaign' } });
    
    const addRuleButton = screen.getByTestId('add-rule');
    fireEvent.click(addRuleButton);
    
    const addTargetButton = screen.getByTestId('add-target');
    fireEvent.click(addTargetButton);
    
    // Go to preview and confirm
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('campaign-preview')).toBeInTheDocument();
    });
    
    const confirmButton = screen.getByTestId('confirm-from-preview');
    fireEvent.click(confirmButton);
    
    // Should go back to form and show error
    await waitFor(() => {
      expect(screen.getByLabelText(/campaign name/i)).toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('populates form with initial data when provided', () => {
    const initialData: Partial<CreateCampaignData> = {
      name: 'Existing Campaign',
      description: 'Test description',
      rules: [{
        whenCondition: 'below_threshold',
        whenOperator: 'lt',
        whenValue: '5',
        thenAction: 'increase_price',
        thenMode: 'fixed',
        thenValue: '10',
        changeCompareAt: true
      }],
      targetProducts: [{ type: 'product', value: ['123'], conditions: {} }],
      priority: 5
    };
    
    render(<CampaignForm {...defaultProps} initialData={initialData} />);
    
    expect(screen.getByDisplayValue('Existing Campaign')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test description')).toBeInTheDocument();
    expect(screen.getByText('Rules: 1')).toBeInTheDocument();
    expect(screen.getByText('Target Products: 1')).toBeInTheDocument();
  });

  test('calls onCancel when cancel button is clicked', () => {
    render(<CampaignForm {...defaultProps} />);
    
    const cancelButton = screen.getByText(/cancel/i);
    fireEvent.click(cancelButton);
    
    expect(mockOnCancel).toHaveBeenCalled();
  });

  test('clears field errors when user starts typing', async () => {
    render(<CampaignForm {...defaultProps} />);
    
    // Trigger validation error first
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    await waitFor(() => {
      expect(screen.getByText(/campaign name is required/i)).toBeInTheDocument();
    });
    
    // Start typing in name field
    const nameInput = screen.getByLabelText(/campaign name/i);
    fireEvent.change(nameInput, { target: { value: 'T' } });
    
    await waitFor(() => {
      expect(screen.queryByText(/campaign name is required/i)).not.toBeInTheDocument();
    });
  });

  test('prevents preview with invalid form data', async () => {
    render(<CampaignForm {...defaultProps} />);
    
    // Try to preview with no data
    const previewButton = screen.getByText(/preview campaign/i);
    fireEvent.click(previewButton);
    
    // Should not show preview, should stay on form
    await waitFor(() => {
      expect(screen.queryByTestId('campaign-preview')).not.toBeInTheDocument();
      expect(screen.getByLabelText(/campaign name/i)).toBeInTheDocument();
    });
  });
});
