-- Profiel van ingelogde bezoekers (wachtwoordloos; e-mail is de identiteit).
-- Voor-/achternaam en nickname zijn hier aanpasbaar via /account.
CREATE TABLE users (
  email TEXT PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  nickname TEXT,
  updated_at INTEGER NOT NULL
);
