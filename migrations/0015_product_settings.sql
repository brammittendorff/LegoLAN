-- Admin kan producten aan/uit zetten zonder deploy. Geen rij = aan (de
-- catalogus in shared/products.ts blijft de bron); alleen afwijkingen staan hier.
CREATE TABLE product_settings (
  product_id TEXT PRIMARY KEY,
  enabled INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);
