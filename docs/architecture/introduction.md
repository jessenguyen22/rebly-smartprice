# Introduction

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
