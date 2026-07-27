-- Admin kan een plek direct aan een e-mailadres toewijzen, ook als die
-- persoon (nog) geen bestelling heeft. Zo'n plek heeft geen order_id maar
-- wel een owner_email (altijd lowercase).
CREATE TABLE seats_new (
  edition INTEGER NOT NULL,
  seat_id TEXT NOT NULL,
  order_id TEXT REFERENCES orders(id),
  owner_email TEXT,
  nickname TEXT NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (edition, seat_id),
  CHECK (order_id IS NOT NULL OR owner_email IS NOT NULL)
);
INSERT INTO seats_new (edition, seat_id, order_id, nickname, claimed_at)
  SELECT edition, seat_id, order_id, nickname, claimed_at FROM seats;
DROP TABLE seats;
ALTER TABLE seats_new RENAME TO seats;
CREATE INDEX idx_seats_order ON seats(order_id);
CREATE INDEX idx_seats_owner ON seats(owner_email);
