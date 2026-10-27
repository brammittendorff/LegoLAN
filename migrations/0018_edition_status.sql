-- De jaarlijkse uit-knop, nu in Backstage: per editie of het event voorbij
-- is. Geen rij = loopt nog, dus een nieuw EDITION_YEAR begint vanzelf open.
CREATE TABLE edition_status (
  edition INTEGER PRIMARY KEY,
  finished INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by TEXT NOT NULL
);
-- 2026 is al voorbij (stond eerst als EDITION_FINISHED in de code).
INSERT INTO edition_status (edition, finished, updated_at, updated_by)
  VALUES (2026, 1, 0, 'migratie');
