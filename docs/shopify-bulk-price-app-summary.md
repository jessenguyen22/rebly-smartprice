# Shopify App: Bulk Variant Price Adjustment

**Date:** 2025-08-21  
**Author:** Jesse Nguyen  
**Context:** This document outlines the development steps and decisions made to implement a Shopify App that allows bulk price adjustments for product variants. This is used to provide full context for any AI agent participating in future development.

---

## ✅ Goal

To build a Shopify app that allows store owners to **bulk update product variant prices** with the flexibility to:
- Select one or multiple **products** or **variants**
- Automatically apply a \$10 price increase
- Show clear UI feedback and handle errors gracefully

---

## 🧱 Phase 1: Scaffold App

- Used `shopify app init` with the Remix template
- Verified successful development store connection and local dev server
- Implemented initial page structure using Polaris UI and Remix loaders

---

## 🔘 Phase 2: Manual Variant Price Update (Hardcoded)

- Added a single button to increase a hardcoded variant's price by \$10
- Called Shopify Admin GraphQL API using `productVariantUpdate`
- Displayed success or error banner in UI

### Tech Highlights:
- Used `admin.graphql(...)` via authenticated session
- Hardcoded variant ID: `gid://shopify/ProductVariant/XXXXXX`

---

## 🛒 Phase 3: Selectable Product/Variant via Resource Picker

- Integrated **Shopify's new Resource Picker API** using `shopify.resourcePicker()`
- Allowed single product selection and retrieved its **first variant**
- Submitted variant ID via `fetcher.submit()` to update price

### Improvements:
- Picker replaced hardcoded variant logic
- Displayed product and variant name in UI before applying change

---

## 📦 Phase 4: Bulk Selection & Multi-Variant Support

- Upgraded picker to allow **multiple product** selections
- Extracted **all variants** from each selected product
- Supported hybrid behavior: select entire products OR specific variants

### Logic Flow:
1. User selects multiple products (and optionally variants within them)
2. App flattens all variants into unique list
3. Sent to server for bulk processing (batched in groups of 5)
4. Each variant:
    - Price fetched
    - \$10 added
    - Updated via `productVariantsBulkUpdate`

### UX:
- Success and error banners displayed per batch
- IndexTable used to show selected variants and update results

---

## 📊 Phase 5: Inventory-Based Pricing Rules

**Date:** 2025-08-21  
**Implementation:** Added conditional pricing based on inventory levels

### Feature Overview:
- Added **"Apply Inventory Rules"** button alongside existing bulk update
- Implements rule: **Increase price by $10 if inventory < 20 units**
- Skips variants with sufficient inventory (≥ 20) or untracked inventory
- Displays detailed results with inventory quantities and skip reasons

### Technical Implementation:

#### Frontend Changes:
- Added `currentAction` state to differentiate between "bulk_update" and "inventory_rules"
- Separate loading states for each button to prevent UI conflicts
- Enhanced results table with inventory column for inventory rules
- Updated banners to distinguish between actual errors and intentional skips

#### Backend Logic:
```javascript
// GraphQL Query Structure (WORKING):
query getVariantWithInventory($id: ID!) {
  productVariant(id: $id) {
    inventoryQuantity      // Direct quantity field
    inventoryPolicy
    inventoryItem {
      tracked              // Whether tracking is enabled
    }
  }
}
```

#### Critical GraphQL Fixes:
❌ **AVOID**: `inventoryLevels.edges.node.available` - Field doesn't exist  
❌ **AVOID**: `quantities(names: ["available"])` - Complex nested structure  
✅ **USE**: `inventoryQuantity` - Simple, reliable field  
✅ **USE**: `inventoryItem.tracked` - Boolean for tracking status  

### Logic Flow:
1. Fetch variant details including `inventoryQuantity` and `tracked` status
2. Apply rule only if: `inventory < 20 AND tracking enabled`
3. Return detailed results with:
   - `success`: true/false for updates
   - `reason`: explanation for skips ("Inventory sufficient" vs "Not tracked")
   - `inventory`: actual quantity for display

### Result Categorization:
- **Updated**: Successfully increased price (inventory < 20)
- **Skipped**: Intentionally not updated (inventory ≥ 20 or not tracked)
- **Failed**: Actual errors during processing

### UX Improvements:
- Success banner shows both updated and skipped counts
- Error banner only shows actual failures (not skips)
- Results table displays inventory quantities and clear status badges
- Color-coded badges: Green (Updated), Orange (Skipped), Red (Failed)

---

## 🧠 Notes for Agent Usage

This app already handles the following:
- Flexible Resource Picker (no need for dropdown between product/variant)
- De-duplicated variant IDs
- GraphQL API mutation batching
- Dynamic success/failure banners
- Toast & inline feedback
- **Inventory-based conditional pricing with proper error handling**

### GraphQL Inventory Best Practices:
- Always use `productVariant.inventoryQuantity` for reliable inventory data
- Check `inventoryItem.tracked` to verify tracking is enabled
- Never use `inventoryLevels.edges.node.available` - this field doesn't exist
- Handle cases where inventory is null (not tracked) vs 0 (tracked but empty)

Agents continuing this project should:
- Avoid reintroducing separate "Select Product vs Variant" modes
- Assume `shopify.resourcePicker({ type: 'product', multiple: true })` as the base interaction
- Expect variant data to be nested inside each selected product object
- **Use simple GraphQL fields for inventory rather than complex nested queries**
- **Distinguish between intentional skips and actual errors in UI feedback**
