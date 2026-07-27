-- Wanneer een account is ontstaan en wanneer er voor het laatst is ingelogd
-- (milliseconden, net als orders.created_at). Bestaande accounts krijgen hun
-- laatste wijzigingsmoment als beste benadering van de aanmaakdatum.
ALTER TABLE users ADD COLUMN created_at INTEGER;
ALTER TABLE users ADD COLUMN last_login_at INTEGER;
UPDATE users SET created_at = updated_at WHERE created_at IS NULL;
