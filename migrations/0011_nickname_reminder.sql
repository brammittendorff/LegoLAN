-- Wanneer we voor het laatst gevraagd hebben om een nickname in te vullen
-- (zodat de herinneringsmail niet vaker dan eens per maand gaat).
ALTER TABLE users ADD COLUMN nickname_reminded_at INTEGER;
