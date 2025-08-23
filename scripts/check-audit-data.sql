-- Kiểm tra các campaign đã được tạo
SELECT 
    c.id,
    c.name,
    c.description,
    c.status,
    c.trigger_count,
    c.last_triggered,
    c.created_at,
    s.shop_domain
FROM campaigns c
JOIN shopify_shops s ON c.shopify_shop_id = s.id
ORDER BY c.created_at DESC
LIMIT 10;

-- Kiểm tra các pricing rules của campaign
SELECT 
    pr.id,
    pr.description,
    pr.when_condition,
    pr.when_value,
    pr.then_action,
    pr.then_mode,
    pr.then_value,
    pr.change_compare_at,
    c.name as campaign_name
FROM pricing_rules pr
JOIN campaigns c ON pr.campaign_id = c.id
JOIN shopify_shops s ON c.shopify_shop_id = s.id
ORDER BY pr.created_at DESC
LIMIT 10;

-- Kiểm tra audit trail entries (log tất cả thay đổi giá)
SELECT 
    ate.id,
    ate.entity_type,
    ate.entity_id,
    ate.change_type,
    ate.old_value,
    ate.new_value,
    ate.trigger_reason,
    ate.user_id,
    ate.timestamp,
    c.name as campaign_name,
    s.shop_domain
FROM audit_trail_entries ate
LEFT JOIN campaigns c ON ate.campaign_id = c.id
JOIN shopify_shops s ON ate.shopify_shop_id = s.id
ORDER BY ate.timestamp DESC
LIMIT 20;

-- Kiểm tra chi tiết metadata của audit entries
SELECT 
    ate.id,
    ate.entity_id,
    ate.old_value as old_price,
    ate.new_value as new_price,
    ate.trigger_reason,
    ate.metadata,
    ate.timestamp,
    c.name as campaign_name
FROM audit_trail_entries ate
LEFT JOIN campaigns c ON ate.campaign_id = c.id
JOIN shopify_shops s ON ate.shopify_shop_id = s.id
WHERE ate.change_type = 'price_update'
ORDER BY ate.timestamp DESC
LIMIT 10;

-- Thống kê các thay đổi giá theo shop
SELECT 
    s.shop_domain,
    COUNT(*) as total_price_changes,
    COUNT(DISTINCT ate.campaign_id) as campaigns_used,
    MIN(ate.timestamp) as first_change,
    MAX(ate.timestamp) as latest_change,
    AVG(CAST(ate.new_value AS DECIMAL) - CAST(ate.old_value AS DECIMAL)) as avg_price_change
FROM audit_trail_entries ate
JOIN shopify_shops s ON ate.shopify_shop_id = s.id
WHERE ate.change_type = 'price_update'
    AND ate.old_value IS NOT NULL 
    AND ate.new_value IS NOT NULL
GROUP BY s.shop_domain
ORDER BY total_price_changes DESC;

-- Kiểm tra pricing jobs nếu có
SELECT 
    pj.id,
    pj.job_type,
    pj.status,
    pj.total_variants,
    pj.processed_variants,
    pj.successful_updates,
    pj.failed_updates,
    pj.execution_time_ms,
    pj.created_at,
    c.name as campaign_name,
    s.shop_domain
FROM pricing_jobs pj
LEFT JOIN campaigns c ON pj.campaign_id = c.id
JOIN shopify_shops s ON pj.shopify_shop_id = s.id
ORDER BY pj.created_at DESC
LIMIT 10;
