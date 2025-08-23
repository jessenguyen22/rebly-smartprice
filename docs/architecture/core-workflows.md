# Core Workflows

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
