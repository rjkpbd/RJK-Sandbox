-- Kosterina billing analytics schema
-- Run via Supabase Dashboard SQL editor or: supabase db push

-- ─── Periods ─────────────────────────────────────────────────────────────────
CREATE TABLE sb_kos_periods (
  id         bigserial PRIMARY KEY,
  period     date        NOT NULL,  -- first of month, e.g. 2026-03-01
  label      text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period)
);

-- ─── Shopify orders ───────────────────────────────────────────────────────────
CREATE TABLE sb_kos_shopify_orders (
  id                 bigserial PRIMARY KEY,
  period_id          bigint      NOT NULL REFERENCES sb_kos_periods(id) ON DELETE CASCADE,
  order_key          text        NOT NULL,  -- Name stripped of leading #
  name_raw           text,
  email              text,
  fulfilled_at       timestamptz,
  created_at_shopify timestamptz,
  subtotal           numeric(12,2),
  shipping           numeric(12,2),
  total              numeric(12,2),
  discount_code      text,
  discount_amount    numeric(12,2),
  shipping_method    text,
  shipping_city      text,
  shipping_state     text,
  shipping_zip       text,
  shipping_country   text,
  tags_raw           text,
  source             text,
  vendor             text,
  category           text,
  ingested_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, order_key)
);

CREATE INDEX idx_shopify_orders_period_id ON sb_kos_shopify_orders (period_id);
CREATE INDEX idx_shopify_orders_order_key ON sb_kos_shopify_orders (order_key);

-- ─── Shopify line items ───────────────────────────────────────────────────────
CREATE TABLE sb_kos_shopify_line_items (
  id               bigserial PRIMARY KEY,
  shopify_order_id bigint      NOT NULL REFERENCES sb_kos_shopify_orders(id) ON DELETE CASCADE,
  lineitem_sku     text,
  lineitem_name    text,
  lineitem_quantity int,
  lineitem_price   numeric(12,2)
);

CREATE INDEX idx_shopify_line_items_order_id ON sb_kos_shopify_line_items (shopify_order_id);

-- ─── Pacful line items ────────────────────────────────────────────────────────
CREATE TABLE sb_kos_pacful_line_items (
  id                   bigserial PRIMARY KEY,
  period_id            bigint      NOT NULL REFERENCES sb_kos_periods(id) ON DELETE CASCADE,
  transaction_id       text,
  reference_raw        text,
  order_key            text,
  order_processing_fee numeric(14,4),
  kitting_minutes      numeric(14,4),
  kitting_charge       numeric(14,4),
  items_picked         numeric(14,4),
  item_pick_charge     numeric(14,4),
  addl_pick_charge     numeric(14,4),
  cartons_btb          numeric(14,4),
  pallets_btb          numeric(14,4),
  carton_pull_total    numeric(14,4),
  pallet_pull_total    numeric(14,4),
  pick_item_total      numeric(14,4),
  materials            numeric(14,4),
  freight_postage_fees numeric(14,4),
  ship_prep_minutes    numeric(14,4),
  ship_prep_charge     numeric(14,4),
  line_total           numeric(14,4),
  category_override    text,
  ingested_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period_id, reference_raw)
);

CREATE INDEX idx_pacful_line_items_period_id ON sb_kos_pacful_line_items (period_id);
CREATE INDEX idx_pacful_line_items_order_key ON sb_kos_pacful_line_items (order_key);

-- ─── Pacful billing summary ───────────────────────────────────────────────────
CREATE TABLE sb_kos_pacful_billing_summary (
  id         bigserial PRIMARY KEY,
  period_id  bigint      NOT NULL REFERENCES sb_kos_periods(id) ON DELETE CASCADE,
  label      text,
  quantity   numeric(14,4),
  amount     numeric(14,4),
  notes      text,
  sort_order int         NOT NULL DEFAULT 0
);

CREATE INDEX idx_pacful_billing_summary_period_id ON sb_kos_pacful_billing_summary (period_id);

-- ─── WWEX shipments ───────────────────────────────────────────────────────────
CREATE TABLE sb_kos_wwex_shipments (
  id                      bigserial PRIMARY KEY,
  period_id               bigint      NOT NULL REFERENCES sb_kos_periods(id) ON DELETE CASCADE,
  customer_num            text,
  invoice_num             text,
  line_of_business        text,
  airbill_num             text,
  ship_date               date,
  pro_num                 text,
  bol_num                 text,
  scac                    text,
  bill_type               text,
  shippers_name           text,
  shippers_city           text,
  shippers_state          text,
  shippers_zip            text,
  receiver_name           text,
  receiver_city           text,
  receiver_state          text,
  receiver_zip            text,
  pieces                  numeric(12,2),
  original_weight         numeric(12,2),
  charged_weight          numeric(12,2),
  charge_total            numeric(12,2),
  invoice_date            date,
  billing_reference_1_raw text,
  order_key               text,
  vendor_reference_1      text,
  service_level           text,
  zone                    text,
  category_override       text,
  ingested_at             timestamptz NOT NULL DEFAULT now()
  -- No UNIQUE on order_key: LTL rows have null; one order_key can appear across SP+LTL
);

CREATE INDEX idx_wwex_shipments_period_id ON sb_kos_wwex_shipments (period_id);
CREATE INDEX idx_wwex_shipments_order_key ON sb_kos_wwex_shipments (order_key);

-- ─── WWEX charge lines ────────────────────────────────────────────────────────
CREATE TABLE sb_kos_wwex_charge_lines (
  id               bigserial PRIMARY KEY,
  wwex_shipment_id bigint      NOT NULL REFERENCES sb_kos_wwex_shipments(id) ON DELETE CASCADE,
  charge_idx       int         NOT NULL,
  charge_type      text,
  charge_amount    numeric(12,2),
  UNIQUE (wwex_shipment_id, charge_idx)
);

CREATE INDEX idx_wwex_charge_lines_shipment_id ON sb_kos_wwex_charge_lines (wwex_shipment_id);

-- ─── Category rules ───────────────────────────────────────────────────────────
CREATE TABLE sb_kos_category_rules (
  id         bigserial PRIMARY KEY,
  tag        text        NOT NULL,
  category   text        NOT NULL,
  priority   int         NOT NULL DEFAULT 99,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tag)
);

-- Seed: 25 starter rules (lower priority number wins)
INSERT INTO sb_kos_category_rules (priority, tag, category) VALUES
  (10, 'Wholesale',                     'Wholesale'),
  (10, 'Faire',                         'Wholesale - Faire'),
  (10, 'Crate & Barrel',                'Wholesale - C&B'),
  (10, 'Katina',                        'Wholesale - Katina'),
  (20, 'Replacement - Damaged Order',   'Replacement'),
  (20, 'Replacement - Missing Item',    'Replacement'),
  (20, 'Replacement - Missing Order',   'Replacement'),
  (20, 'Replacement - Wrong Item',      'Replacement'),
  (20, 'Replacement Order - Damages',   'Replacement'),
  (30, 'Gift - Partnerships',           'Gifted'),
  (30, 'Gifted Product',                'Gifted'),
  (30, 'Gifted Product - Influencer',   'Gifted'),
  (30, 'Gifted Product - Internal',     'Gifted'),
  (30, 'Gifted Product - Prospecting',  'Gifted'),
  (30, 'Gifted Product – Partnerships', 'Gifted'),
  (30, 'Investor samples',              'Gifted'),
  (30, 'PR - Mona Creative',            'Gifted'),
  (30, 'Collab Gift',                   'Gifted'),
  (40, 'Subscription',                  'Subscription'),
  (40, 'Subscription First Order',      'Subscription'),
  (40, 'Subscription Recurring Order',  'Subscription'),
  (50, 'Test',                          'Test'),
  (50, 'Test Order',                    'Test'),
  (50, 'Zero Dollar Order',             'Test'),
  (99, 'sent-to-3PL',                   'DTC');
