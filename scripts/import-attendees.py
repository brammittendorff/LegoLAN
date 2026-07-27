#!/usr/bin/env python3
"""
Zet een WooCommerce order-export (xlsx) om naar attendees-rijen voor D1.

Regel: elke afgeronde order met een item waar 'ticket' of 'entree' in de naam
staat, geeft dat e-mailadres toegang tot de foto's van dat jaar (het jaartal
komt uit de itemnaam).

Gebruik:
  python3 scripts/import-attendees.py ~/Downloads/orders-....xlsx > attendees.sql
  npx wrangler d1 execute legolan --local --file attendees.sql    # lokaal
  npx wrangler d1 execute legolan --remote --file attendees.sql   # productie

De gegenereerde SQL bevat e-mailadressen (privacy!) - commit dat bestand niet;
het staat in .gitignore.

Vereist: pip install openpyxl
"""
import re
import sys

import openpyxl

OK_STATUSES = {'completed', 'processing'}
TICKET_RE = re.compile(r'ticket|entree', re.IGNORECASE)
YEAR_RE = re.compile(r'20\d\d')


def main(path: str) -> None:
    wb = openpyxl.load_workbook(path, read_only=True)
    ws = wb.active
    rows = ws.iter_rows(values_only=True)
    header = [str(h) for h in next(rows)]
    i_status = header.index('Order Status')
    i_email = header.index('Email (Billing)')
    i_item = header.index('Item Name')

    pairs = set()
    for row in rows:
        status = str(row[i_status] or '').lower()
        email = str(row[i_email] or '').strip().lower()
        item = str(row[i_item] or '')
        if status not in OK_STATUSES or not email or '@' not in email:
            continue
        if not TICKET_RE.search(item):
            continue
        year = YEAR_RE.search(item)
        if not year:
            continue
        pairs.add((email, int(year.group())))

    print('-- Gegenereerd door scripts/import-attendees.py - NIET committen (privacy)')
    for email, edition in sorted(pairs):
        safe = email.replace("'", "''")
        print(
            f"INSERT OR IGNORE INTO attendees (email, edition, source) "
            f"VALUES ('{safe}', {edition}, 'woocommerce-import');"
        )
    print(f'-- {len(pairs)} rijen', file=sys.stderr)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('gebruik: import-attendees.py <orders.xlsx>')
    main(sys.argv[1])
