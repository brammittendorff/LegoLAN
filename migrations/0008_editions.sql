-- Meerjarige geschiedenis: orders en plekken horen bij een editie, zodat we
-- nooit de database hoeven leeg te gooien voor een nieuw seizoen.

ALTER TABLE orders ADD COLUMN edition INTEGER;
UPDATE orders SET edition = 2026 WHERE edition IS NULL;

-- Plekken per editie: de plattegrond begint elk jaar leeg, oude claims blijven.
CREATE TABLE seats_new (
  edition INTEGER NOT NULL,
  seat_id TEXT NOT NULL,
  order_id TEXT NOT NULL REFERENCES orders(id),
  nickname TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (edition, seat_id)
);
INSERT INTO seats_new (edition, seat_id, order_id, nickname, claimed_at)
  SELECT 2026, seat_id, order_id, nickname, claimed_at FROM seats;
DROP TABLE seats;
ALTER TABLE seats_new RENAME TO seats;
CREATE INDEX idx_seats_order ON seats(order_id);
