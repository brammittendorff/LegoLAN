-- Rollen: 'user' (standaard) of 'admin' (ziet /admin).
-- Admin maken: INSERT INTO users (email, role, updated_at) VALUES ('adres', 'admin', 0)
--   ON CONFLICT(email) DO UPDATE SET role='admin';
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
