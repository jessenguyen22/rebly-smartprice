# Frontend Architecture

The frontend architecture defines React component organization, state management patterns, and routing structure for the enhanced multi-page Shopify app experience.

### Component Architecture

#### Component Organization

```
app/
├── routes/                          # Remix file-based routing
│   ├── app._index.tsx              # Dashboard (landing page)
│   ├── app.pricing-job.tsx         # Enhanced manual pricing interface
│   ├── app.campaigns._index.tsx    # Campaign list view
│   ├── app.campaigns.create.tsx    # Campaign creation wizard
│   ├── app.campaigns.$id.tsx       # Campaign details and monitoring
│   └── app.campaigns.$id.edit.tsx  # Campaign editing interface
├── components/                      # Shared UI components
│   ├── ui/                         # Basic UI building blocks
│   │   ├── Card.tsx               # Enhanced Polaris card wrapper
│   │   ├── DataTable.tsx          # Reusable data display
│   │   └── StatusBadge.tsx        # Campaign/job status indicators
│   ├── campaigns/                  # Campaign-specific components
│   │   ├── CampaignForm.tsx       # Campaign creation/edit form
│   │   ├── CampaignDashboard.tsx  # Real-time campaign monitoring
│   │   ├── RuleBuilder.tsx        # Pricing rule configuration
│   │   └── CampaignHistory.tsx    # Campaign audit trail display
│   ├── pricing-job/               # Manual pricing components
│   │   ├── VariantSelector.tsx    # Enhanced variant selection
│   │   ├── RuleConfiguration.tsx  # Pricing rule setup
│   │   ├── ResultsTable.tsx       # Job execution results
│   │   └── JobHistory.tsx         # Previous job tracking
│   └── shared/                    # Cross-feature components
│       ├── Navigation.tsx         # App navigation structure
│       ├── AuditTrailViewer.tsx  # Audit log display
│       └── ExportButton.tsx      # CSV/PDF export functionality
```

#### Component Template

```typescript
import { Card, BlockStack, Text, Button } from '@shopify/polaris';
import type { Campaign } from '~/types/campaign';

interface CampaignDashboardProps {
  campaign: Campaign;
  onStatusChange: (status: Campaign['status']) => void;
  isLoading?: boolean;
}

export default function CampaignDashboard({
  campaign,
  onStatusChange,
  isLoading = false
}: CampaignDashboardProps) {
  return (
    <Card>
      <BlockStack gap="400">
        <Text variant="headingMd">{campaign.name}</Text>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="primary"
            onClick={() => onStatusChange('active')}
            loading={isLoading}
            disabled={campaign.status === 'active'}
          >
            Activate
          </Button>
          
          <Button
            onClick={() => onStatusChange('paused')}
            loading={isLoading}
            disabled={campaign.status === 'paused'}
          >
            Pause
          </Button>
        </div>
        
        <Text tone="subdued">
          Triggered {campaign.triggerCount} times
          {campaign.lastTriggered && 
            ` • Last: ${new Date(campaign.lastTriggered).toLocaleString()}`}
        </Text>
      </BlockStack>
    </Card>
  );
}
```

### State Management Architecture

#### State Structure

```typescript
// Global app state (minimal - mostly server state via Remix)
interface AppState {
  user: ShopifyUser | null;
  shop: ShopifyShop | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
}

// Component-level state patterns
interface CampaignFormState {
  name: string;
  description: string;
  rules: PricingRule[];
  selectedProducts: string[];
  startDate?: Date;
  endDate?: Date;
  isSubmitting: boolean;
  errors: Record<string, string>;
}

// Real-time state for dashboard
interface DashboardState {
  campaigns: Campaign[];
  recentJobs: PricingJob[];
  systemHealth: SystemStatus;
  liveUpdates: boolean;
}
```

#### State Management Patterns

- **Server State via Remix Loaders**: Campaign data, job history, audit trails loaded server-side
- **Form State with React Hook Form**: Complex form state management for campaign creation
- **Real-time Updates via EventSource**: Live dashboard updates for campaign monitoring
- **Optimistic Updates**: Immediate UI feedback for campaign status changes
- **Error Boundaries**: Graceful error handling with fallback UI components

### Routing Architecture

#### Route Organization

```
/app                                 # Root layout with navigation
├── /                               # Dashboard - campaign overview + recent jobs
├── /pricing-job                    # Enhanced manual pricing interface
├── /campaigns                      # Campaign management section
│   ├── /                          # Campaign list with filters
│   ├── /create                    # Campaign creation wizard
│   ├── /:id                       # Campaign details and monitoring
│   ├── /:id/edit                  # Campaign editing
│   └── /:id/history               # Campaign audit trail
└── /settings                      # App configuration (future)
```

#### Protected Route Pattern

```typescript
// app/routes/app.tsx - Root layout with authentication
import { authenticate } from '../shopify.server';
import { Outlet } from '@remix-run/react';
import { Navigation } from '~/components/shared/Navigation';

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  return json({
    shop: session.shop,
    user: session.user,
  });
}

export default function AppLayout() {
  return (
    <div className="app-layout">
      <Navigation />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
```

### Frontend Services Layer

#### API Client Setup

```typescript
// app/lib/api-client.ts
import { useFetcher } from '@remix-run/react';

export interface ApiClient {
  campaigns: {
    list: (filters?: CampaignFilters) => Promise<Campaign[]>;
    create: (data: CreateCampaignData) => Promise<Campaign>;
    update: (id: string, data: UpdateCampaignData) => Promise<Campaign>;
    rollback: (id: string) => Promise<RollbackResult>;
  };
  pricingJobs: {
    create: (data: CreateJobData) => Promise<PricingJob>;
    getResults: (id: string) => Promise<ProcessingResult[]>;
  };
  auditTrail: {
    query: (filters: AuditFilters) => Promise<AuditTrailEntry[]>;
  };
}

export function useApiClient(): ApiClient {
  const fetcher = useFetcher();
  
  return {
    campaigns: {
      create: async (data) => {
        fetcher.submit(data, {
          method: 'POST',
          action: '/api/campaigns',
          encType: 'application/json',
        });
        return fetcher.data;
      },
      // ... other methods
    },
    // ... other services
  };
}
```

#### Service Example

```typescript
// app/services/campaign-service.ts
import type { Campaign, CreateCampaignData } from '~/types/campaign';

export class CampaignService {
  constructor(private apiClient: ApiClient) {}

  async createCampaign(data: CreateCampaignData): Promise<Campaign> {
    // Validate rules before submission
    const validatedRules = this.validatePricingRules(data.rules);
    
    // Optimistic update for immediate UI feedback
    const optimisticCampaign = {
      ...data,
      id: 'temp-' + Date.now(),
      status: 'draft' as const,
      triggerCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    try {
      const campaign = await this.apiClient.campaigns.create({
        ...data,
        rules: validatedRules,
      });
      
      return campaign;
    } catch (error) {
      // Revert optimistic update on error
      throw new Error(`Failed to create campaign: ${error.message}`);
    }
  }

  private validatePricingRules(rules: PricingRule[]): PricingRule[] {
    return rules.map(rule => {
      if (!rule.whenValue || !rule.thenValue) {
        throw new Error('Rule values cannot be empty');
      }
      
      if (parseFloat(rule.thenValue) < 0) {
        throw new Error('Price adjustments cannot be negative');
      }
      
      return rule;
    });
  }
}
```
