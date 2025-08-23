# hc-pricing-auto Brownfield Enhancement PRD

## Intro Project Analysis and Context

### Analysis Source
- Document-project output available at: `docs/brownfield-architecture.md`
- Comprehensive business context at: `docs/shopify-bulk-price-app-summary.md`
- IDE-based project loaded with full codebase access

### Current Project State
Based on existing analysis: Single-page Shopify app with two primary functions:
1. Simple bulk price increases ($10 to all selected variants)
2. Advanced inventory-based conditional pricing rules

The app uses Remix framework with Shopify App Bridge, Polaris v12 design system, and SQLite session storage. Main business logic concentrated in `app.admin.tsx` with known technical debt including unused template code and single-route architecture.

### Available Documentation Analysis
- ✅ Tech Stack Documentation (from document-project)
- ✅ Source Tree/Architecture (from document-project) 
- ✅ API Documentation (from document-project)
- ✅ External API Documentation (from document-project)
- ✅ Technical Debt Documentation (from document-project)
- ⚠️ UX/UI Guidelines (may not be in document-project)

### Enhancement Scope Definition

**Enhancement Type:**
- ☑ Major Feature Modification - Real-time automation with webhooks
- ☑ New Feature Addition - Campaign management system  
- ☑ Integration with New Systems - Webhook-based real-time processing
- ☑ UI/UX Overhaul - Multi-page navigation structure
- ☑ Technology Stack Upgrade - Architecture refactoring from single-file to modular

**Enhancement Description:**
Transform the current manual admin-based pricing tool into a real-time automated campaign system that responds to inventory changes via webhooks, while refactoring the single-file architecture into a proper multi-page navigation structure for scalability.

**Impact Assessment:**
- ☑ Major Impact (architectural changes required) - Moving from single-file to multi-page architecture, adding webhook infrastructure, implementing real-time automation

### Goals and Background Context

**Goals:**
• Enable real-time price adjustments based on inventory changes without manual intervention
• Create campaign management system for scheduled/automated pricing rules
• Refactor single-file architecture into maintainable multi-page structure
• Implement webhook infrastructure for real-time inventory monitoring
• Maintain all existing functionality during transition
• Follow first principles approach with smallest possible incremental changes

**Background Context:**
The app evolved organically from simple manual price changes to complex inventory-based rules, all concentrated in a single admin.tsx file. Initial attempts at user self-service failed, leading to the current centralized admin approach for testing. Now ready to scale to real-time automation but requires architectural foundation and webhook integration. The existing working functionality must be preserved while transitioning to a more scalable architecture.

**Enhanced Requirements with Competitive Insights:**
- **30-60 second response time** (acceptable given Shopify API limits and competitive analysis)
- **Comprehensive audit trail** for sensitive pricing decisions
- **Campaign management dashboard** with real-time status monitoring
- **Complete pricing history** with rollback capabilities
- **High-volume order handling** during peak periods (30-50 orders/hour)
- **Robust database design** for future expansion scenarios

**Key Market Differentiators Identified:**
- **Transparent audit trails** (competitors are "black boxes")
- **Campaign testing/staging capabilities** (market gap)
- **Granular rollback functionality** (rare in market)
- **Real-time campaign monitoring** (most competitors lack visibility)

### Change Log

| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial PRD Creation | 2025-08-22 | 1.0 | Brownfield enhancement PRD for campaign automation | John (PM Agent) |

## Requirements

### Functional Requirements

**FR1:** The system shall create and manage pricing campaigns with start/stop controls while maintaining all existing manual admin functionality as fallback.

**FR2:** Campaign dashboard shall display real-time status including: campaign name, affected products, current inventory levels, old prices, new prices, and execution status.

**FR3:** System shall process inventory webhook events and execute pricing rule changes within 30-60 seconds of inventory updates.

**FR4:** Complete audit trail shall track every pricing change with timestamp, campaign ID, product/variant details, old price, new price, trigger reason, and user/system attribution.

**FR5:** One-click campaign rollback functionality shall restore all affected products to pre-campaign pricing states using stored pricing history.

**FR6:** System shall handle high-volume stores with 30-50+ concurrent orders during peak hours without performance degradation.

**FR7:** Campaign creation interface shall allow testing/staging mode before activating live pricing changes.

**FR8:** Database shall store complete pricing history with ability to query by product, campaign, date range, and change magnitude.

### Non-Functional Requirements

**NFR1:** System shall respond to inventory webhook events within 30-60 seconds while respecting Shopify API rate limits (40 calls/second GraphQL).

**NFR2:** Database design shall support future expansion scenarios with scalable schema for additional campaign types and rule complexity.

**NFR3:** Audit trail storage shall maintain 2+ years of pricing history with efficient querying capabilities for compliance and analysis.

**NFR4:** Campaign monitoring dashboard shall refresh status within 5 seconds for real-time visibility during active campaigns.

**NFR5:** System shall maintain 99.5% uptime for webhook processing during peak shopping periods.

### Compatibility Requirements

**CR1:** All existing manual pricing functionality in app.admin.tsx must remain fully operational during and after campaign system implementation.

**CR2:** Current Shopify GraphQL integration patterns must be preserved and extended, not replaced, to maintain proven inventory query reliability.

**CR3:** Existing Polaris v12 UI components and design patterns must be maintained for consistency across new campaign management interfaces.

**CR4:** Current SQLite session storage must be enhanced, not replaced, with new campaign and audit tables while maintaining existing session functionality.

## Technical Constraints and Integration Requirements

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

## Epic and Story Structure

### Epic Approach
**Epic Structure Decision**: **Single Epic with Phased Story Implementation** 

**Rationale**: Your brownfield enhancement involves tightly coupled components (webhook processing, campaign management, database migration, audit trails) that need coordinated development. Multiple epics would create artificial boundaries and increase integration risk. A single epic with carefully sequenced stories allows for incremental risk management, consistent architecture evolution, and comprehensive testing continuity.

### Navigation Architecture
```
├── Home (Dashboard) - Shows active campaigns, recent pricing jobs, system status
├── Create Pricing Job - Enhanced version of current admin.tsx (immediate execution)
└── Create Campaigns - Automated campaign management with tracking
```

## Epic Details: Shopify Pricing Automation Platform Enhancement

**Epic Goal**: Transform existing manual pricing tool into a comprehensive pricing management platform with dashboard-driven navigation, enhanced manual pricing jobs, and automated campaign capabilities with real-time webhook processing.

**Integration Requirements**: 
- Preserve all existing admin.tsx functionality while migrating to enhanced "Create Pricing Job" page
- Implement PostgreSQL foundation for campaign management and comprehensive audit trails
- Maintain existing Shopify GraphQL patterns and Polaris v12 UI consistency
- Build dashboard-first experience that guides merchants to appropriate pricing actions

### Story 1.1: Database Foundation & Enhanced Audit Trail

As a **store owner**,
I want **complete tracking of all pricing changes with detailed audit trails**,
so that **I can maintain compliance, understand pricing history, and have confidence in pricing decisions**.

#### Acceptance Criteria
1. PostgreSQL database replaces SQLite for session storage and adds campaign/audit tables
2. Every pricing change (manual or automated) creates audit trail record with timestamp, old/new price, trigger reason
3. Pricing job results table includes audit trail references and export capabilities
4. Database migration preserves all existing session data without disruption
5. Enhanced results display shows job IDs, execution time, and detailed change tracking

#### Integration Verification
- **IV1**: All existing admin.tsx pricing functionality works identically with PostgreSQL backend
- **IV2**: Session management and Shopify authentication remain completely functional
- **IV3**: Performance testing confirms no degradation with audit trail recording during high-volume changes

### Story 1.2: Dashboard & Multi-Page Navigation Architecture

As a **store owner**,
I want **a professional dashboard that shows my pricing activity and guides me to the right tools**,
so that **I can efficiently manage both immediate pricing needs and automated campaigns**.

#### Acceptance Criteria
1. New dashboard homepage shows "Recent Pricing Jobs" and "Active Campaigns" sections
2. Navigation structure: Home (Dashboard) / Create Pricing Job / Create Campaigns
3. Dashboard displays system health indicators and quick action buttons
4. "Create Campaigns" page shows "Coming Soon" message with signup for notifications
5. All existing functionality accessible through "Create Pricing Job" navigation

#### Integration Verification
- **IV1**: All existing manual pricing workflows accessible through new navigation
- **IV2**: Dashboard loads within 2 seconds and displays accurate recent activity
- **IV3**: Navigation preserves all existing Shopify App Bridge and Polaris patterns

### Story 1.3: Enhanced Create Pricing Job Page

As a **store owner**,
I want **an improved interface for immediate pricing changes with better organization and reusability**,
so that **I can efficiently execute manual pricing jobs and prepare templates for future automation**.

#### Acceptance Criteria
1. Enhanced UI organization of existing admin.tsx functionality using improved Polaris layouts
2. Job naming capability: "Black Friday Prep Job" with save/load job templates
3. Improved results table with export options (CSV/PDF) and detailed change summaries
4. "Save as Template" functionality for reusing pricing rule configurations
5. Integration hint: "Convert to Auto Campaign" button (disabled with "Coming Soon" tooltip)

#### Integration Verification
- **IV1**: All existing pricing logic (inventory rules, bulk updates) functions identically
- **IV2**: Resource picker and product selection workflows remain unchanged
- **IV3**: Results processing and error handling maintain existing reliability patterns

### Story 1.4: Auto Campaign Dashboard & Creation System

As a **store owner**,
I want **to create and monitor automated pricing campaigns that respond to inventory changes**,
so that **I can maintain optimal pricing without constant manual intervention**.

#### Acceptance Criteria
1. Campaign creation wizard with familiar rule logic from enhanced pricing jobs
2. Campaign dashboard shows active/paused/completed campaigns with real-time status
3. Campaign automation toggle with clear warnings about automatic price changes
4. Live activity feed showing campaign-triggered pricing changes
5. Campaign pause/resume controls with immediate effect

#### Integration Verification
- **IV1**: Campaign rule logic uses same proven patterns as manual pricing jobs
- **IV2**: Campaign-triggered changes appear in same audit trail system as manual jobs
- **IV3**: Dashboard performance remains responsive with multiple active campaigns

### Story 1.5: Webhook Integration & Real-Time Processing

As a **store owner**,
I want **my campaigns to respond automatically to inventory changes within 30-60 seconds**,
so that **I can maintain optimal pricing based on real-time inventory levels without manual monitoring**.

#### Acceptance Criteria
1. Shopify inventory webhook integration with idempotent processing and retry logic
2. Campaign dashboard shows webhook status indicators and response time monitoring
3. Live activity log displaying: "15:34 - Inventory changed, price updated in 45 seconds"
4. Dead letter queue handling for failed webhook processing with merchant alerts
5. 15-minute reconciliation sweeps to catch any missed webhook events

#### Integration Verification
- **IV1**: Webhook processing respects existing Shopify API rate limits and patterns
- **IV2**: Manual pricing jobs continue to function during webhook processing
- **IV3**: Campaign execution maintains audit trail consistency with manual job patterns

### Story 1.6: Advanced Campaign Tracking & Management

As a **store owner**,
I want **comprehensive campaign analytics, rollback capabilities, and advanced management tools**,
so that **I can optimize my automated pricing strategy and recover quickly from any issues**.

#### Acceptance Criteria
1. Campaign analytics showing performance metrics, price change frequency, and revenue impact
2. One-click campaign rollback with restoration to pre-campaign pricing states
3. Campaign cloning and template system for easy setup of similar campaigns
4. Historical campaign comparison and optimization recommendations
5. Integration between pricing job templates and campaign creation

#### Integration Verification
- **IV1**: Rollback functionality preserves audit trail integrity and maintains system consistency
- **IV2**: Campaign analytics integrate with existing Shopify data patterns without performance impact
- **IV3**: Advanced features maintain compatibility with all existing manual and automated pricing functionality

---

**This PRD provides comprehensive guidance for transforming your brownfield Shopify pricing app into a professional campaign-driven automation platform while preserving all existing functionality and maintaining system reliability.**