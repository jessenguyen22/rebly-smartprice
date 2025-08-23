# API Specification

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
