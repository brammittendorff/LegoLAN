-- Sessie-versie per gebruiker: "overal uitloggen" verhoogt dit nummer,
-- waardoor alle uitstaande loginlinks en sessiecookies ongeldig worden.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
