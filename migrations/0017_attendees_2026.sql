-- LEGOLAN 2026 is voorbij: iedereen die zich voor 2026 had ingeschreven staat
-- vast in `attendees` (= fototoegang, ook nadat EDITION_YEAR omhoog gaat).
-- Kopers krijgen die rij al bij betaling; dit vult eventuele gaten aan en
-- voegt wie een plek toegestuurd kreeg (owner_email) zonder zelf te bestellen.
INSERT OR IGNORE INTO attendees (email, edition, source, name)
  SELECT lower(o.email), 2026, 'order', MAX(o.name)
    FROM orders o
    JOIN order_items oi ON oi.order_id = o.id
   WHERE o.status = 'paid'
     AND o.edition = 2026
     AND oi.product_id IN ('ticket-weekend-2026', 'ticket-dag-2026')
   GROUP BY lower(o.email);

INSERT OR IGNORE INTO attendees (email, edition, source, name)
  SELECT lower(s.owner_email), 2026, 'seat',
         COALESCE(MAX(NULLIF(trim(coalesce(u.first_name, '') || ' ' || coalesce(u.last_name, '')), '')), MAX(s.nickname))
    FROM seats s
    LEFT JOIN users u ON lower(u.email) = lower(s.owner_email)
   WHERE s.edition = 2026
     AND s.owner_email IS NOT NULL
   GROUP BY lower(s.owner_email);
