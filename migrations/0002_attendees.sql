-- Wie was er bij welke editie (voor toegang tot de foto-albums).
-- Oude edities komen uit de WooCommerce-export (scripts/import-attendees.py);
-- de huidige editie volgt automatisch uit betaalde ticket-orders in D1.
CREATE TABLE attendees (
  email TEXT NOT NULL,
  edition INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'import',
  PRIMARY KEY (email, edition)
);
CREATE INDEX idx_attendees_email ON attendees(email);
