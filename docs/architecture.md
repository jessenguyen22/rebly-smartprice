# hc-pricing-auto Fullstack Architecture Document

## Introduction

This document outlines the complete fullstack architecture for **hc-pricing-auto**, including backend systems, frontend implementation, and their integration. It serves as the single source of truth for AI-driven development, ensuring consistency across the entire technology stack.

This unified approach combines what would traditionally be separate backend and frontend architecture documents, streamlining the development process for modern fullstack applications where these concerns are increasingly intertwined.

### Starter Template or Existing Project

**Project Type:** Brownfield Enhancement - Existing Shopify App  
**Base Template:** Shopify App Remix Template v3.7.0  
**Current State:** Single-page admin tool with pricing automation functionality  

**Pre-configured Architectural Constraints:**
- **Shopify App Framework**: Must maintain Shopify App Bridge integration and Polaris v12 design system
- **Remix Framework**: File-based routing structure in `app/routes/` directory
- **Authentication**: Shopify session-based auth with Prisma session storage
- **API Integration**: Embedded Shopify Admin GraphQL API patterns
- **Deployment**: Configured for Shopify app hosting requirements

**Existing Technical Decisions to Retain:**
- Current Remix 2.16.1 + React 18.2.0 foundation
- Shopify Polaris v12 component library
- PostgreSQL migration path (replacing SQLite)
- Shopify Admin GraphQL API integration patterns
- TypeScript + strict type safety approach

**Enhancement Scope:**
Transform from single-file admin tool (`app.admin.tsx`) to multi-page campaign management platform with real-time webhook automation while preserving all existing manual pricing functionality.

### Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-08-22 | 1.0 | Initial fullstack architecture for brownfield enhancement | Winston (Architect) |

## High Level Architecture

### Technical Summary

This is a **Shopify embedded app** using Remix fullstack framework with Polaris UI, transforming from a single-page manual pricing tool into a comprehensive campaign automation platform. The architecture leverages **PostgreSQL for data persistence**, **Shopify webhooks for real-time inventory monitoring**, and **multi-page navigation** for enhanced user experience. Key integration points include Shopify Admin GraphQL API for product management, webhook processing for automated campaign triggers, and audit trail systems for compliance and rollback capabilities. The platform choice emphasizes **developer productivity** while maintaining enterprise-grade reliability for high-volume Shopify stores processing 30-50+ orders during peak periods.

### Platform and Infrastructure Choice

**Platform:** Your Dedicated Server  
**Key Services:** PostgreSQL, Redis (caching/queues), Nginx (reverse proxy), Docker  
**Deployment Host and Regions:** Your server location + CDN if needed  

**Recommendation: Your Dedicated Server with Docker Stack**
- PostgreSQL + Redis on your server (16GB RAM is excellent for this workload)
- Shopify app can be hosted on your server or Shopify hosting (depends on compliance needs)
- 500GB storage perfect for extensive audit trails and campaign history
- Docker Compose for easy deployment and management

### Repository Structure

**Structure:** Monorepo with Docker services  
**Monorepo Tool:** npm workspaces + Docker Compose  
**Package Organization:** Service-oriented with infrastructure as code  

```
hc-pricing-auto/
├── app/                    # Main Remix application
├── packages/
│   ├── shared/            # Shared types and utilities
│   ├── webhook-processor/ # Isolated webhook handling service
│   └── audit-logger/      # Audit trail system
├── infrastructure/
│   ├── docker-compose.yml # Full stack deployment
│   ├── nginx/             # Reverse proxy config
│   ├── postgres/          # Database init scripts
│   └── redis/             # Cache configuration
├── scripts/
│   ├── deploy.sh          # Deployment automation
│   └── backup.sh          # Database backup script
└── docs/
```

### High Level Architecture Diagram

```mermaid
graph TB
    User[Store Owner] --> App[Shopify Admin]
    App --> |Embedded App| Remix[Remix Frontend]
    
    Remix --> |GraphQL| ShopifyAPI[Shopify Admin API]
    Remix --> |HTTP| Backend[Remix Backend Routes]
    
    Backend --> |SQL| DB[(PostgreSQL<br/>16GB RAM)]
    Backend --> |Queue| Redis[(Redis Cache<br/>& Job Queue)]
    
    ShopifyWebhooks[Shopify Webhooks] --> |HTTP| WebhookService[Webhook Service]
    WebhookService --> |Jobs| Redis
    Redis --> |Process| CampaignWorker[Campaign Worker]
    CampaignWorker --> |Price Updates| ShopifyAPI
    
    CampaignWorker --> |Log Changes| DB
    Backend --> |Real-time Updates| Remix
    
    subgraph "Your Server (16GB RAM, 500GB)"
        Remix
        Backend
        DB
        Redis
        WebhookService
        CampaignWorker
        Nginx[Nginx Proxy]
    end
    
    subgraph "External"
        ShopifyAPI
        ShopifyWebhooks
    end
```

### Architectural Patterns

- **Jamstack + Server Actions:** Static-generated admin interface with server-side campaign processing - _Rationale:_ Optimal performance for Shopify admin embedding while maintaining real-time capabilities
- **Event-Driven Architecture:** Webhook-triggered campaign execution with audit logging - _Rationale:_ Enables real-time automation while maintaining system reliability and compliance requirements  
- **Repository Pattern:** Abstract database operations for campaigns and audit trails - _Rationale:_ Facilitates testing and future scaling of data storage solutions
- **Command Query Separation:** Separate read/write operations for campaign management - _Rationale:_ Optimizes performance for dashboard queries while ensuring data consistency for pricing updates
- **Embedded App Pattern:** Full Shopify App Bridge integration with Polaris components - _Rationale:_ Maintains native Shopify admin experience and leverages existing merchant workflows

## Tech Stack

This is the DEFINITIVE technology selection for the entire project. This table is the single source of truth - all development must use these exact versions.

### Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| Frontend Language | TypeScript | 5.2.2 | Type-safe frontend development | Already established in existing codebase, prevents runtime errors |
| Frontend Framework | Remix | 2.16.1 | Full-stack React framework | Existing foundation, excellent for Shopify apps with SSR capabilities |
| UI Component Library | Shopify Polaris | 12.0.0 | Shopify-native components | Mandatory for embedded Shopify apps, maintains design consistency |
| State Management | React Built-in + Remix | N/A | Form state and server state | Remix handles server state, React hooks for local UI state |
| Backend Language | TypeScript | 5.2.2 | Type-safe backend development | Shared types between frontend/backend, consistent codebase |
| Backend Framework | Remix (Server) | 2.16.1 | API routes and server logic | Unified framework reduces complexity, built-in form handling |
| API Style | REST + GraphQL | N/A | Shopify GraphQL + internal REST | Must use Shopify GraphQL, internal REST for webhook processing |
| Database | PostgreSQL | 15+ | Primary data storage | Production-ready, excellent for audit trails, your server has ample RAM |
| Cache | Redis | 7+ | Job queue and caching | Perfect for webhook job processing, session caching |
| File Storage | Local Filesystem | N/A | Export files and logs | Your 500GB storage, simple and reliable |
| Authentication | Shopify App Auth | N/A | Shopify session management | Required for embedded Shopify apps |
| Frontend Testing | Vitest + React Testing Library | Latest | Component and integration testing | Modern, fast, TypeScript-native |
| Backend Testing | Vitest + Supertest | Latest | API endpoint testing | Consistent with frontend testing approach |
| E2E Testing | Playwright | Latest | End-to-end workflow testing | Excellent for Shopify app flows, reliable automation |
| Build Tool | Vite | 6.2.2 | Modern build tooling | Already configured in existing project |
| Bundler | Vite | 6.2.2 | Module bundling | Integrated with Vite build tool |
| IaC Tool | Docker Compose | Latest | Container orchestration | Perfect for your server setup, easy deployment |
| CI/CD | GitHub Actions | N/A | Automated deployment | Free tier suitable, integrates with your server |
| Monitoring | Node.js Built-in + Winston | Latest | Application logging | Simple, effective for single-server deployment |
| Logging | Winston + PostgreSQL | Latest | Structured logging and audit | Database-backed logging for audit compliance |
| CSS Framework | Shopify Polaris CSS | 12.0.0 | Styling system | Required for Polaris components, maintains consistency |

## Data Models

Based on PRD requirements, I've identified the core business entities that will be shared between frontend and backend. These models form the foundation of the campaign automation system while preserving existing manual pricing functionality.

### Campaign

**Purpose:** Represents automated pricing campaigns that respond to inventory changes via webhooks. Central entity for the new automation features.

**Key Attributes:**
- id: string - Unique campaign identifier
- name: string - Human-readable campaign name ("Black Friday Auto-Pricing")
- status: CampaignStatus - Current campaign state (active, paused, completed)
- rules: PricingRule[] - Array of inventory-based pricing conditions
- createdAt: Date - Campaign creation timestamp
- updatedAt: Date - Last modification timestamp
- userId: string - Shopify user who created the campaign
- triggerCount: number - Number of times campaign has been triggered

#### TypeScript Interface

```typescript
interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'draft';
  description?: string;
  rules: PricingRule[];
  targetProducts: string[]; // Shopify product IDs
  startDate?: Date;
  endDate?: Date;
  triggerCount: number;
  lastTriggered?: Date;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  shopifyShop: string;
}

type CampaignStatus = 'active' | 'paused' | 'completed' | 'draft';
```

#### Relationships
- Has many AuditTrailEntry records (campaign execution history)
- Has many PricingJobResult records (price changes made by campaign)
- Belongs to ShopifyShop (multi-tenant support)

### PricingRule

**Purpose:** Defines inventory-based conditional logic for both manual pricing jobs and automated campaigns. Preserves existing rule structure while enabling reuse.

**Key Attributes:**
- whenCondition: string - Inventory change trigger condition
- whenValue: string - Threshold value for trigger
- thenAction: string - Pricing action to execute
- thenMode: string - How to apply pricing change (percentage/absolute)
- thenValue: string - Amount of pricing change
- changeCompareAt: boolean - Whether to update compare-at price

#### TypeScript Interface

```typescript
interface PricingRule {
  id?: string;
  whenCondition: 'decreases_by_percent' | 'increases_by_percent' | 
                 'decreases_by_abs' | 'increases_by_abs' | 
                 'less_than_abs' | 'more_than_abs';
  whenValue: string;
  thenAction: 'reduce_price' | 'increase_price' | 'change_price';
  thenMode: 'percentage' | 'absolute';
  thenValue: string;
  changeCompareAt: boolean;
  description?: string;
}
```

#### Relationships
- Belongs to Campaign (for automated rules)
- Belongs to PricingJob (for manual rules)
- Used in ProcessingResult records

### PricingJob

**Purpose:** Represents manual pricing operations (enhanced version of current admin.tsx functionality). Maintains existing workflow while adding audit capabilities.

#### TypeScript Interface

```typescript
interface PricingJob {
  id: string;
  name: string;
  type: 'manual_bulk' | 'manual_rules' | 'campaign_auto';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  selectedVariants: SelectedVariant[];
  rules?: PricingRule[];
  bulkAmount?: string;
  bulkType?: 'increase' | 'decrease';
  results: ProcessingResult[];
  createdAt: Date;
  completedAt?: Date;
  userId: string;
  shopifyShop: string;
}
```

#### Relationships
- Has many ProcessingResult records (detailed execution results)
- Has many AuditTrailEntry records (change tracking)
- May have PricingRule records (for rules-based jobs)

### AuditTrailEntry

**Purpose:** Comprehensive audit logging for all pricing changes, supporting compliance requirements and rollback functionality.

#### TypeScript Interface

```typescript
interface AuditTrailEntry {
  id: string;
  entityType: 'variant' | 'product';
  entityId: string; // Shopify GID
  changeType: 'price_update' | 'compare_at_update' | 'inventory_sync';
  oldValue: string;
  newValue: string;
  triggerReason: string;
  campaignId?: string;
  pricingJobId?: string;
  userId?: string;
  timestamp: Date;
  shopifyShop: string;
  metadata?: Record<string, any>;
}
```

#### Relationships
- Belongs to Campaign (if campaign-triggered)
- Belongs to PricingJob (if job-triggered)
- References Shopify entities (variants, products)

### ProcessingResult

**Purpose:** Detailed execution results for individual variant processing, preserving existing result structure while adding audit references.

#### TypeScript Interface

```typescript
interface ProcessingResult {
  id: string;
  variantId: string;
  success: boolean;
  oldPrice?: string;
  newPrice?: string;
  productTitle?: string;
  variantTitle?: string;
  inventory?: number;
  error?: string;
  reason?: string;
  ruleApplied?: string;
  processedAt: Date;
  auditTrailId?: string;
}
```

#### Relationships
- Belongs to PricingJob (execution context)
- References AuditTrailEntry (audit logging)
- References Shopify variant (external entity)

## API Specification

Based on the chosen API style (REST for internal operations + Shopify GraphQL for external integration), here's the comprehensive API specification covering all endpoints from the epic stories.

### REST API Specification

```yaml
openapi: 3.0.0
info:
  title: HC Pricing Automation API
  version: 1.0.0
  description: Internal REST API for campaign management and pricing job operations
servers:
  - url: http://localhost:3000/api
    description: Development server
  - url: https://your-server.com/api
    description: Production server

paths:
  /campaigns:
    get:
      summary: List all campaigns
      parameters:
        - name: status
          in: query
          schema:
            type: string
            enum: [active, paused, completed, draft]
        - name: limit
          in: query
          schema:
            type: integer
            default: 20
      responses:
        200:
          description: List of campaigns
          content:
            application/json:
              schema:
                type: object
                properties:
                  campaigns:
                    type: array
                    items:
                      $ref: '#/components/schemas/Campaign'
                  pagination:
                    $ref: '#/components/schemas/Pagination'
    post:
      summary: Create new campaign
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateCampaignRequest'
      responses:
        201:
          description: Campaign created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Campaign'

  /campaigns/{id}:
    get:
      summary: Get campaign details
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Campaign details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Campaign'
    patch:
      summary: Update campaign
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UpdateCampaignRequest'
      responses:
        200:
          description: Campaign updated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Campaign'

  /campaigns/{id}/rollback:
    post:
      summary: Rollback campaign changes
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Rollback initiated
          content:
            application/json:
              schema:
                type: object
                properties:
                  rollbackJobId:
                    type: string
                  message:
                    type: string

  /pricing-jobs:
    get:
      summary: List pricing jobs
      parameters:
        - name: type
          in: query
          schema:
            type: string
            enum: [manual_bulk, manual_rules, campaign_auto]
        - name: status
          in: query
          schema:
            type: string
            enum: [pending, processing, completed, failed]
      responses:
        200:
          description: List of pricing jobs
          content:
            application/json:
              schema:
                type: object
                properties:
                  jobs:
                    type: array
                    items:
                      $ref: '#/components/schemas/PricingJob'
    post:
      summary: Create manual pricing job
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePricingJobRequest'
      responses:
        201:
          description: Pricing job created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PricingJob'

  /pricing-jobs/{id}:
    get:
      summary: Get pricing job details
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        200:
          description: Pricing job details with results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PricingJobWithResults'

  /webhooks/inventory:
    post:
      summary: Process Shopify inventory webhook
      description: Internal endpoint for webhook processing service
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                inventory_item_id:
                  type: string
                available:
                  type: integer
                location_id:
                  type: string
      responses:
        200:
          description: Webhook processed
          content:
            application/json:
              schema:
                type: object
                properties:
                  processed:
                    type: boolean
                  campaignsTriggered:
                    type: array
                    items:
                      type: string

  /audit-trail:
    get:
      summary: Query audit trail entries
      parameters:
        - name: entityId
          in: query
          schema:
            type: string
        - name: campaignId
          in: query
          schema:
            type: string
        - name: startDate
          in: query
          schema:
            type: string
            format: date-time
        - name: endDate
          in: query
          schema:
            type: string
            format: date-time
      responses:
        200:
          description: Audit trail entries
          content:
            application/json:
              schema:
                type: object
                properties:
                  entries:
                    type: array
                    items:
                      $ref: '#/components/schemas/AuditTrailEntry'

components:
  schemas:
    Campaign:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        status:
          type: string
          enum: [active, paused, completed, draft]
        description:
          type: string
        rules:
          type: array
          items:
            $ref: '#/components/schemas/PricingRule'
        targetProducts:
          type: array
          items:
            type: string
        triggerCount:
          type: integer
        createdAt:
          type: string
          format: date-time
        updatedAt:
          type: string
          format: date-time

    PricingRule:
      type: object
      properties:
        id:
          type: string
        whenCondition:
          type: string
          enum: [decreases_by_percent, increases_by_percent, decreases_by_abs, increases_by_abs, less_than_abs, more_than_abs]
        whenValue:
          type: string
        thenAction:
          type: string
          enum: [reduce_price, increase_price, change_price]
        thenMode:
          type: string
          enum: [percentage, absolute]
        thenValue:
          type: string
        changeCompareAt:
          type: boolean

    PricingJob:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
        type:
          type: string
          enum: [manual_bulk, manual_rules, campaign_auto]
        status:
          type: string
          enum: [pending, processing, completed, failed]
        selectedVariants:
          type: array
          items:
            $ref: '#/components/schemas/SelectedVariant'
        createdAt:
          type: string
          format: date-time

    SelectedVariant:
      type: object
      properties:
        id:
          type: string
        productId:
          type: string
        title:
          type: string
        price:
          type: string
        inventory:
          type: integer

    AuditTrailEntry:
      type: object
      properties:
        id:
          type: string
        entityType:
          type: string
          enum: [variant, product]
        entityId:
          type: string
        changeType:
          type: string
          enum: [price_update, compare_at_update, inventory_sync]
        oldValue:
          type: string
        newValue:
          type: string
        triggerReason:
          type: string
        timestamp:
          type: string
          format: date-time

    CreateCampaignRequest:
      type: object
      required:
        - name
        - rules
        - targetProducts
      properties:
        name:
          type: string
        description:
          type: string
        rules:
          type: array
          items:
            $ref: '#/components/schemas/PricingRule'
        targetProducts:
          type: array
          items:
            type: string
        startDate:
          type: string
          format: date-time
        endDate:
          type: string
          format: date-time

security:
  - shopifyAuth: []

securitySchemes:
  shopifyAuth:
    type: http
    scheme: bearer
    description: Shopify session token
```

## Components

Based on the architectural patterns, tech stack, and data models, I've identified the major logical components across the fullstack that will handle campaign automation, manual pricing jobs, and real-time webhook processing.

### Remix Frontend App

**Responsibility:** Main user interface for campaign management and manual pricing operations, embedded within Shopify Admin using App Bridge and Polaris components.

**Key Interfaces:**
- `/app/dashboard` - Campaign overview and recent activity
- `/app/pricing-job` - Enhanced manual pricing interface
- `/app/campaigns` - Campaign creation and management
- `/app/campaigns/:id` - Campaign details and monitoring

**Dependencies:** Shopify App Bridge, Polaris UI components, Remix server routes for data fetching

**Technology Stack:** React 18.2.0, Remix 2.16.1, TypeScript 5.2.2, Shopify Polaris 12.0.0

### Remix Server Routes

**Responsibility:** API endpoints, form handling, authentication, and server-side business logic. Handles both manual pricing operations and campaign management.

**Key Interfaces:**
- `POST /api/campaigns` - Campaign CRUD operations
- `POST /api/pricing-jobs` - Manual pricing job execution
- `POST /api/webhooks/inventory` - Webhook processing endpoint
- `GET /api/audit-trail` - Audit log queries

**Dependencies:** PostgreSQL database, Redis job queue, Shopify Admin GraphQL API

**Technology Stack:** Remix server routes, Prisma ORM, Shopify GraphQL client

### Campaign Engine

**Responsibility:** Core business logic for evaluating pricing rules, processing inventory changes, and executing automated price updates based on webhook triggers.

**Key Interfaces:**
- `evaluateRules(inventory, rules)` - Rule evaluation engine
- `executePriceUpdates(variants, changes)` - Price update orchestration
- `createAuditTrail(changes)` - Audit logging interface

**Dependencies:** Shopify Admin GraphQL API, PostgreSQL audit tables, Redis job coordination

**Technology Stack:** Node.js background service, Shopify GraphQL mutations, PostgreSQL transactions

### Webhook Processing Service

**Responsibility:** Receives Shopify inventory webhooks, validates payload authenticity, queues processing jobs, and triggers campaign evaluation for affected products.

**Key Interfaces:**
- `POST /webhooks/inventory` - Shopify webhook receiver
- `validateWebhookSignature(payload, signature)` - Security validation
- `queueCampaignEvaluation(inventoryChange)` - Job queuing

**Dependencies:** Redis job queue, Campaign Engine, webhook signature verification

**Technology Stack:** Express.js microservice, Redis Bull queue, crypto signature validation

### Database Layer

**Responsibility:** Data persistence for campaigns, pricing jobs, audit trails, and session storage. Optimized for complex queries and audit compliance requirements.

**Key Interfaces:**
- Campaign repository with rule queries
- Audit trail repository with time-range queries
- Pricing job repository with result aggregation
- Session storage for Shopify authentication

**Dependencies:** PostgreSQL 15+, connection pooling, backup strategies

**Technology Stack:** PostgreSQL with Prisma ORM, Redis for caching frequent queries

### Shopify Integration Layer

**Responsibility:** Abstracts all Shopify Admin API interactions, handles rate limiting, manages GraphQL queries/mutations, and processes webhook authentication.

**Key Interfaces:**
- `getProductVariants(productIds)` - Product data fetching
- `updateVariantPrices(variants, prices)` - Batch price updates
- `queryInventoryLevels(locationId)` - Inventory monitoring
- `validateWebhookAuth(signature, payload)` - Webhook security

**Dependencies:** Shopify Admin GraphQL API, rate limiting (40 calls/second), authentication tokens

**Technology Stack:** Shopify App Remix client, GraphQL query builders, retry logic for API limits

### Background Job Processor

**Responsibility:** Processes queued jobs for campaign execution, price updates, audit trail generation, and system maintenance tasks like reconciliation sweeps.

**Key Interfaces:**
- Redis job consumption and processing
- Error handling and retry logic
- Dead letter queue management
- Job status reporting

**Dependencies:** Redis Bull queues, Campaign Engine, error logging

**Technology Stack:** Node.js worker processes, Redis queue management, Winston logging

### Component Diagrams

```mermaid
graph TD
    subgraph "Frontend Layer"
        Frontend[Remix Frontend App]
        Polaris[Polaris Components]
    end
    
    subgraph "API Layer"
        Server[Remix Server Routes]
        Auth[Shopify Auth]
    end
    
    subgraph "Business Logic"
        Campaign[Campaign Engine]
        Webhook[Webhook Service]
        Jobs[Background Processor]
    end
    
    subgraph "Data Layer"
        DB[Database Layer]
        Cache[Redis Cache/Queue]
    end
    
    subgraph "External"
        ShopifyAPI[Shopify GraphQL]
        ShopifyWebhooks[Shopify Webhooks]
    end
    
    Frontend --> Server
    Frontend --> Polaris
    Server --> Auth
    Server --> Campaign
    Server --> DB
    
    ShopifyWebhooks --> Webhook
    Webhook --> Cache
    Cache --> Jobs
    Jobs --> Campaign
    
    Campaign --> ShopifyAPI
    Campaign --> DB
    Server --> Cache
    
    DB --> PostgreSQL[(PostgreSQL)]
    Cache --> Redis[(Redis)]
```

## External APIs

The project integrates with Shopify's ecosystem for product management, inventory monitoring, and webhook processing. All external integrations are focused on the Shopify Admin API platform.

### Shopify Admin GraphQL API

- **Purpose:** Primary integration for product/variant management, pricing updates, and inventory queries
- **Documentation:** https://shopify.dev/docs/api/admin-graphql
- **Base URL(s):** `https://{shop}.myshopify.com/admin/api/2024-01/graphql.json`
- **Authentication:** Bearer token via Shopify App authentication flow
- **Rate Limits:** 40 calls/second for GraphQL queries, cost-based throttling system

**Key Endpoints Used:**
- `POST /admin/api/2024-01/graphql.json` - All GraphQL operations for products, variants, inventory, and price updates

**Integration Notes:** 
- Uses embedded GraphQL queries with template literals following existing codebase patterns
- Implements exponential backoff for rate limit handling
- Batch processing of variant updates (5 variants per batch) to respect API limits
- Query cost calculation to prevent throttling during campaign execution

### Shopify Webhooks API

- **Purpose:** Real-time inventory change notifications to trigger automated campaign processing
- **Documentation:** https://shopify.dev/docs/apps/webhooks
- **Base URL(s):** Webhook payloads delivered to your server endpoint: `https://your-server.com/webhooks/inventory`
- **Authentication:** HMAC-SHA256 signature verification using webhook secret
- **Rate Limits:** No explicit limits, but payload delivery retry logic (up to 19 attempts over 48 hours)

**Key Endpoints Used:**
- `POST /webhooks/inventory` - Inventory level updates for tracked products
- `POST /webhooks/inventory_items/update` - Inventory item changes
- `POST /webhooks/products/update` - Product updates that may affect campaigns

**Integration Notes:**
- Webhook signature verification using crypto.createHmac for security
- Idempotent processing to handle duplicate webhook deliveries
- Dead letter queue for failed webhook processing with merchant alerts
- 15-minute reconciliation sweeps to catch missed webhook events

### Shopify App Bridge API

- **Purpose:** Embedded app framework for native Shopify admin experience and navigation
- **Documentation:** https://shopify.dev/docs/apps/tools/app-bridge
- **Base URL(s):** Client-side JavaScript API, no HTTP endpoints
- **Authentication:** Integrated with Shopify session tokens
- **Rate Limits:** No explicit API rate limits, bound by browser performance

**Key Endpoints Used:**
- Client-side navigation and modal management APIs
- Resource picker for product/variant selection
- Toast notifications for user feedback
- Loading states and progress indicators

**Integration Notes:**
- Maintains existing App Bridge patterns from current admin.tsx implementation
- Uses Polaris components that integrate seamlessly with App Bridge
- Session token refresh handled automatically by Shopify App Remix library
- Navigation preserves Shopify admin context and breadcrumbs

## Core Workflows

The following sequence diagrams illustrate key system workflows including both frontend user interactions and backend webhook processing, showing component interactions and error handling paths.

```mermaid
sequenceDiagram
    participant User as Store Owner
    participant Frontend as Remix Frontend
    participant Server as Remix Server
    participant DB as PostgreSQL
    participant Shopify as Shopify API
    participant Redis as Redis Queue

    Note over User,Redis: Manual Pricing Job Workflow
    
    User->>Frontend: Access "Create Pricing Job"
    Frontend->>User: Display enhanced pricing interface
    User->>Frontend: Select variants & configure rules
    Frontend->>Shopify: Resource picker integration
    Shopify-->>Frontend: Selected variant data
    
    User->>Frontend: Submit pricing job
    Frontend->>Server: POST /pricing-jobs
    Server->>DB: Create PricingJob record
    Server->>Server: Validate pricing rules
    
    loop For each variant batch (5 variants)
        Server->>Shopify: Query variant details
        Shopify-->>Server: Variant data with inventory
        Server->>Server: Evaluate pricing rules
        Server->>Shopify: Update variant price
        Shopify-->>Server: Price update confirmation
        Server->>DB: Create ProcessingResult
        Server->>DB: Create AuditTrailEntry
    end
    
    Server-->>Frontend: Job completion with results
    Frontend->>User: Display results table with audit trail
```

```mermaid
sequenceDiagram
    participant Webhook as Shopify Webhooks
    participant WebhookService as Webhook Service
    participant Redis as Redis Queue
    participant Worker as Background Worker
    participant Campaign as Campaign Engine
    participant DB as PostgreSQL
    participant Shopify as Shopify API
    participant Frontend as Remix Frontend

    Note over Webhook,Frontend: Automated Campaign Workflow
    
    Webhook->>WebhookService: POST /webhooks/inventory
    WebhookService->>WebhookService: Verify HMAC signature
    
    alt Invalid signature
        WebhookService-->>Webhook: 401 Unauthorized
    else Valid signature
        WebhookService->>Redis: Queue inventory processing job
        WebhookService-->>Webhook: 200 OK
    end
    
    Redis->>Worker: Process inventory change job
    Worker->>DB: Query active campaigns for product
    
    loop For each active campaign
        Worker->>Campaign: Evaluate campaign rules
        Campaign->>Campaign: Check inventory conditions
        
        alt Rules match inventory change
            Campaign->>Shopify: Query affected variants
            Shopify-->>Campaign: Variant data
            Campaign->>Shopify: Update variant prices
            Shopify-->>Campaign: Price update confirmation
            Campaign->>DB: Create AuditTrailEntry
            Campaign->>DB: Update campaign trigger count
            Campaign->>Redis: Publish real-time update
        end
    end
    
    Worker-->>Redis: Job completion status
    Redis->>Frontend: Real-time dashboard update
    Frontend->>Frontend: Update campaign status display
```

```mermaid
sequenceDiagram
    participant User as Store Owner
    participant Frontend as Remix Frontend
    participant Server as Remix Server
    participant DB as PostgreSQL
    participant Shopify as Shopify API
    participant Worker as Background Worker

    Note over User,Worker: Campaign Creation & Management Workflow
    
    User->>Frontend: Access "Create Campaign"
    Frontend->>User: Display campaign creation wizard
    
    User->>Frontend: Configure campaign rules & products
    Frontend->>Server: POST /campaigns
    Server->>DB: Create Campaign record (draft status)
    Server->>DB: Create associated PricingRule records
    
    User->>Frontend: Activate campaign
    Frontend->>Server: PATCH /campaigns/{id} (status: active)
    Server->>DB: Update campaign status
    Server->>Server: Register webhook subscriptions
    
    Note over Server: Campaign now listening for webhooks
    
    User->>Frontend: View campaign dashboard
    Frontend->>Server: GET /campaigns/{id}
    Server->>DB: Query campaign with recent activity
    Server-->>Frontend: Campaign details + audit trail
    
    alt User requests rollback
        User->>Frontend: Click "Rollback Campaign"
        Frontend->>Server: POST /campaigns/{id}/rollback
        Server->>DB: Query all AuditTrailEntry for campaign
        Server->>Worker: Queue rollback job
        
        Worker->>Shopify: Restore original prices
        Shopify-->>Worker: Confirmation
        Worker->>DB: Create rollback audit entries
        Worker-->>Server: Rollback completion
        Server-->>Frontend: Rollback success
    end
```

```mermaid
sequenceDiagram
    participant System as System Monitor
    participant Worker as Background Worker
    participant DB as PostgreSQL
    participant Shopify as Shopify API
    participant Alert as Alert System

    Note over System,Alert: Error Handling & Recovery Workflow
    
    System->>Worker: 15-minute reconciliation sweep
    Worker->>DB: Query recent webhook processing gaps
    
    alt Missing webhook events detected
        Worker->>Shopify: Query inventory levels directly
        Shopify-->>Worker: Current inventory data
        Worker->>Worker: Compare with last known state
        
        loop For each discrepancy
            Worker->>Campaign: Evaluate rules with current data
            Campaign->>Shopify: Update prices if needed
            Campaign->>DB: Create audit entry (reconciliation)
        end
    end
    
    alt Webhook processing failure
        Worker->>Redis: Move to dead letter queue
        Worker->>Alert: Send merchant notification
        Alert->>Frontend: Display system alert
        
        Note over Worker: Retry with exponential backoff
        Worker->>Worker: Retry webhook processing
        
        alt Retry successful
            Worker->>DB: Log successful recovery
        else Retry failed
            Worker->>Alert: Escalate to manual intervention
        end
    end
    
    alt Shopify API rate limit exceeded
        Worker->>Worker: Implement exponential backoff
        Worker->>DB: Log rate limit encounter
        Worker->>Redis: Requeue job with delay
        
        Note over Worker: Wait and retry automatically
    end
```

## Database Schema

The database schema transforms the conceptual data models into concrete PostgreSQL structures, optimized for campaign management, audit trail queries, and high-volume pricing operations.

```sql
-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shopify shops for multi-tenant support
CREATE TABLE shopify_shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_domain VARCHAR(255) NOT NULL UNIQUE,
    access_token TEXT NOT NULL,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Campaign management table
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('active', 'paused', 'completed', 'draft')),
    target_products TEXT[] NOT NULL, -- Array of Shopify product IDs
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    last_triggered TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(255) NOT NULL,
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE
);

-- Index for active campaign queries
CREATE INDEX idx_campaigns_active ON campaigns (shopify_shop_id, status) 
WHERE status = 'active';

-- Index for campaign dashboard queries
CREATE INDEX idx_campaigns_user_recent ON campaigns (user_id, created_at DESC);

-- Pricing rules for both campaigns and manual jobs
CREATE TABLE pricing_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    pricing_job_id UUID REFERENCES pricing_jobs(id) ON DELETE CASCADE,
    when_condition VARCHAR(50) NOT NULL 
        CHECK (when_condition IN ('decreases_by_percent', 'increases_by_percent', 
                                 'decreases_by_abs', 'increases_by_abs', 
                                 'less_than_abs', 'more_than_abs')),
    when_value DECIMAL(10,2) NOT NULL,
    then_action VARCHAR(50) NOT NULL 
        CHECK (then_action IN ('reduce_price', 'increase_price', 'change_price')),
    then_mode VARCHAR(20) NOT NULL 
        CHECK (then_mode IN ('percentage', 'absolute')),
    then_value DECIMAL(10,2) NOT NULL,
    change_compare_at BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure rule belongs to either campaign or pricing job, not both
    CONSTRAINT pricing_rules_parent_check 
        CHECK ((campaign_id IS NOT NULL AND pricing_job_id IS NULL) OR 
               (campaign_id IS NULL AND pricing_job_id IS NOT NULL))
);

-- Manual pricing jobs table
CREATE TABLE pricing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL 
        CHECK (type IN ('manual_bulk', 'manual_rules', 'campaign_auto')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    bulk_amount DECIMAL(10,2), -- For bulk price changes
    bulk_type VARCHAR(20) CHECK (bulk_type IN ('increase', 'decrease')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    user_id VARCHAR(255) NOT NULL,
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE
);

-- Index for job history queries
CREATE INDEX idx_pricing_jobs_user_recent ON pricing_jobs (user_id, created_at DESC);

-- Selected variants for pricing jobs
CREATE TABLE selected_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_job_id UUID NOT NULL REFERENCES pricing_jobs(id) ON DELETE CASCADE,
    shopify_variant_id VARCHAR(255) NOT NULL,
    shopify_product_id VARCHAR(255) NOT NULL,
    title VARCHAR(500),
    current_price DECIMAL(10,2),
    inventory_quantity INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Processing results for individual variant operations
CREATE TABLE processing_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pricing_job_id UUID NOT NULL REFERENCES pricing_jobs(id) ON DELETE CASCADE,
    variant_id VARCHAR(255) NOT NULL,
    success BOOLEAN NOT NULL,
    old_price DECIMAL(10,2),
    new_price DECIMAL(10,2),
    product_title VARCHAR(500),
    variant_title VARCHAR(500),
    inventory INTEGER,
    error_message TEXT,
    reason TEXT,
    rule_applied TEXT,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    audit_trail_id UUID REFERENCES audit_trail_entries(id)
);

-- Index for result aggregation queries
CREATE INDEX idx_processing_results_job ON processing_results (pricing_job_id, success);

-- Comprehensive audit trail for compliance
CREATE TABLE audit_trail_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(20) NOT NULL 
        CHECK (entity_type IN ('variant', 'product')),
    entity_id VARCHAR(255) NOT NULL, -- Shopify GID
    change_type VARCHAR(30) NOT NULL 
        CHECK (change_type IN ('price_update', 'compare_at_update', 'inventory_sync', 'rollback')),
    old_value VARCHAR(100),
    new_value VARCHAR(100),
    trigger_reason TEXT NOT NULL,
    campaign_id UUID REFERENCES campaigns(id),
    pricing_job_id UUID REFERENCES pricing_jobs(id),
    user_id VARCHAR(255),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE,
    metadata JSONB -- Additional context data
);

-- Critical indexes for audit trail performance
CREATE INDEX idx_audit_trail_entity ON audit_trail_entries (entity_id, timestamp DESC);
CREATE INDEX idx_audit_trail_campaign ON audit_trail_entries (campaign_id, timestamp DESC);
CREATE INDEX idx_audit_trail_job ON audit_trail_entries (pricing_job_id, timestamp DESC);
CREATE INDEX idx_audit_trail_shop_time ON audit_trail_entries (shopify_shop_id, timestamp DESC);
CREATE INDEX idx_audit_trail_rollback ON audit_trail_entries (campaign_id, change_type) 
WHERE change_type != 'rollback'; -- For rollback operations

-- Webhook processing log for reliability
CREATE TABLE webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_type VARCHAR(50) NOT NULL,
    shopify_webhook_id VARCHAR(255),
    payload JSONB NOT NULL,
    signature_valid BOOLEAN NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processing_attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    shopify_shop_id UUID NOT NULL REFERENCES shopify_shops(id) ON DELETE CASCADE
);

-- Index for webhook processing queries
CREATE INDEX idx_webhook_logs_processing ON webhook_logs (processed, processing_attempts, received_at);
CREATE INDEX idx_webhook_logs_shop_recent ON webhook_logs (shopify_shop_id, received_at DESC);

-- Session storage (migrated from SQLite)
CREATE TABLE sessions (
    id VARCHAR(255) PRIMARY KEY,
    shop VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    is_online BOOLEAN NOT NULL DEFAULT false,
    scope VARCHAR(1000),
    expires TIMESTAMP WITH TIME ZONE,
    access_token VARCHAR(255) NOT NULL,
    user_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for session queries
CREATE INDEX idx_sessions_shop ON sessions (shop);

-- Performance optimization: Partitioning for audit trail by month
-- (Implementation note: Consider partitioning audit_trail_entries by timestamp 
-- for better performance with 2+ years of data retention)

-- Triggers for automatic updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_campaigns_updated_at 
    BEFORE UPDATE ON campaigns 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shopify_shops_updated_at 
    BEFORE UPDATE ON shopify_shops 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at 
    BEFORE UPDATE ON sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

## Frontend Architecture

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

## Backend Architecture

The backend architecture defines service organization, database access patterns, and authentication implementation optimized for your dedicated server infrastructure and Shopify app requirements.

### Service Architecture

Based on the self-hosted server choice, the architecture uses Remix server routes with supporting service classes rather than separate microservices.

#### Controller/Route Organization

```
app/routes/
├── api/                            # API routes for frontend consumption
│   ├── campaigns.tsx              # Campaign CRUD operations
│   ├── campaigns.$id.tsx          # Individual campaign management
│   ├── campaigns.$id.rollback.tsx # Campaign rollback operations
│   ├── pricing-jobs.tsx           # Manual pricing job operations
│   ├── pricing-jobs.$id.tsx       # Job details and results
│   ├── webhooks.inventory.tsx     # Shopify webhook processing
│   └── audit-trail.tsx            # Audit log queries
├── app/                           # User-facing pages
│   ├── _index.tsx                 # Dashboard
│   ├── pricing-job.tsx            # Manual pricing interface
│   ├── campaigns._index.tsx       # Campaign list
│   ├── campaigns.create.tsx       # Campaign creation
│   └── campaigns.$id.tsx          # Campaign monitoring
└── webhooks/                      # External webhook endpoints
    └── inventory.tsx              # Shopify inventory webhooks
```

#### Controller Template

```typescript
// app/routes/api/campaigns.tsx
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { json } from '@remix-run/node';
import { authenticate } from '~/shopify.server';
import { CampaignService } from '~/services/campaign-service.server';
import { AuditLogger } from '~/services/audit-logger.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  
  const campaignService = new CampaignService(session.shop);
  const campaigns = await campaignService.list({ status, limit });
  
  return json({ campaigns });
}

export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method === 'POST') {
    const data = await request.json();
    
    try {
      const campaignService = new CampaignService(session.shop);
      const auditLogger = new AuditLogger(session.shop);
      
      const campaign = await campaignService.create(data, session.user?.id);
      
      await auditLogger.log({
        entityType: 'campaign',
        entityId: campaign.id,
        changeType: 'created',
        triggerReason: 'Manual campaign creation',
        userId: session.user?.id,
        metadata: { campaignName: campaign.name }
      });
      
      return json({ campaign }, { status: 201 });
    } catch (error) {
      return json(
        { error: error.message }, 
        { status: 400 }
      );
    }
  }
  
  return json({ error: 'Method not allowed' }, { status: 405 });
}
```

### Database Architecture

#### Data Access Layer

```typescript
// app/models/campaign.server.ts
import { prisma } from '~/db.server';
import type { Campaign, CreateCampaignData } from '~/types/campaign';

export class CampaignRepository {
  constructor(private shopId: string) {}

  async findActive(): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: {
        shopifyShop: { shopDomain: this.shopId },
        status: 'active'
      },
      include: {
        rules: true
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async create(data: CreateCampaignData, userId: string): Promise<Campaign> {
    return prisma.campaign.create({
      data: {
        name: data.name,
        description: data.description,
        targetProducts: data.targetProducts,
        status: 'draft',
        userId,
        shopifyShop: {
          connect: { shopDomain: this.shopId }
        },
        rules: {
          create: data.rules.map(rule => ({
            whenCondition: rule.whenCondition,
            whenValue: rule.whenValue,
            thenAction: rule.thenAction,
            thenMode: rule.thenMode,
            thenValue: rule.thenValue,
            changeCompareAt: rule.changeCompareAt,
            description: rule.description
          }))
        }
      },
      include: {
        rules: true
      }
    });
  }

  async updateStatus(id: string, status: Campaign['status']): Promise<Campaign> {
    return prisma.campaign.update({
      where: { id },
      data: { 
        status,
        updatedAt: new Date(),
        ...(status === 'active' && { lastTriggered: null, triggerCount: 0 })
      },
      include: {
        rules: true
      }
    });
  }

  async incrementTriggerCount(id: string): Promise<void> {
    await prisma.campaign.update({
      where: { id },
      data: {
        triggerCount: { increment: 1 },
        lastTriggered: new Date()
      }
    });
  }
}

// app/services/campaign-service.server.ts
import { CampaignRepository } from '~/models/campaign.server';
import { AuditRepository } from '~/models/audit.server';
import type { Campaign, CreateCampaignData } from '~/types/campaign';

export class CampaignService {
  private campaignRepo: CampaignRepository;
  private auditRepo: AuditRepository;

  constructor(shopId: string) {
    this.campaignRepo = new CampaignRepository(shopId);
    this.auditRepo = new AuditRepository(shopId);
  }

  async list(filters: { status?: string; limit: number }): Promise<Campaign[]> {
    if (filters.status) {
      return this.campaignRepo.findByStatus(filters.status, filters.limit);
    }
    return this.campaignRepo.findAll(filters.limit);
  }

  async create(data: CreateCampaignData, userId: string): Promise<Campaign> {
    // Validate pricing rules
    this.validatePricingRules(data.rules);
    
    // Validate product targeting
    await this.validateTargetProducts(data.targetProducts);
    
    const campaign = await this.campaignRepo.create(data, userId);
    
    return campaign;
  }

  async rollback(campaignId: string, userId: string): Promise<{ jobId: string }> {
    // Get all audit entries for this campaign
    const auditEntries = await this.auditRepo.findByCampaign(campaignId);
    
    // Create rollback pricing job
    const rollbackJob = await this.createRollbackJob(auditEntries, userId);
    
    // Queue rollback processing
    await this.queueRollbackProcessing(rollbackJob.id);
    
    return { jobId: rollbackJob.id };
  }

  private validatePricingRules(rules: PricingRule[]): void {
    if (!rules.length) {
      throw new Error('At least one pricing rule is required');
    }

    for (const rule of rules) {
      if (parseFloat(rule.whenValue) < 0 || parseFloat(rule.thenValue) < 0) {
        throw new Error('Rule values must be positive numbers');
      }
      
      if (rule.thenMode === 'percentage' && parseFloat(rule.thenValue) > 100) {
        throw new Error('Percentage adjustments cannot exceed 100%');
      }
    }
  }
}
```

### Authentication and Authorization

#### Auth Flow

```mermaid
sequenceDiagram
    participant User as Store Owner
    participant App as Remix App
    participant Shopify as Shopify Auth
    participant DB as PostgreSQL
    
    User->>App: Access app URL
    App->>Shopify: Check session validity
    
    alt Valid session
        Shopify-->>App: Session data
        App->>DB: Store/update session
        App-->>User: Render app interface
    else Invalid/missing session
        App->>Shopify: Redirect to OAuth flow
        Shopify-->>User: OAuth consent screen
        User->>Shopify: Grant permissions
        Shopify->>App: OAuth callback with code
        App->>Shopify: Exchange code for tokens
        Shopify-->>App: Access token & session
        App->>DB: Store session data
        App-->>User: Render app interface
    end
```

#### Middleware/Guards

```typescript
// app/lib/auth.server.ts
import { authenticate } from '~/shopify.server';
import type { LoaderFunctionArgs, ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';

export async function requireAuth(request: Request) {
  try {
    const { admin, session } = await authenticate.admin(request);
    return { admin, session };
  } catch (error) {
    throw redirect('/auth/login');
  }
}

export async function requireActiveShop(request: Request) {
  const { session } = await requireAuth(request);
  
  if (!session.shop) {
    throw redirect('/auth/install');
  }
  
  return session;
}

// app/lib/permissions.server.ts
export class PermissionService {
  constructor(private session: SessionData) {}

  canManageCampaigns(): boolean {
    return this.hasScope('write_products') && this.hasScope('write_inventory');
  }

  canViewAuditTrail(): boolean {
    return this.hasScope('read_products');
  }

  canRollbackCampaign(): boolean {
    return this.canManageCampaigns() && this.isShopOwner();
  }

  private hasScope(scope: string): boolean {
    return this.session.scope?.includes(scope) || false;
  }

  private isShopOwner(): boolean {
    // Implementation depends on shop owner identification logic
    return this.session.user?.role === 'owner';
  }
}

// Usage in route
export async function loader({ request }: LoaderFunctionArgs) {
  const session = await requireActiveShop(request);
  const permissions = new PermissionService(session);
  
  if (!permissions.canViewAuditTrail()) {
    throw new Response('Forbidden', { status: 403 });
  }
  
  // Continue with route logic...
}
```

## Unified Project Structure

The monorepo structure accommodates both frontend and backend within the Remix framework, optimized for your self-hosted server deployment and Docker-based infrastructure management.

```
hc-pricing-auto/
├── .github/                        # CI/CD workflows
│   └── workflows/
│       ├── ci.yml                 # Test, lint, build pipeline
│       ├── deploy.yml             # Deploy to your server
│       └── backup.yml             # Database backup automation
├── app/                           # Main Remix application
│   ├── components/                # React components
│   │   ├── campaigns/             # Campaign-specific components
│   │   │   ├── CampaignForm.tsx
│   │   │   ├── CampaignDashboard.tsx
│   │   │   ├── RuleBuilder.tsx
│   │   │   └── CampaignHistory.tsx
│   │   ├── pricing-job/           # Manual pricing components
│   │   │   ├── VariantSelector.tsx
│   │   │   ├── RuleConfiguration.tsx
│   │   │   ├── ResultsTable.tsx
│   │   │   └── JobHistory.tsx
│   │   ├── shared/                # Cross-feature components
│   │   │   ├── Navigation.tsx
│   │   │   ├── AuditTrailViewer.tsx
│   │   │   └── ExportButton.tsx
│   │   └── ui/                    # Basic UI components
│   │       ├── Card.tsx
│   │       ├── DataTable.tsx
│   │       └── StatusBadge.tsx
│   ├── lib/                       # Shared utilities
│   │   ├── api-client.ts          # Frontend API client
│   │   ├── auth.server.ts         # Authentication helpers
│   │   ├── permissions.server.ts  # Permission management
│   │   ├── shopify-client.server.ts # Shopify API client
│   │   ├── redis.server.ts        # Redis connection
│   │   └── utils.ts               # General utilities
│   ├── models/                    # Data access layer
│   │   ├── campaign.server.ts     # Campaign repository
│   │   ├── pricing-job.server.ts  # Pricing job repository
│   │   ├── audit.server.ts        # Audit trail repository
│   │   └── session.server.ts      # Session management
│   ├── routes/                    # Remix file-based routing
│   │   ├── api/                   # API endpoints
│   │   │   ├── campaigns.tsx      # Campaign CRUD
│   │   │   ├── campaigns.$id.tsx  # Individual campaign ops
│   │   │   ├── pricing-jobs.tsx   # Manual pricing jobs
│   │   │   ├── audit-trail.tsx    # Audit log queries
│   │   │   └── health.tsx         # Health check endpoint
│   │   ├── app/                   # User-facing pages
│   │   │   ├── _index.tsx         # Dashboard
│   │   │   ├── pricing-job.tsx    # Manual pricing interface
│   │   │   ├── campaigns._index.tsx # Campaign list
│   │   │   ├── campaigns.create.tsx # Campaign creation
│   │   │   └── campaigns.$id.tsx  # Campaign monitoring
│   │   ├── webhooks/              # External webhook endpoints
│   │   │   └── inventory.tsx      # Shopify inventory webhooks
│   │   └── app.tsx                # Root layout with auth
│   ├── services/                  # Business logic
│   │   ├── campaign-service.server.ts    # Campaign management
│   │   ├── pricing-service.server.ts     # Pricing calculations
│   │   ├── webhook-service.server.ts     # Webhook processing
│   │   ├── audit-logger.server.ts       # Audit trail logging
│   │   └── background-jobs.server.ts    # Job queue processing
│   ├── types/                     # TypeScript type definitions
│   │   ├── campaign.ts            # Campaign-related types
│   │   ├── pricing-job.ts         # Pricing job types
│   │   ├── audit.ts               # Audit trail types
│   │   ├── shopify.ts             # Shopify API types
│   │   └── index.ts               # Type exports
│   ├── styles/                    # Global styles and themes
│   │   ├── globals.css            # Global CSS styles
│   │   └── polaris-overrides.css  # Polaris customizations
│   ├── entry.client.tsx           # Client-side entry point
│   ├── entry.server.tsx           # Server-side entry point
│   ├── root.tsx                   # Root component
│   ├── db.server.ts               # Prisma database client
│   └── shopify.server.ts          # Shopify app configuration
├── infrastructure/                # Infrastructure as Code
│   ├── docker/
│   │   ├── Dockerfile             # Application container
│   │   ├── nginx.conf             # Nginx reverse proxy config
│   │   └── docker-compose.yml     # Full stack orchestration
│   ├── scripts/
│   │   ├── deploy.sh              # Deployment script
│   │   ├── backup.sh              # Database backup script
│   │   ├── restore.sh             # Database restore script
│   │   └── health-check.sh        # System health monitoring
│   └── monitoring/
│       ├── prometheus.yml         # Metrics collection (optional)
│       └── grafana-dashboard.json # Monitoring dashboard (optional)
├── packages/                      # Shared packages (minimal for this project)
│   └── shared-types/              # Shared TypeScript definitions
│       ├── src/
│       │   ├── campaign.ts        # Shared campaign types
│       │   ├── api-responses.ts   # API response types
│       │   └── index.ts           # Type exports
│       ├── package.json
│       └── tsconfig.json
├── prisma/                        # Database schema and migrations
│   ├── migrations/                # Database migration files
│   ├── schema.prisma              # Database schema definition
│   └── seed.ts                    # Database seeding script
├── tests/                         # Test files
│   ├── __mocks__/                 # Test mocks
│   ├── e2e/                       # End-to-end tests
│   │   ├── campaign-creation.spec.ts
│   │   ├── pricing-job.spec.ts
│   │   └── webhook-processing.spec.ts
│   ├── integration/               # Integration tests
│   │   ├── api/                   # API endpoint tests
│   │   └── services/              # Service layer tests
│   ├── unit/                      # Unit tests
│   │   ├── components/            # Component tests
│   │   ├── services/              # Service tests
│   │   └── utils/                 # Utility function tests
│   ├── fixtures/                  # Test data
│   └── setup/                     # Test setup files
├── scripts/                       # Build and deployment scripts
│   ├── setup-dev.sh              # Development environment setup
│   ├── build.sh                  # Production build script
│   ├── migrate.sh                # Database migration runner
│   └── seed-dev-data.sh          # Development data seeding
├── docs/                         # Project documentation
│   ├── prd.md                    # Product Requirements Document
│   ├── architecture.md          # This architecture document
│   ├── api.md                   # API documentation
│   ├── deployment.md            # Deployment guide
│   └── development.md           # Development setup guide
├── public/                       # Static assets
│   ├── favicon.ico
│   ├── icons/                   # App icons
│   └── images/                  # Static images
├── .env.example                 # Environment variables template
├── .env.local                   # Local development environment
├── .gitignore                   # Git ignore rules
├── .eslintrc.js                # ESLint configuration
├── .prettierrc                 # Prettier configuration
├── docker-compose.yml          # Local development stack
├── docker-compose.prod.yml     # Production deployment stack
├── package.json                # Root package.json with scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite build configuration
├── vitest.config.ts           # Test configuration
├── shopify.app.toml           # Shopify app configuration
├── shopify.web.toml           # Shopify web configuration
└── README.md                  # Project documentation

# Key deployment files for your server
infrastructure/docker/docker-compose.yml        # Production stack
infrastructure/scripts/deploy.sh                # Automated deployment
.env.production                                  # Production environment variables
```

## Development Workflow

The development setup and workflow is optimized for your dedicated server environment with Docker-based local development matching production infrastructure.

### Local Development Setup

#### Prerequisites

```bash
# Required software for development
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
npm install -g @shopify/cli @shopify/theme
```

#### Initial Setup

```bash
# Clone and setup project
git clone <repository-url> hc-pricing-auto
cd hc-pricing-auto

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your Shopify app credentials

# Start development services
docker-compose up -d postgres redis

# Setup database
npm run db:migrate
npm run db:seed

# Start development server
npm run dev
```

#### Development Commands

```bash
# Start all services (app + database)
npm run dev:full

# Start frontend only (assumes services running)
npm run dev

# Start backend only for API testing
npm run dev:api

# Run tests
npm run test          # Unit tests
npm run test:e2e      # End-to-end tests
npm run test:ci       # All tests for CI

# Database operations
npm run db:migrate    # Run migrations
npm run db:reset      # Reset database
npm run db:studio     # Open Prisma Studio
npm run db:backup     # Create local backup

# Code quality
npm run lint          # ESLint
npm run typecheck     # TypeScript checking
npm run format        # Prettier formatting
```

### Environment Configuration

#### Required Environment Variables

```bash
# Frontend (.env.local)
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SCOPES=read_products,write_products,read_inventory,write_inventory
HOST=http://localhost:3000

# Backend (.env)
DATABASE_URL=postgresql://username:password@localhost:5432/hc_pricing_auto
REDIS_URL=redis://localhost:6379
SESSION_SECRET=your_session_secret_key
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret

# Shared
NODE_ENV=development
LOG_LEVEL=debug
ENABLE_AUDIT_LOGGING=true
```

## Deployment Architecture

The deployment strategy leverages your dedicated server infrastructure with Docker containerization, automated CI/CD pipelines, and zero-downtime deployment capabilities.

### Deployment Strategy

**Frontend Deployment:**
- **Platform:** Your dedicated server with Nginx reverse proxy
- **Build Command:** `npm run build`
- **Output Directory:** `build/client` (static assets served by Nginx)
- **CDN/Edge:** Nginx with gzip compression and static asset caching

**Backend Deployment:**
- **Platform:** Docker containers on your dedicated server
- **Build Command:** `npm run build && npm run build:server`
- **Deployment Method:** Docker Compose with rolling updates
- **Process Management:** Docker containers with automatic restart policies

### CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [ main ]
  workflow_dispatch:

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: |
          npm run typecheck
          npm run lint
          npm run test
          npm run test:e2e
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/test
          REDIS_URL: redis://localhost:6379

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
      
      - name: Build Docker image
        run: |
          docker build -t hc-pricing-auto:${{ github.sha }} .
          docker save hc-pricing-auto:${{ github.sha }} > app-image.tar
      
      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: docker-image
          path: app-image.tar

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Download build artifact
        uses: actions/download-artifact@v4
        with:
          name: docker-image
      
      - name: Deploy to server
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            # Stop existing containers
            cd /opt/hc-pricing-auto
            docker-compose down --remove-orphans
            
            # Load new image
            docker load < /tmp/app-image.tar
            docker tag hc-pricing-auto:${{ github.sha }} hc-pricing-auto:latest
            
            # Run database migrations
            docker run --rm --network host \
              -e DATABASE_URL=${{ secrets.DATABASE_URL }} \
              hc-pricing-auto:latest npm run db:migrate:deploy
            
            # Start new containers
            docker-compose up -d
            
            # Health check
            sleep 30
            curl -f http://localhost/api/health || exit 1
            
            # Cleanup old images
            docker image prune -f
      
      - name: Deploy notification
        if: always()
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

### Environments

| Environment | Frontend URL | Backend URL | Purpose |
|-------------|--------------|-------------|---------|
| Development | http://localhost:3000 | http://localhost:3000/api | Local development and testing |
| Staging | https://staging.your-domain.com | https://staging.your-domain.com/api | Pre-production testing and QA |
| Production | https://your-domain.com | https://your-domain.com/api | Live merchant-facing environment |

## Security and Performance

The security and performance strategy addresses both frontend user experience and backend reliability requirements, optimized for your dedicated server infrastructure and Shopify app compliance.

### Security Requirements

**Frontend Security:**
- CSP Headers: `default-src 'self' *.shopifycdn.com *.shopify.com; script-src 'self' 'unsafe-inline' *.shopify.com; style-src 'self' 'unsafe-inline' *.shopifycdn.com`
- XSS Prevention: React's built-in XSS protection + input sanitization for all user content
- Secure Storage: Shopify session tokens in httpOnly cookies, no sensitive data in localStorage

**Backend Security:**
- Input Validation: Joi schema validation for all API endpoints with strict type checking
- Rate Limiting: 100 requests/minute per IP for API endpoints, 10 requests/minute for webhook processing
- CORS Policy: `https://*.shopify.com, https://admin.shopify.com` with credentials support

**Authentication Security:**
- Token Storage: Shopify session tokens in httpOnly, secure cookies with SameSite=Strict
- Session Management: PostgreSQL-backed sessions with 24-hour expiration and refresh rotation
- Password Policy: N/A - Shopify OAuth only, no password management required

### Performance Optimization

**Frontend Performance:**
- Bundle Size Target: < 500KB initial JavaScript bundle with code splitting
- Loading Strategy: Route-based code splitting with preload hints for critical routes
- Caching Strategy: Service worker for static assets, stale-while-revalidate for API data

**Backend Performance:**
- Response Time Target: < 200ms for API endpoints, < 60 seconds for webhook processing
- Database Optimization: Connection pooling (max 20 connections), query result caching for 5 minutes
- Caching Strategy: Redis caching for campaign rules, product data cache with 1-hour TTL

## Testing Strategy

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

## Coding Standards

These minimal but critical standards prevent common mistakes and ensure consistency for AI agents working on the fullstack pricing automation platform.

### Critical Fullstack Rules

- **Type Sharing:** Always define types in `app/types/` and import from there - never duplicate type definitions between frontend and backend
- **API Calls:** Never make direct HTTP calls from components - always use the service layer in `app/services/`
- **Environment Variables:** Access only through config objects in `app/lib/config.server.ts`, never `process.env` directly
- **Error Handling:** All API routes must use the standard error handler from `app/lib/error-handler.server.ts`
- **State Updates:** Never mutate campaign or pricing job state directly - use proper Remix form submissions and loaders
- **Database Access:** Always use repository pattern from `app/models/` - never call Prisma directly from routes
- **Shopify GraphQL:** Use embedded template literals with `#graphql` comment for syntax highlighting
- **Audit Logging:** Every price change must create an audit trail entry - no exceptions
- **Webhook Validation:** All webhook payloads must verify HMAC signature before processing
- **Session Management:** Use Shopify session helpers only - never implement custom session logic

### Naming Conventions

| Element | Frontend | Backend | Example |
|---------|----------|---------|---------|
| Components | PascalCase | - | `CampaignDashboard.tsx` |
| Hooks | camelCase with 'use' | - | `useCampaignStatus.ts` |
| API Routes | - | kebab-case | `/api/pricing-jobs` |
| Database Tables | - | snake_case | `audit_trail_entries` |
| Services | - | PascalCase | `CampaignService` |
| Types/Interfaces | PascalCase | PascalCase | `Campaign`, `PricingRule` |
| Constants | UPPER_SNAKE_CASE | UPPER_SNAKE_CASE | `BATCH_SIZE`, `API_RETRY_LIMIT` |

## Error Handling Strategy

The unified error handling strategy ensures consistent error management across frontend components and backend services, with specific focus on Shopify API integration and campaign processing reliability.

### Error Flow

```mermaid
sequenceDiagram
    participant Frontend as Remix Frontend
    participant API as API Route
    participant Service as Service Layer
    participant Shopify as Shopify API
    participant DB as PostgreSQL
    participant User as Store Owner

    Frontend->>API: Campaign creation request
    API->>Service: Process campaign data
    
    alt Validation Error
        Service-->>API: ValidationError
        API-->>Frontend: 400 + error details
        Frontend->>User: Form validation messages
    else Shopify API Error
        Service->>Shopify: Create webhook subscription
        Shopify-->>Service: API rate limit error
        Service->>Service: Log error + retry logic
        Service-->>API: RetryableError
        API-->>Frontend: 503 + retry message
        Frontend->>User: "System busy, please retry"
    else Database Error
        Service->>DB: Save campaign
        DB-->>Service: Connection timeout
        Service->>Service: Log error details
        Service-->>API: DatabaseError
        API-->>Frontend: 500 + generic message
        Frontend->>User: "System error, support notified"
    else Success
        Service->>DB: Save successful
        Service->>Shopify: Webhook registered
        Service-->>API: Campaign created
        API-->>Frontend: 201 + campaign data
        Frontend->>User: "Campaign created successfully"
    end
```

### Error Response Format

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### Frontend Error Handling

```typescript
// app/lib/error-handler.client.ts
import { toast } from '@shopify/polaris';

export class FrontendErrorHandler {
  static handle(error: ApiError, context?: string): void {
    const { code, message } = error.error;
    
    switch (code) {
      case 'VALIDATION_ERROR':
        // Handle form validation errors
        this.handleValidationError(error, context);
        break;
      
      case 'SHOPIFY_API_ERROR':
        // Handle Shopify API issues
        this.handleShopifyError(error);
        break;
      
      case 'RATE_LIMIT_ERROR':
        // Handle rate limiting
        this.handleRateLimitError(error);
        break;
      
      case 'WEBHOOK_ERROR':
        // Handle webhook processing issues
        this.handleWebhookError(error);
        break;
      
      default:
        // Generic error handling
        this.handleGenericError(error);
    }
    
    // Log error for debugging
    console.error(`[${context || 'Unknown'}] Error:`, error);
  }
  
  private static handleValidationError(error: ApiError, context?: string): void {
    // Display specific validation messages
    if (context === 'campaign-form') {
      // Form-specific error handling
      const details = error.error.details || {};
      Object.entries(details).forEach(([field, message]) => {
        toast.error(`${field}: ${message}`);
      });
    } else {
      toast.error(error.error.message);
    }
  }
  
  private static handleShopifyError(error: ApiError): void {
    const message = 'Unable to connect to Shopify. Please check your permissions and try again.';
    toast.error(message);
    
    // Suggest specific actions based on error details
    if (error.error.details?.missingScopes) {
      toast.error('Additional permissions required. Please reinstall the app.');
    }
  }
  
  private static handleRateLimitError(error: ApiError): void {
    toast.error('System is busy processing requests. Please wait a moment and try again.');
    
    // Implement exponential backoff for retries
    const retryAfter = error.error.details?.retryAfter || 5000;
    setTimeout(() => {
      toast.success('You can try your request again now.');
    }, retryAfter);
  }
  
  private static handleWebhookError(error: ApiError): void {
    toast.error('Campaign automation temporarily unavailable. Manual pricing still works.');
    
    // Provide fallback options
    const fallbackMessage = 'You can still create manual pricing jobs while we resolve this issue.';
    toast.success(fallbackMessage);
  }
  
  private static handleGenericError(error: ApiError): void {
    toast.error('An unexpected error occurred. Our team has been notified.');
    
    // Provide helpful context
    if (error.error.requestId) {
      toast.success(`Reference ID: ${error.error.requestId} for support inquiries.`);
    }
  }
}

// Usage in components
export function useCampaignForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const handleSubmit = async (data: CampaignFormData) => {
    try {
      const campaign = await apiClient.campaigns.create(data);
      toast.success('Campaign created successfully!');
      return campaign;
    } catch (error) {
      FrontendErrorHandler.handle(error as ApiError, 'campaign-form');
      
      // Set form-specific errors
      if (error.error.code === 'VALIDATION_ERROR') {
        setErrors(error.error.details || {});
      }
    }
  };
  
  return { handleSubmit, errors };
}
```

### Backend Error Handling

```typescript
// app/lib/error-handler.server.ts
import { json } from '@remix-run/node';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.server';

export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SHOPIFY_API_ERROR = 'SHOPIFY_API_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  WEBHOOK_ERROR = 'WEBHOOK_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BackendErrorHandler {
  static handle(error: unknown, context?: string): Response {
    const requestId = uuidv4();
    
    // Log error with context
    logger.error('Request error', {
      requestId,
      context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    });
    
    if (error instanceof AppError) {
      return this.handleAppError(error, requestId);
    }
    
    if (error instanceof Error) {
      return this.handleUnknownError(error, requestId);
    }
    
    return this.handleGenericError(requestId);
  }
  
  private static handleAppError(error: AppError, requestId: string): Response {
    const errorResponse = {
      error: {
        code: error.code,
        message: this.getPublicMessage(error),
        details: error.details,
        timestamp: new Date().toISOString(),
        requestId
      }
    };
    
    return json(errorResponse, { status: error.statusCode });
  }
  
  private static handleUnknownError(error: Error, requestId: string): Response {
    // Don't expose internal error details to client
    const errorResponse = {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An internal error occurred. Please try again later.',
        timestamp: new Date().toISOString(),
        requestId
      }
    };
    
    return json(errorResponse, { status: 500 });
  }
  
  private static handleGenericError(requestId: string): Response {
    const errorResponse = {
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
        timestamp: new Date().toISOString(),
        requestId
      }
    };
    
    return json(errorResponse, { status: 500 });
  }
  
  private static getPublicMessage(error: AppError): string {
    // Return user-friendly messages
    switch (error.code) {
      case ErrorCode.VALIDATION_ERROR:
        return error.message; // Validation messages are safe to expose
      case ErrorCode.SHOPIFY_API_ERROR:
        return 'Unable to connect to Shopify. Please check your permissions.';
      case ErrorCode.RATE_LIMIT_ERROR:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorCode.WEBHOOK_ERROR:
        return 'Webhook processing failed. Campaign automation may be delayed.';
      case ErrorCode.UNAUTHORIZED:
        return 'Authentication required. Please log in again.';
      case ErrorCode.FORBIDDEN:
        return 'You do not have permission to perform this action.';
      case ErrorCode.NOT_FOUND:
        return 'The requested resource was not found.';
      default:
        return 'An error occurred. Please try again later.';
    }
  }
}

// Usage in routes
export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await authenticate.admin(request);
    const data = await request.json();
    
    const campaignService = new CampaignService(session.shop);
    const campaign = await campaignService.create(data, session.user?.id);
    
    return json({ campaign }, { status: 201 });
  } catch (error) {
    return BackendErrorHandler.handle(error, 'create-campaign');
  }
}

// Service layer error throwing
export class CampaignService {
  async create(data: CreateCampaignData, userId: string): Promise<Campaign> {
    // Validation
    if (!data.name || data.name.trim().length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'Campaign name is required',
        400,
        { field: 'name', message: 'Campaign name cannot be empty' }
      );
    }
    
    if (!data.rules || data.rules.length === 0) {
      throw new AppError(
        ErrorCode.VALIDATION_ERROR,
        'At least one pricing rule is required',
        400,
        { field: 'rules', message: 'Campaign must have at least one pricing rule' }
      );
    }
    
    try {
      // Database operation
      const campaign = await this.campaignRepo.create(data, userId);
      
      // Shopify webhook registration
      await this.registerWebhooks(campaign.id, data.targetProducts);
      
      return campaign;
    } catch (error) {
      if (error.code === 'P2002') { // Prisma unique constraint
        throw new AppError(
          ErrorCode.VALIDATION_ERROR,
          'A campaign with this name already exists',
          400,
          { field: 'name', message: 'Campaign name must be unique' }
        );
      }
      
      if (error.message?.includes('rate limit')) {
        throw new AppError(
          ErrorCode.RATE_LIMIT_ERROR,
          'API rate limit exceeded',
          503,
          { retryAfter: 5000 }
        );
      }
      
      // Database connection errors
      if (error.code === 'ECONNREFUSED') {
        throw new AppError(
          ErrorCode.DATABASE_ERROR,
          'Database connection failed',
          503
        );
      }
      
      // Re-throw unknown errors to be handled by global handler
      throw error;
    }
  }
}
```

## Monitoring and Observability

The monitoring strategy provides comprehensive visibility into campaign automation performance, webhook processing reliability, and system health on your dedicated server infrastructure.

### Monitoring Stack

- **Frontend Monitoring:** Browser performance metrics via Web Vitals API + custom dashboard analytics
- **Backend Monitoring:** Winston structured logging + PostgreSQL metrics logging + Node.js performance monitoring
- **Error Tracking:** Custom error aggregation in PostgreSQL + email/Slack alerting for critical issues
- **Performance Monitoring:** Application response times + database query performance + Redis queue metrics

### Key Metrics

**Frontend Metrics:**
- Core Web Vitals (LCP, FID, CLS) for Shopify admin embedding performance
- JavaScript errors and unhandled promise rejections
- API response times from frontend perspective
- User interactions (campaign creations, pricing job submissions)

**Backend Metrics:**
- Request rate and response time distribution (95th percentile target: <200ms)
- Error rate by endpoint and error type (target: <1% error rate)
- Database query performance (slow query threshold: >100ms)
- Webhook processing time (target: <60 seconds end-to-end)

**Business Metrics:**
- Campaign execution success rate
- Pricing job completion rate
- Webhook processing success rate
- Audit trail completeness

**System Metrics:**
- Server resource utilization (CPU, memory, disk) on your 16GB server
- PostgreSQL connection pool usage
- Redis memory usage and queue lengths
- Docker container health and restart frequency

---

This comprehensive fullstack architecture document provides the complete technical foundation for transforming your Shopify pricing app into a sophisticated campaign automation platform. The architecture is specifically optimized for AI-driven development while leveraging your dedicated server infrastructure for maximum control and cost efficiency.

Ready for implementation! 🚀