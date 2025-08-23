-- Queries để kiểm tra audit data trên Google Cloud Console
-- Thay đổi shop domain thành domain thực tế bạn đang test

-- 1. Kiểm tra tất cả shop domains có trong database
SELECT 
    shop_domain,
    access_token IS NOT NULL as has_token,
    created_at,
    updated_at
FROM shopify_shops 
ORDER BY created_at DESC;

-- 2. Đếm campaigns theo shop
SELECT 
    s.shop_domain,
    COUNT(c.id) as campaign_count
FROM shopify_shops s
LEFT JOIN campaigns c ON c.shop_domain = s.shop_domain
GROUP BY s.shop_domain;

-- 3. Đếm audit entries theo shop
SELECT 
    s.shop_domain,
    COUNT(a.id) as audit_count
FROM shopify_shops s
LEFT JOIN audit_trail_entries a ON a.shop_domain = s.shop_domain
GROUP BY s.shop_domain;

-- 4. Chi tiết campaigns gần đây (nếu có)
SELECT 
    c.id,
    c.name,
    c.shop_domain,
    c.status,
    c.created_at,
    c.updated_at
FROM campaigns c
ORDER BY c.created_at DESC
LIMIT 10;

-- 5. Chi tiết audit entries gần đây (nếu có)
SELECT 
    a.id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.shop_domain,
    a.created_at,
    a.metadata::text as metadata_text
FROM audit_trail_entries a
ORDER BY a.created_at DESC
LIMIT 10;

-- 6. Tìm tất cả price change actions
SELECT 
    a.id,
    a.shop_domain,
    a.entity_id as variant_id,
    a.created_at,
    JSON_EXTRACT(a.metadata, '$.oldPrice') as old_price,
    JSON_EXTRACT(a.metadata, '$.newPrice') as new_price,
    JSON_EXTRACT(a.metadata, '$.productTitle') as product_title
FROM audit_trail_entries a
WHERE a.action = 'PRICE_CHANGED'
ORDER BY a.created_at DESC;
