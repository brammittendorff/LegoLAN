-- Naam bij de attendee (voor lijstjes in Backstage).
-- De oorspronkelijke UPDATE-statements met echte namen staan niet in git
-- (privacy); productie is destijds al bijgewerkt. De kolom zelf hoort wel
-- bij het schema.
ALTER TABLE attendees ADD COLUMN name TEXT;
