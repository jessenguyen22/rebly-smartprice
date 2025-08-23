-- Query để kiểm tra data trong Google Cloud Console sau khi bạn test lại
-- Column names theo database schema thực tế

-- 1. Kiểm tra shop đã được tạo
SELECT 
    "shopDomain" as shop_domain,
    "createdAt" as created_at,
    "updatedAt" as updated_at
FROM shopify_shops 
WHERE "shopDomain" = 'rebly-io-2.myshopify.com';

-- 2. Kiểm tra campaigns cho shop này
SELECT 
    c.id,
    c.name,
    c.status,
    c."createdAt" as created_at,
    s."shopDomain" as shop_domain
FROM campaigns c
JOIN shopify_shops s ON c."shopifyShopId" = s.id
WHERE s."shopDomain" = 'rebly-io-2.myshopify.com'
ORDER BY c."createdAt" DESC;

-- 3. Kiểm tra audit trail entries
SELECT 
    a.id,
    a."changeType" as action,
    a."entityId" as variant_id,
    s."shopDomain" as shop_domain,
    a."timestamp" as created_at,
    a."oldValue" as old_price,
    a."newValue" as new_price,
    a.metadata
FROM audit_trail_entries a
JOIN shopify_shops s ON a."shopifyShopId" = s.id
WHERE s."shopDomain" = 'rebly-io-2.myshopify.com'
ORDER BY a."timestamp" DESC
LIMIT 10;

-- 4. Count tổng records
SELECT 
    'Shops' as table_name, 
    COUNT(*) as count
FROM shopify_shops
UNION ALL
SELECT 
    'Campaigns', 
    COUNT(*)
FROM campaigns c
JOIN shopify_shops s ON c."shopifyShopId" = s.id
WHERE s."shopDomain" = 'rebly-io-2.myshopify.com'
UNION ALL
SELECT 
    'Audit Entries', 
    COUNT(*)
FROM audit_trail_entries a
JOIN shopify_shops s ON a."shopifyShopId" = s.id
WHERE s."shopDomain" = 'rebly-io-2.myshopify.com';

-- 5. Chi tiết audit entry gần nhất
SELECT 
    a.id,
    a."changeType",
    a."entityType", 
    a."entityId",
    a."oldValue",
    a."newValue",
    a."triggerReason",
    a."campaignId",
    a.metadata::text,
    a."timestamp",
    s."shopDomain"
FROM audit_trail_entries a
JOIN shopify_shops s ON a."shopifyShopId" = s.id
WHERE s."shopDomain" = 'rebly-io-2.myshopify.com'
ORDER BY a."timestamp" DESC
LIMIT 5;
