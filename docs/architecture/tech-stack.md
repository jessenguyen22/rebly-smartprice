# Tech Stack

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
