# Coding Standards

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
