-- 1. Function to handle stock adjustments on Receipt (GRN) creation / update
CREATE OR REPLACE FUNCTION handle_receipt_stock()
RETURNS TRIGGER AS $$
DECLARE
  line RECORD;
BEGIN
  -- When a receipt is inserted or updated to Received / Partially Received
  IF (TG_OP = 'INSERT' AND NEW.status IN ('Received', 'Partially Received')) OR
     (TG_OP = 'UPDATE' AND OLD.status NOT IN ('Received', 'Partially Received') AND NEW.status IN ('Received', 'Partially Received')) THEN

    FOR line IN SELECT product_id, quantity_received FROM receipt_lines WHERE receipt_id = NEW.id LOOP
      IF line.product_id IS NOT NULL AND line.quantity_received > 0 THEN
        -- Add stock adjustment
        INSERT INTO stock_adjustments (product_id, adjustment_type, quantity, reason, reference_type, reference_id)
        VALUES (line.product_id, 'In', line.quantity_received, 'GRN Receipt: ' || NEW.receipt_number, 'Receipt', NEW.id);

        -- Update product stock
        UPDATE products
        SET current_stock = current_stock + line.quantity_received
        WHERE id = line.product_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_receipt_stock ON receipts;
CREATE TRIGGER trg_receipt_stock
  AFTER INSERT OR UPDATE ON receipts
  FOR EACH ROW
  EXECUTE FUNCTION handle_receipt_stock();


-- 2. Function to handle stock adjustments on Sales Order delivery / invoice status change
CREATE OR REPLACE FUNCTION handle_sales_order_stock()
RETURNS TRIGGER AS $$
DECLARE
  line RECORD;
  existing_adj_count INT;
BEGIN
  -- When sales order becomes Delivered or Invoiced (and wasn't before)
  IF (TG_OP = 'INSERT' AND NEW.status IN ('Delivered', 'Invoiced')) OR
     (TG_OP = 'UPDATE' AND OLD.status NOT IN ('Delivered', 'Invoiced') AND NEW.status IN ('Delivered', 'Invoiced')) THEN

    -- Check if adjustments already exist for this order to prevent double deduction
    SELECT count(*) INTO existing_adj_count FROM stock_adjustments WHERE reference_type = 'SalesOrder' AND reference_id = NEW.id;

    IF existing_adj_count = 0 THEN
      FOR line IN SELECT product_id, quantity FROM sales_order_lines WHERE sales_order_id = NEW.id LOOP
        IF line.product_id IS NOT NULL AND line.quantity > 0 THEN
          -- Add stock adjustment OUT
          INSERT INTO stock_adjustments (product_id, adjustment_type, quantity, reason, reference_type, reference_id)
          VALUES (line.product_id, 'Out', line.quantity, 'Sales Order Delivery: ' || NEW.so_number, 'SalesOrder', NEW.id);

          -- Update product stock
          UPDATE products
          SET current_stock = current_stock - line.quantity
          WHERE id = line.product_id;
        END IF;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sales_order_stock ON sales_orders;
CREATE TRIGGER trg_sales_order_stock
  AFTER INSERT OR UPDATE ON sales_orders
  FOR EACH ROW
  EXECUTE FUNCTION handle_sales_order_stock();
