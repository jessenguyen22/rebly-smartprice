# External APIs

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
