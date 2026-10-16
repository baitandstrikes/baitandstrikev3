CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY,
  shop TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_review',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  currency TEXT NOT NULL,
  recipient TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL,
  billing_address TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  subtotal_minor INTEGER NOT NULL,
  line_items_json TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  email_status TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(shop, customer_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_quotations_customer
  ON quotations(shop, customer_id, created_at DESC);

