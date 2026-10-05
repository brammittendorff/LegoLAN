-- Meer dan aan/uit: een product kan te koop, uitverkocht, gesloten (bv. polo's
-- zijn al bij de drukker) of verborgen zijn. Geen rij = te koop.
-- `enabled` blijft bestaan zodat de vorige deploy blijft werken tussen deze
-- migratie en de nieuwe code; hij wordt nog meegeschreven (0 = verborgen).
ALTER TABLE product_settings ADD COLUMN mode TEXT NOT NULL DEFAULT 'sale'
  CHECK (mode IN ('sale', 'soldout', 'closed', 'hidden'));
UPDATE product_settings SET mode = 'hidden' WHERE enabled = 0;
