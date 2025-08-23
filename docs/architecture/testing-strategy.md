# Testing Strategy

The comprehensive testing approach covers frontend components, backend services, and end-to-end user workflows with emphasis on campaign automation reliability and webhook processing accuracy.

### Testing Pyramid

```
           E2E Tests (10%)
          /              \
     Integration Tests (30%)
    /                      \
Frontend Unit (30%)  Backend Unit (30%)
```

### Test Organization

#### Frontend Tests

```
tests/
├── unit/
│   ├── components/
│   │   ├── campaigns/
│   │   │   ├── CampaignForm.test.tsx
│   │   │   ├── CampaignDashboard.test.tsx
│   │   │   └── RuleBuilder.test.tsx
│   │   ├── pricing-job/
│   │   │   ├── VariantSelector.test.tsx
│   │   │   └── ResultsTable.test.tsx
│   │   └── shared/
│   │       ├── Navigation.test.tsx
│   │       └── AuditTrailViewer.test.tsx
│   └── hooks/
│       ├── useApiClient.test.ts
│       └── useCampaignStatus.test.ts
├── integration/
│   ├── routes/
│   │   ├── app.campaigns.test.tsx
│   │   └── app.pricing-job.test.tsx
│   └── services/
│       ├── campaign-service.test.ts
│       └── api-client.test.ts
```

#### Backend Tests

```
tests/
├── unit/
│   ├── services/
│   │   ├── campaign-service.test.ts
│   │   ├── pricing-service.test.ts
│   │   ├── webhook-service.test.ts
│   │   └── audit-logger.test.ts
│   ├── models/
│   │   ├── campaign.test.ts
│   │   └── pricing-job.test.ts
│   └── utils/
│       ├── pricing-calculations.test.ts
│       └── webhook-validation.test.ts
├── integration/
│   ├── api/
│   │   ├── campaigns.test.ts
│   │   ├── pricing-jobs.test.ts
│   │   └── webhooks.test.ts
│   └── database/
│       ├── campaign-repository.test.ts
│       └── audit-repository.test.ts
```

#### E2E Tests

```
tests/e2e/
├── campaign-lifecycle.spec.ts
├── manual-pricing-job.spec.ts
├── webhook-processing.spec.ts
├── audit-trail-tracking.spec.ts
└── rollback-functionality.spec.ts
```

### Test Examples

#### Frontend Component Test

```typescript
// tests/unit/components/campaigns/CampaignForm.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import CampaignForm from '~/components/campaigns/CampaignForm';

const mockOnSubmit = vi.fn();
const mockApiClient = {
  campaigns: {
    create: vi.fn().mockResolvedValue({ id: '123', name: 'Test Campaign' })
  }
};

vi.mock('~/lib/api-client', () => ({
  useApiClient: () => mockApiClient
}));

describe('CampaignForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('submits valid campaign data', async () => {
    render(<CampaignForm onSubmit={mockOnSubmit} />);
    
    // Fill in campaign name
    const nameInput = screen.getByLabelText(/campaign name/i);
    fireEvent.change(nameInput, { target: { value: 'Black Friday Sale' } });
    
    // Add pricing rule
    const addRuleButton = screen.getByText(/add rule/i);
    fireEvent.click(addRuleButton);
    
    const conditionSelect = screen.getByLabelText(/when inventory/i);
    fireEvent.change(conditionSelect, { target: { value: 'decreases_by_percent' } });
    
    const valueInput = screen.getByLabelText(/threshold value/i);
    fireEvent.change(valueInput, { target: { value: '20' } });
    
    // Submit form
    const submitButton = screen.getByText(/create campaign/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(mockApiClient.campaigns.create).toHaveBeenCalledWith({
        name: 'Black Friday Sale',
        rules: [{
          whenCondition: 'decreases_by_percent',
          whenValue: '20',
          thenAction: 'reduce_price',
          thenMode: 'percentage',
          thenValue: '10',
          changeCompareAt: false
        }],
        targetProducts: []
      });
    });
    
    expect(mockOnSubmit).toHaveBeenCalled();
  });

  test('displays validation errors for invalid data', async () => {
    render(<CampaignForm onSubmit={mockOnSubmit} />);
    
    // Submit without required fields
    const submitButton = screen.getByText(/create campaign/i);
    fireEvent.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/campaign name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/at least one rule is required/i)).toBeInTheDocument();
    });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});
```

#### Backend API Test

```typescript
// tests/integration/api/campaigns.test.ts
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createRemixStub } from '@remix-run/testing';
import { loader, action } from '~/routes/api/campaigns';
import { setupTestDatabase, cleanupTestDatabase } from '../setup/database';
import { createTestSession } from '../setup/auth';

describe('Campaigns API', () => {
  beforeEach(async () => {
    await setupTestDatabase();
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  test('GET /api/campaigns returns user campaigns', async () => {
    const session = await createTestSession();
    
    const app = createRemixStub([
      {
        path: '/api/campaigns',
        Component: () => null,
        loader
      }
    ]);

    const response = await request(app)
      .get('/api/campaigns')
      .set('Authorization', `Bearer ${session.token}`)
      .expect(200);

    expect(response.body).toHaveProperty('campaigns');
    expect(Array.isArray(response.body.campaigns)).toBe(true);
  });

  test('POST /api/campaigns creates new campaign', async () => {
    const session = await createTestSession();
    const campaignData = {
      name: 'Test Campaign',
      description: 'Test campaign description',
      rules: [{
        whenCondition: 'decreases_by_percent',
        whenValue: '20',
        thenAction: 'reduce_price',
        thenMode: 'percentage',
        thenValue: '10',
        changeCompareAt: false
      }],
      targetProducts: ['gid://shopify/Product/123']
    };

    const app = createRemixStub([
      {
        path: '/api/campaigns',
        Component: () => null,
        action
      }
    ]);

    const response = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${session.token}`)
      .send(campaignData)
      .expect(201);

    expect(response.body.campaign).toMatchObject({
      name: 'Test Campaign',
      status: 'draft',
      rules: expect.arrayContaining([
        expect.objectContaining({
          whenCondition: 'decreases_by_percent'
        })
      ])
    });
  });

  test('POST /api/campaigns validates pricing rules', async () => {
    const session = await createTestSession();
    const invalidCampaignData = {
      name: 'Invalid Campaign',
      rules: [{
        whenCondition: 'decreases_by_percent',
        whenValue: '-10', // Invalid negative value
        thenAction: 'reduce_price',
        thenMode: 'percentage',
        thenValue: '150', // Invalid > 100% reduction
        changeCompareAt: false
      }],
      targetProducts: []
    };

    const app = createRemixStub([
      {
        path: '/api/campaigns',
        Component: () => null,
        action
      }
    ]);

    const response = await request(app)
      .post('/api/campaigns')
      .set('Authorization', `Bearer ${session.token}`)
      .send(invalidCampaignData)
      .expect(400);

    expect(response.body.error).toContain('Rule values must be positive');
  });
});
```

#### E2E Test

```typescript
// tests/e2e/campaign-lifecycle.spec.ts
import { test, expect } from '@playwright/test';
import { setupShopifyTestStore, cleanupShopifyTestStore } from './setup/shopify';

test.describe('Campaign Lifecycle', () => {
  test.beforeEach(async () => {
    await setupShopifyTestStore();
  });

  test.afterEach(async () => {
    await cleanupShopifyTestStore();
  });

  test('complete campaign creation and activation workflow', async ({ page }) => {
    // Navigate to app
    await page.goto('/app');
    
    // Verify dashboard loads
    await expect(page.locator('h1')).toContainText('Pricing Dashboard');
    
    // Create new campaign
    await page.click('text=Create Campaign');
    await expect(page).toHaveURL('/app/campaigns/create');
    
    // Fill campaign form
    await page.fill('[data-testid="campaign-name"]', 'E2E Test Campaign');
    await page.fill('[data-testid="campaign-description"]', 'End-to-end test campaign');
    
    // Add pricing rule
    await page.click('[data-testid="add-rule-button"]');
    await page.selectOption('[data-testid="when-condition"]', 'decreases_by_percent');
    await page.fill('[data-testid="when-value"]', '25');
    await page.selectOption('[data-testid="then-action"]', 'reduce_price');
    await page.fill('[data-testid="then-value"]', '15');
    
    // Select target products (mock Shopify resource picker)
    await page.click('[data-testid="select-products-button"]');
    // Mock product selection would happen here
    await page.click('[data-testid="confirm-product-selection"]');
    
    // Create campaign
    await page.click('[data-testid="create-campaign-button"]');
    
    // Verify campaign created and redirected to details
    await expect(page).toHaveURL(/\/app\/campaigns\/[a-f0-9-]+$/);
    await expect(page.locator('[data-testid="campaign-status"]')).toContainText('Draft');
    
    // Activate campaign
    await page.click('[data-testid="activate-campaign-button"]');
    
    // Confirm activation dialog
    await page.click('[data-testid="confirm-activation"]');
    
    // Verify campaign activated
    await expect(page.locator('[data-testid="campaign-status"]')).toContainText('Active');
    await expect(page.locator('[data-testid="webhook-status"]')).toContainText('Listening');
    
    // Test campaign monitoring
    await expect(page.locator('[data-testid="trigger-count"]')).toContainText('0');
    
    // Simulate webhook trigger (would require test webhook endpoint)
    // This would test the real-time dashboard updates
  });

  test('campaign rollback functionality', async ({ page }) => {
    // Setup: Create and activate campaign with test price changes
    // ... campaign setup code ...
    
    // Navigate to campaign with historical changes
    await page.goto('/app/campaigns/test-campaign-id');
    
    // Initiate rollback
    await page.click('[data-testid="rollback-button"]');
    
    // Confirm rollback dialog
    await expect(page.locator('[data-testid="rollback-confirmation"]')).toContainText('This will restore all affected products');
    await page.click('[data-testid="confirm-rollback"]');
    
    // Verify rollback job started
    await expect(page.locator('[data-testid="rollback-status"]')).toContainText('Processing rollback');
    
    // Wait for rollback completion (with timeout)
    await page.waitForSelector('[data-testid="rollback-complete"]', { timeout: 60000 });
    
    // Verify audit trail shows rollback entries
    await page.click('[data-testid="view-audit-trail"]');
    await expect(page.locator('[data-testid="audit-entry"]').first()).toContainText('rollback');
  });
});
```
