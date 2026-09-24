-- Seed data for RDS Inventory Management
-- Insert initial data for segments, categories, sub-categories, and products

-- Insert Segments
INSERT INTO segments (name, description) VALUES
('DTF', 'Direct to Film printing technology')
ON CONFLICT (name) DO NOTHING;

-- Insert Categories for DTF segment
INSERT INTO categories (name, segment_id, description) VALUES
('Inks', (SELECT id FROM segments WHERE name = 'DTF'), 'Printing inks for DTF'),
('Films', (SELECT id FROM segments WHERE name = 'DTF'), 'PET films for DTF transfer'),
('Powders', (SELECT id FROM segments WHERE name = 'DTF'), 'Hot melt powder for DTF')
ON CONFLICT (name, segment_id) DO NOTHING;

-- Insert Sub-categories for Inks category
INSERT INTO sub_categories (name, category_id, description) VALUES
('Premium', (SELECT id FROM categories WHERE name = 'Inks' AND segment_id = (SELECT id FROM segments WHERE name = 'DTF')), 'Premium quality inks'),
('Standard', (SELECT id FROM categories WHERE name = 'Inks' AND segment_id = (SELECT id FROM segments WHERE name = 'DTF')), 'Standard quality inks')
ON CONFLICT (name, category_id) DO NOTHING;

-- Insert Sub-categories for Films category
INSERT INTO sub_categories (name, category_id, description) VALUES
('SC', (SELECT id FROM categories WHERE name = 'Films' AND segment_id = (SELECT id FROM segments WHERE name = 'DTF')), 'Single Coated PET film'),
('DC', (SELECT id FROM categories WHERE name = 'Films' AND segment_id = (SELECT id FROM segments WHERE name = 'DTF')), 'Double Coated PET film')
ON CONFLICT (name, category_id) DO NOTHING;

-- Insert Products
-- Premium Inks
INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Premium White 1L',
  'DTF-INK-PREM-WHT-1L',
  'L',
  '3215',
  18.00,
  850.00,
  1000.00,
  5.00,
  12.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Premium'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Premium Cyan 1L',
  'DTF-INK-PREM-CYN-1L',
  'L',
  '3215',
  18.00,
  850.00,
  1000.00,
  5.00,
  10.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Premium'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Premium Magenta 1L',
  'DTF-INK-PREM-MAG-1L',
  'L',
  '3215',
  18.00,
  850.00,
  1000.00,
  5.00,
  10.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Premium'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Premium Yellow 1L',
  'DTF-INK-PREM-YLW-1L',
  'L',
  '3215',
  18.00,
  850.00,
  1000.00,
  5.00,
  10.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Premium'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Premium Black 1L',
  'DTF-INK-PREM-BLK-1L',
  'L',
  '3215',
  18.00,
  850.00,
  1000.00,
  5.00,
  12.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Premium'
ON CONFLICT DO NOTHING;

-- Standard Inks
INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Standard White 1L',
  'DTF-INK-STD-WHT-1L',
  'L',
  '3215',
  18.00,
  750.00,
  900.00,
  5.00,
  15.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Standard'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Standard Cyan 1L',
  'DTF-INK-STD-CYN-1L',
  'L',
  '3215',
  18.00,
  750.00,
  900.00,
  5.00,
  12.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Standard'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Standard Magenta 1L',
  'DTF-INK-STD-MAG-1L',
  'L',
  '3215',
  18.00,
  750.00,
  900.00,
  5.00,
  12.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Standard'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Standard Yellow 1L',
  'DTF-INK-STD-YLW-1L',
  'L',
  '3215',
  18.00,
  750.00,
  900.00,
  5.00,
  12.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Standard'
ON CONFLICT DO NOTHING;

INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'Standard Black 1L',
  'DTF-INK-STD-BLK-1L',
  'L',
  '3215',
  18.00,
  750.00,
  900.00,
  5.00,
  15.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Inks'
  AND sc.name = 'Standard'
ON CONFLICT DO NOTHING;

-- Hot Melt Powder (no sub-category)
INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id)
SELECT
  'Hot Melt Powder',
  'DTF-POWDER-HMP-1KG',
  'KG',
  '3506',
  18.00,
  450.00,
  550.00,
  10.00,
  25.00,
  s.id,
  c.id
FROM segments s
CROSS JOIN categories c
WHERE s.name = 'DTF'
  AND c.name = 'Powders'
ON CONFLICT DO NOTHING;

-- PET Film Single Coated (no sub-category for Films? Actually we have SC/DC sub-categories)
INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'PET Film Roll Single Coated',
  'DTF-FILM-SC-1PC',
  'PCS',
  '3920',
  18.00,
  120.00,
  150.00,
  20.00,
  30.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Films'
  AND sc.name = 'SC'
ON CONFLICT DO NOTHING;

-- PET Film Double Coated
INSERT INTO products (name, sku_code, unit, hsn_code, gst_rate, price_gst, price_non_gst, min_stock_level, current_stock, segment_id, category_id, sub_category_id)
SELECT
  'PET Film Roll Double Coated',
  'DTF-FILM-DC-1PC',
  'PCS',
  '3920',
  18.00,
  150.00,
  180.00,
  20.00,
  25.00,
  s.id,
  c.id,
  sc.id
FROM segments s
CROSS JOIN categories c
CROSS JOIN sub_categories sc
WHERE s.name = 'DTF'
  AND c.name = 'Films'
  AND sc.name = 'DC'
ON CONFLICT DO NOTHING;

-- Verify inserted data
SELECT
  p.name as product_name,
  p.sku_code,
  p.unit,
  p.hsn_code,
  p.gst_rate,
  p.price_gst,
  p.price_non_gst,
  p.min_stock_level,
  p.current_stock,
  s.name as segment,
  c.name as category,
  sc.name as sub_category
FROM products p
JOIN segments s ON p.segment_id = s.id
JOIN categories c ON p.category_id = c.id
LEFT JOIN sub_categories sc ON p.sub_category_id = sc.id
WHERE p.is_deleted = FALSE
ORDER BY s.name, c.name, sc.name, p.name;