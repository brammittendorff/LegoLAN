# LEGOLAN - legolan.nl

De site van de jaarlijkse LEGOLAN: **React + Vite**, gehost op **Cloudflare
Pages** (gratis). De shop (Mollie/iDEAL), plek-registratie op de plattegrond,
accounts en de foto-albums draaien op **Pages Functions** met een
**D1**-database. Mail gaat via **Mailjet**, foto's staan privé in **Wasabi S3**,
spam wordt tegengehouden door **Turnstile**.

Editie 2026: *Stripclub* - 9 t/m 11 oktober, Topweg 31 Hengelo (opbouw 8 oktober).

**Productie: https://legolan.nl** (Cloudflare Pages-project `legolan`). Elke
push naar `main` wordt automatisch gelint, gebouwd en gedeployed via GitHub
Actions.

---

## Lokaal draaien

### Met Docker (aangeraden)

```bash
cp .dev.vars.example .dev.vars   # vul evt. keys in
docker compose up
```

- Site: **http://localhost:8788**
- Mail: **http://localhost:8025** - alle e-mail wordt lokaal gevangen door
  Mailpit; er gaat níets echt de deur uit.

De lokale database is een SQLite-bestand in `.wrangler/` (blijft bewaard).
Testdata weggooien:

```bash
npx wrangler d1 execute legolan --local --command "DELETE FROM seats; DELETE FROM order_items; DELETE FROM orders;"
```

### Zonder Docker

```bash
npm install
npm run db:migrate:local   # eenmalig
npm run dev:full           # build + wrangler op http://localhost:8788
```

### Hot reload tijdens het stylen

De wrangler-omgeving serveert een gebouwde site (geen hot reload). Laat die
draaien en start ernaast `npm run dev` → **http://localhost:5173** met instant
hot reload; API-calls gaan via een proxy naar :8788.

### Betalen en spamcheck lokaal

- `.dev.vars` heeft `MOLLIE_API_KEY=test_...` (echte Mollie **test**-checkout,
  je kiest zelf betaald/mislukt) of `fake` (alles direct "betaald", geen Mollie
  nodig). **Nooit de live key lokaal gebruiken.**
- Turnstile draait lokaal in altijd-goed testmodus (geen keys nodig).

---

## Productie (staat, en hoe je eraan komt)

| Wat | Waar |
| --- | --- |
| Site | https://legolan.nl (+ legolan.pages.dev) |
| Deploys | GitHub Actions op elke push naar `main` (`.github/workflows/deploy.yml`); handmatig kan met `npm run deploy` na `npx wrangler login` |
| Database | D1 `legolan`; schema wijzigen = nieuw bestand in `migrations/` + `npm run db:migrate:remote` |
| Secrets | `printf '<waarde>' \| npx wrangler pages secret put <NAAM> --project-name legolan` (lijst in `.dev.vars.example`); **Mollie staat op de live key** |
| Turnstile | widget `legolan` (legolan.nl + legolan.pages.dev); secret = Pages-secret `TURNSTILE_SECRET_KEY`, publieke sitekey = GitHub Actions-variabele `VITE_TURNSTILE_SITE_KEY` en lokaal `.env.local` |
| Foto's | Wasabi-bucket `legolan` (eu-central-1), map per editie: `2024/`, `2025/`, ... - upload met een S3-client en de site toont ze vanzelf |
| GitHub-secrets voor CI | `CLOUDFLARE_API_TOKEN` (Pages+Turnstile Edit), `CLOUDFLARE_ACCOUNT_ID` |

Bestellingen bekijk je in het Mollie-dashboard of direct in D1:

```bash
npx wrangler d1 execute legolan --remote --command "SELECT created_at, name, email, status, amount_cents/100.0 AS eur FROM orders ORDER BY created_at DESC LIMIT 20;"
```

Polo-druklijst voor de leverancier:

```bash
npx wrangler d1 execute legolan --remote --command "SELECT o.first_name, o.last_name, oi.size, oi.custom_name FROM order_items oi JOIN orders o ON o.id=oi.order_id WHERE oi.custom_name IS NOT NULL AND o.status='paid';"
```

**Terugbetalen** (iemand kan niet komen): refund in het Mollie-dashboard.
De site zet de order daarna zelf op `refunded`, geeft de plek op de
plattegrond vrij en telt de voorraad weer op.

---

## Hoe het werkt

- **Checkout** (`functions/api/checkout.ts`): prijzen komen uit
  `shared/products.ts` op de server, voorraad wordt gecheckt in D1, daarna
  redirect naar Mollie. Pending orders verlopen na 1 uur en geven hun
  voorraad terug.
- **Computerhuur**: één product, prijs per dag; de koper vinkt dagen aan en de
  server bewaakt 2 machines per eventdag (`CAPACITY_POOLS` + `EVENT_DAYS`).
- **Webhook** (`functions/api/webhooks/mollie.ts`): zet de order op betaald en
  stuurt de bevestigingsmail met de plattegrond-link; detecteert ook refunds.
- **Plekken** (`functions/api/seats/*`): 1 plek per ticket; dagtickets claimen
  dagplekken. Dubbel claimen kan niet (primary key op de plek).
- **Accounts** (`functions/api/auth/*`, `/api/me`): wachtwoordloos - maillink
  (15 min) wordt sessiecookie (30 dagen). Onbekende adressen kunnen zich
  registreren (voornaam/achternaam/nickname verplicht). Op `/account` pas je
  je gegevens aan en zie je je edities en je plek in de zaal.
- **Foto's** (`functions/api/photos.ts`): albums per editie, alleen voor wie
  erbij was (import uit WooCommerce + automatisch bij aankoop). De browser
  krijgt tijdelijke getekende Wasabi-URLs; de bucket zelf blijft privé.
- **Formulieren**: contact + nieuwsbrief (Mailjet-lijst "Legolan Contacts",
  id 3318) achter Turnstile.

## Jaarlijkse restyle (voor de vrijwilliger van volgend jaar)

Alles wat jaar-specifiek is zit op vier plekken:

| Wat | Waar |
| --- | --- |
| Eventnaam, datum, copy, grappen, programma, socials (NL én EN) | `src/theme/<jaar>-<thema>/theme.ts` (kopieer de map, pas `src/theme/index.ts` aan) |
| Kleuren & fonts | `@theme`-blok in `src/index.css` (+ het fonts-`<link>` in `index.html`) |
| Producten, prijzen, pools & eventdagen | `shared/products.ts` (prijzen in centen; ticket-capaciteit hoort te kloppen met de plattegrond; `EDITION_YEAR` ophogen!) |
| De plattegrond | `shared/seatmap.ts` (ASCII-tekening; verbouw de zaal vóór de verkoop start) |

Nieuw seizoen: **niets weggooien.** De database onthoudt per editie wie er
meedeed en waar diegene zat. Het enige wat je doet: `EDITION_YEAR` ophogen,
nieuwe producten en plattegrond invullen, en de foto's van de afgelopen editie
in de bijbehorende map op Wasabi zetten. De plattegrond begint automatisch
leeg (plekken zijn per editie); oude edities blijven zichtbaar op /account en
in de foto-albums.

## Copy-regels

Nederlands is de standaardtaal; alle teksten bestaan ook in het Engels
(`t('nl', 'en')` of het themabestand). Geen em-dashes, ellipsen, krulquotes of
emoji in de copy - gewone leestekens. De toon mag ondeugend, maar interne
grappen/verrassingen blijven van de publieke site.
