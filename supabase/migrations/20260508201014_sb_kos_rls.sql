-- Enable RLS on all sb_kos_* tables.
-- All application access goes through the service role key which bypasses RLS,
-- so no permissive policies are needed.

ALTER TABLE sb_kos_periods                ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_shopify_orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_shopify_line_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_pacful_line_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_pacful_billing_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_wwex_shipments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_wwex_charge_lines      ENABLE ROW LEVEL SECURITY;
ALTER TABLE sb_kos_category_rules         ENABLE ROW LEVEL SECURITY;
