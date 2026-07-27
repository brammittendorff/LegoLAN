-- Voor- en achternaam apart (zoals WooCommerce dat ook had).
-- De bestaande kolom `name` blijft de volledige naam bevatten.
ALTER TABLE orders ADD COLUMN first_name TEXT;
ALTER TABLE orders ADD COLUMN last_name TEXT;
