-- Oude/andere e-mailadressen van dezelfde persoon, gekoppeld aan het
-- hoofdaccount. Edities (en dus fototoegang) van het oude adres tellen mee.
CREATE TABLE email_aliases (
  alias TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_aliases_user ON email_aliases(user_email);
