# Technical Constraints and Integration Requirements

### Existing Technology Stack
**Languages**: TypeScript, JavaScript
**Frameworks**: Remix 2.16.1, React 18.2.0, Shopify App Remix 3.7.0
**Database**: PostgreSQL (migrating from SQLite)
**Infrastructure**: Shopify App Bridge, Polaris v12 design system
**External Dependencies**: Shopify Admin GraphQL API, Prisma ORM 6.2.1

### Integration Approach
**Database Integration Strategy**: Migrate from SQLite to PostgreSQL with comprehensive campaign and audit tables while preserving session functionality
**API Integration Strategy**: Extend existing Shopify GraphQL patterns with webhook processing and batch update capabilities
**Frontend Integration Strategy**: Multi-page navigation using existing Polaris components with dashboard-first experience
**Testing Integration Strategy**: Staging environment with webhook simulation and campaign dry-run capabilities

### Code Organization and Standards

**File Structure Approach**: 
- Migrate from single `app.admin.tsx` to modular page structure: `app/routes/app.dashboard.tsx`, `app/routes/app.pricing-job.tsx`, `app/routes/app.campaigns.tsx`
- Maintain Remix file-based routing convention: `app/routes/app.[feature].tsx`
- Extract shared business logic to `app/lib/` directory: `app/lib/pricing-engine.ts`, `app/lib/campaign-processor.ts`
- Database models in `app/models/` following Prisma patterns

**Naming Conventions**:
- **Interfaces**: PascalCase with descriptive names (`SelectedVariant`, `PricingRule`, `CampaignStatus`)
- **Functions**: camelCase with descriptive action verbs (`processInventoryRules`, `calculateNewPrice`, `shouldApplyRule`)
- **Constants**: UPPER_SNAKE_CASE for configuration (`BATCH_SIZE = 5`, `API_RETRY_LIMIT = 3`)
- **GraphQL**: Embedded template literals with `#graphql` comment for syntax highlighting
- **Component Props**: TypeScript interfaces suffixed with `Props` (`DashboardProps`, `CampaignFormProps`)

**TypeScript Patterns**:
```typescript
// Existing pattern: Strict interfaces with union types
interface PricingRule {
  whenCondition: 'decreases_by_percent' | 'increases_by_percent' | 'decreases_by_abs' | 'increases_by_abs' | 'less_than_abs' | 'more_than_abs';
  whenValue: string;
  thenAction: 'reduce_price' | 'increase_price' | 'change_price';
  thenMode: 'percentage' | 'absolute';
  thenValue: string;
  changeCompareAt: boolean;
}

// Existing pattern: Detailed result objects with optional properties
interface ProcessingResult {
  variantId: string;
  success: boolean;
  oldPrice?: string;
  newPrice?: string;
  productTitle?: string;
  variantTitle?: string;
  inventory?: number;
  error?: string;
  reason?: string;
}
```

**React/Remix Patterns**:
- **Loaders**: Export named `loader` functions with proper authentication: `await authenticate.admin(request)`
- **Actions**: Export named `action` functions handling form submissions and API mutations
- **Components**: Functional components using hooks (`useState`, `useEffect`, `useFetcher`)
- **State Management**: Local useState for form state, useFetcher for server interactions
- **Event Handlers**: Arrow functions with descriptive names (`handleRuleChange`, `handleVariantSelection`)

**GraphQL Conventions**:
```typescript
// Existing pattern: Embedded GraphQL with template literals
const variantResponse = await admin.graphql(
  `#graphql
    query getVariantWithInventory($id: ID!) {
      productVariant(id: $id) {
        id
        price
        title
        inventoryQuantity
        inventoryPolicy
        product { id title }
        inventoryItem {
          id
          tracked
        }
      }
    }`,
  { variables: { id: variantId } }
);
```

**Error Handling Patterns**:
- **Try-catch blocks** around all GraphQL operations with detailed error messaging
- **Graceful degradation**: Continue processing other variants when individual variants fail
- **User-friendly error messages**: Transform technical errors into merchant-understandable language
- **Result arrays**: Collect both successes and failures for comprehensive reporting

**Polaris UI Patterns**:
- **Component imports**: Multi-line imports from `@shopify/polaris` for readability
- **Layout structure**: `Page > Layout > Card > BlockStack` hierarchy
- **Form elements**: `TextField`, `Select`, `Checkbox` with proper labeling and validation
- **Data display**: `IndexTable` for results with `Badge` components for status indication
- **Actions**: `Button` components with loading states and proper variants

**Business Logic Organization**:
- **Helper functions**: Pure functions for calculations (`calculateNewPrice`, `shouldApplyRule`)
- **Batch processing**: Process variants in batches of 5 to respect API limits
- **Rule evaluation**: Separate evaluation logic from execution logic
- **Backward compatibility**: Default rule objects to maintain existing functionality

**Testing Standards** (to be implemented):
- **Unit tests**: Jest for pure functions and business logic
- **Integration tests**: Test GraphQL operations with mocked Shopify Admin API
- **Component tests**: React Testing Library for UI components
- **End-to-end tests**: Playwright for complete user workflows

### Deployment and Operations
**Build Process Integration**: Extend existing Remix/Vite build process with PostgreSQL migration scripts
**Deployment Strategy**: Zero-downtime migration with rollback capabilities for each story delivery
**Monitoring and Logging**: Real-time webhook processing monitoring with merchant-facing status indicators
**Configuration Management**: Environment-aware configuration for development, staging, and production webhook endpoints

### Risk Assessment and Mitigation
**Technical Risks**: Database migration complexity, webhook reliability, API rate limit management
**Integration Risks**: Maintaining existing functionality during architectural changes, PostgreSQL migration challenges
**Deployment Risks**: Zero-downtime migration requirements, rollback complexity for campaign system
**Mitigation Strategies**: 
- Comprehensive staging environment with webhook simulation
- Incremental story delivery with independent rollback capabilities
- Dead letter queue for webhook failures with merchant alerting
- 15-minute reconciliation sweeps for missed webhook events
