# Unified Project Structure

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
