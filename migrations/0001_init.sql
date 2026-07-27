-- Bestellingen. Status: pending → paid | failed | canceled | expired
CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  mollie_payment_id TEXT,
  confirmation_sent INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_mollie ON orders(mollie_payment_id);

CREATE TABLE order_items (
  order_id TEXT NOT NULL REFERENCES orders(id),
  product_id TEXT NOT NULL,
  size TEXT,
  qty INTEGER NOT NULL,
  price_cents INTEGER NOT NULL
);
CREATE INDEX idx_items_order ON order_items(order_id);
CREATE INDEX idx_items_product ON order_items(product_id);

-- Geclaimde plekken op de plattegrond. seat_id = "r<rij>c<kolom>" uit shared/seatmap.ts.
-- PRIMARY KEY op seat_id = één claim per plek, race-vrij.
CREATE TABLE seats (
  seat_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  nickname TEXT NOT NULL,
  claimed_at INTEGER NOT NULL
);
CREATE INDEX idx_seats_order ON seats(order_id);
