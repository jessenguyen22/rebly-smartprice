# hc-pricing-auto Brownfield Architecture Document

## Introduction

This document captures the **CURRENT STATE** of the hc-pricing-auto Shopify app codebase, including technical debt, workarounds, and real-world patterns. It serves as a reference for AI agents working on enhancements to this bulk variant pricing application.

### Document Scope

Comprehensive documentation of the entire Shopify app system, with focus on the actual pricing automation functionality implemented in the `app.admin.tsx` route.

### Change Log

| Date       | Version | Description                 | Author     |
| ---------- | ------- | --------------------------- | ---------- |
| 2025-08-22 | 1.0     | Initial brownfield analysis | Winston AI |

## Quick Reference - Key Files and Entry Points

### Critical Files for Understanding the System

- **Main Pricing Logic**: `app/routes/app.admin.tsx` - Core bulk pricing functionality with inventory rules
- **App Configuration**: `app/shopify.server.ts` - Shopify app setup and authentication
- **Database Schema**: `prisma/schema.prisma` - Session storage (SQLite)
- **App Config**: `shopify.app.toml` - Shopify app manifest and scopes
- **Default Template**: `app/routes/app._index.tsx` - **WARNING: Still contains demo code, not actual app**
- **Build Config**: `vite.config.ts`, `package.json` - Remix/Vite build setup

### Business Logic Locations

- **Resource Picker Integration**: `app.admin.tsx:585-646` - Shopify product/variant selection
- **Bulk Price Updates**: `app.admin.tsx:298-459` - Simple $10 price increase logic
- **Inventory-Based Rules**: `app.admin.tsx:28-296` - Complex conditional pricing engine
- **GraphQL Queries**: Embedded in action functions, no separate query files

## High Level Architecture

### Technical Summary

**REALITY CHECK**: This is a **single-page Shopify app** with two primary functions:
1. Simple bulk price increases ($10 to all selected variants)
2. Advanced inventory-based conditional pricing rules

The app is **NOT** a complex multi-page application despite the Remix framework setup.

### Actual Tech Stack (from package.json)

| Category          | Technology                      | Version | Notes                                    |
| ----------------- | ------------------------------- | ------- | ---------------------------------------- |
| Runtime           | Node.js                         | 18.20+  | Multi-version support (18/20/21+)       |
| Framework         | Remix                           | 2.16.1  | Full-stack React framework               |
| UI Framework      | React                           | 18.2.0  | Standard React setup                     |
| Shopify SDK       | @shopify/shopify-app-remix      | 3.7.0   | Official Shopify app framework          |
| Design System     | @shopify/polaris                | 12.0.0  | **CONSTRAINT**: Limited to v12 on Node 18 |
| Database ORM      | Prisma                          | 6.2.1   | SQLite for session storage only         |
| App Bridge        | @shopify/app-bridge-react       | 4.1.6   | Embedded app interface                   |
| Build Tool        | Vite                            | 6.2.2   | **PINNED**: Specific version in overrides |
| TypeScript        | TypeScript                      | 5.2.2   | Type safety                             |
| Session Storage   | PrismaSessionStorage            | 6.0.0   | Built-in session management             |

### Repository Structure Reality Check

- **Type**: Single-repo Shopify app
- **Package Manager**: npm (package-lock.json present)
- **Extensions Support**: Workspace configured for `extensions/*` but unused
- **Notable**: Template includes extensions setup but no actual extensions implemented

## Source Tree and Module Organization

### Project Structure (Actual)

```text
hc-pricing-auto/
├── app/                          # Remix application code
│   ├── routes/
│   │   ├── app.admin.tsx         # 🔥 MAIN APP - Bulk pricing functionality
│   │   ├── app._index.tsx        # ⚠️  DEMO CODE - Template leftover, NOT used
│   │   ├── app.additional.tsx    # Template example page
│   │   ├── app.tsx               # App layout wrapper
│   │   ├── auth.*.tsx            # Authentication flows
│   │   └── webhooks.*.tsx        # Webhook handlers
│   ├── shopify.server.ts         # Shopify app configuration
│   ├── db.server.ts              # Prisma database client
│   └── root.tsx                  # Remix root component
├── prisma/
│   ├── schema.prisma             # Session storage schema (SQLite)
│   ├── dev.sqlite                # Local development database
│   └── migrations/               # Prisma migration files
├── docs/
│   └── shopify-bulk-price-app-summary.md  # Comprehensive feature documentation
├── extensions/                   # Empty - no app extensions implemented
├── shopify.app.toml              # Shopify app configuration
├── package.json                  # Dependencies and scripts
└── vite.config.ts                # Build configuration
```

### Key Modules and Their Purpose

- **`app.admin.tsx`**: **THE ACTUAL APP** - Contains all pricing functionality, resource picker, inventory rules
- **`app._index.tsx`**: **INACTIVE DEMO CODE** - Default Remix template for product creation (not used in production)
- **`shopify.server.ts`**: Shopify authentication, GraphQL client setup, session management
- **`db.server.ts`**: Simple Prisma client export for session storage
- **Prisma Schema**: Only stores Shopify sessions, no application data persistence

## Data Models and APIs

### Data Models

**IMPORTANT**: This app does **NOT** store application data. It only uses Shopify's GraphQL API.

#### Session Storage (Prisma)
- **Session Model**: See `prisma/schema.prisma` - Standard Shopify app session fields
- **Storage**: Local SQLite file (`dev.sqlite`) - **PRODUCTION CONCERN**: Single-file database

#### Shopify Data Access
- **Product Variants**: Accessed via Shopify Admin GraphQL API
- **Inventory Data**: Uses `productVariant.inventoryQuantity` and `inventoryItem.tracked`
- **Pricing Updates**: Via `productVariantsBulkUpdate` mutation

### API Specifications

#### GraphQL Queries Used

**Inventory Query** (`app.admin.tsx:125-148`):
```graphql
query getVariantWithInventory($id: ID!) {
  productVariant(id: $id) {
    id
    price
    title
    inventoryQuantity      # ✅ RELIABLE - Direct field
    inventoryPolicy
    product { id title }
    inventoryItem {
      id
      tracked              # ✅ RELIABLE - Boolean tracking status
    }
  }
}
```

**Price Update Mutation** (`app.admin.tsx:202-226`):
```graphql
mutation updateVariantPrice($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
  productVariantsBulkUpdate(productId: $productId, variants: $variants) {
    productVariants { id price title }
    userErrors { field message }
  }
}
```

#### Resource Picker Integration
- **Type**: `shopify.resourcePicker({ type: "product", multiple: true })`
- **Selection Logic**: Handles both full products and individual variants
- **Deduplication**: Client-side variant ID deduplication

## Technical Debt and Known Issues

### Critical Technical Debt

1. **Unused Template Code**: `app._index.tsx` contains full demo product creation functionality that confuses the app purpose
2. **Mixed Route Functionality**: Actual app functionality buried in `/app/admin` route while index route shows unrelated demo
3. **No Data Persistence**: All selections are ephemeral - no way to save or schedule pricing rules
4. **Single Route Architecture**: All pricing logic concentrated in one 1000+ line file
5. **No Test Coverage**: No test files found in codebase

### Workarounds and Gotchas

- **Inventory Field Selection**: Must use `inventoryQuantity` field - **NEVER** use `inventoryLevels.edges.node.available` (doesn't exist)
- **Resource Picker Complexity**: Handles both product-level and variant-level selections in same callback
- **Batch Processing**: Hardcoded batch size of 5 variants to avoid API limits
- **Error Categorization**: Manual distinction between "skipped" (intentional) vs "failed" (errors) in UI
- **SQLite in Production**: Single-file database not suitable for multi-instance deployment

## Integration Points and External Dependencies

### External Services

| Service      | Purpose           | Integration Type | Key Files                 |
| ------------ | ----------------- | ---------------- | ------------------------- |
| Shopify API  | Product/Inventory | GraphQL Admin    | `app.admin.tsx` embedded  |
| Shopify Auth | Authentication    | OAuth 2.0        | `shopify.server.ts`       |

### Internal Integration Points

- **App Bridge**: Embedded in Shopify Admin via `@shopify/app-bridge-react`
- **Resource Picker**: Native Shopify product/variant selection interface
- **Toast Notifications**: Shopify App Bridge toast system for user feedback
- **Session Management**: Prisma-based session storage for OAuth tokens

## Development and Deployment

### Local Development Setup

**Working Commands**:
```bash
npm install           # Install dependencies
npm run dev          # Start development server (shopify app dev)
npm run build        # Production build
npm run setup        # Run Prisma migrations and generate client
```

**Environment Requirements**:
- Node.js 18.20+ (or 20.10+, or 21+)
- Shopify Partner account with app configured
- Development store for testing

### Build and Deployment Process

- **Build Command**: `npm run build` (Remix Vite build)
- **Development**: Shopify CLI with Cloudflare tunnel
- **Database Migrations**: `npx prisma migrate deploy`
- **Production Readiness**: **CONCERN** - SQLite not production-suitable for scaling

### Shopify App Configuration

**App Scopes** (`shopify.app.toml`):
- `write_products` - Required for bulk price updates

**Webhooks**:
- `app/uninstalled` - Cleanup when app is removed
- `app/scopes_update` - Handle permission changes

## Actual Application Flow

### User Journey (Real Implementation)

1. **Navigate to Admin Route**: User goes to `/app/admin` (not index route)
2. **Configure Rules** (Optional): Set inventory-based conditional pricing rules
3. **Select Products/Variants**: Use Shopify Resource Picker to select items
4. **Choose Action**:
   - **Simple**: Apply $10 increase to all selected variants
   - **Advanced**: Apply configured inventory rules
5. **View Results**: See detailed success/skip/failure results in table format

### Key Business Logic

**Simple Bulk Update**:
- Fetches current price for each variant
- Adds $10 to current price
- Updates via `productVariantsBulkUpdate`

**Inventory Rules Engine**:
- Evaluates WHEN conditions (inventory thresholds)
- Applies THEN actions (price changes)
- Supports multiple rule types and calculation modes
- Respects inventory tracking status

## Troubleshooting and Known Limitations

### Common Issues

1. **"No variants found"**: Resource picker requires selecting products with variant data loaded
2. **Inventory not tracked**: Variants with untracked inventory are skipped with clear reason
3. **Demo confusion**: Index route shows unrelated product creation demo

### Performance Characteristics

- **Batch Processing**: 5 variants per batch to respect API limits
- **Sequential Processing**: Variants processed one-by-one within batches
- **No Caching**: All data fetched fresh from Shopify on each operation

### Security Notes

- **Scopes**: Requires `write_products` for price updates
- **Session Management**: Standard Shopify OAuth with Prisma storage
- **No Data Persistence**: App doesn't store merchant data beyond sessions

## Navigation for AI Agents

### Most Important Files to Understand

1. **`app/routes/app.admin.tsx`** - Start here for all pricing functionality
2. **`docs/shopify-bulk-price-app-summary.md`** - Business context and feature evolution
3. **`shopify.app.toml`** - App permissions and configuration
4. **`package.json`** - Dependencies and available commands

### Files to IGNORE

- **`app/routes/app._index.tsx`** - Demo code, not actual app functionality
- **`app/routes/app.additional.tsx`** - Template example page

### When Making Changes

- **Pricing Logic**: Modify `app.admin.tsx` 
- **GraphQL Changes**: Update embedded queries in action functions
- **UI Changes**: Use Polaris components, follow existing patterns
- **New Features**: Consider breaking out of single-file architecture
- **Database**: Remember this app doesn't store application data

---

**This document reflects the ACTUAL state of the system as of August 2025, including technical debt and constraints that must be respected when making enhancements.**