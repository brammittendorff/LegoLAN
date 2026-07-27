/*
 * Integratietests tegen een verse lokale stack (wrangler + lege D1) in
 * nepbetaal-modus: catalogus, checkout-validatie, volledige aankoop,
 * plattegrond (login, claimen, vrijgeven, quota, dagpools) en Backstage.
 */
import {
  assert,
  assertEq,
  d1,
  jsonReq,
  sessionCookie,
  startServer,
  stopServer,
  summary,
  test,
} from './helpers.mjs'

const PORT = 8801
const { proc, persist, base } = await startServer({ port: PORT, mollieKey: 'fake' })

const koop = (items, email = 'koper@test.nl', naam = ['Test', 'Koper']) =>
  jsonReq(base, '/api/checkout', {
    method: 'POST',
    body: { firstName: naam[0], lastName: naam[1], email, turnstileToken: 't', items },
  })

const orderIdVan = (checkoutResp) => checkoutResp.data.checkoutUrl.split('order=')[1]

try {
  await test('stock bevat alle producten', async () => {
    const { status, data } = await jsonReq(base, '/api/stock')
    assertEq(status, 200, 'status')
    for (const id of ['ticket-weekend-2026', 'ticket-dag-2026', 'computerhuur-2026', 'diner-zaterdag-2026', 'polo-2026']) {
      assert(id in data.stock, `${id} ontbreekt in stock`)
    }
    assertEq(data.stock['ticket-weekend-2026'], 34, 'weekendvoorraad')
  })

  await test('checkout weigert dagticket zonder dag', async () => {
    const r = await koop([{ productId: 'ticket-dag-2026', qty: 1 }])
    assertEq(r.status, 400, 'status')
    assert(r.data.error.includes('dag'), 'foutmelding noemt dag')
  })

  await test('checkout weigert polo zonder opdruknaam', async () => {
    const r = await koop([{ productId: 'polo-2026', size: 'L', qty: 1 }])
    assertEq(r.status, 400, 'status')
    assert(r.data.error.includes('opdruk'), 'foutmelding noemt opdruk')
  })

  await test('checkout weigert kapotte naam/e-mail', async () => {
    const r = await jsonReq(base, '/api/checkout', {
      method: 'POST',
      body: { firstName: 'X', lastName: 'Y', email: 'geen-mail', turnstileToken: 't', items: [{ productId: 'ticket-weekend-2026', qty: 1 }] },
    })
    assertEq(r.status, 400, 'status')
  })

  let orderId = ''
  await test('volledige aankoop: weekend + polo + huur-PC (za)', async () => {
    const r = await koop([
      { productId: 'ticket-weekend-2026', qty: 1 },
      { productId: 'polo-2026', size: 'L', customName: 'CI Tester', qty: 1 },
      { productId: 'computerhuur-2026', size: 'za', qty: 1 },
    ])
    assertEq(r.status, 200, 'status')
    orderId = orderIdVan(r)
    const order = await jsonReq(base, `/api/order/${orderId}`)
    assertEq(order.data.status, 'paid', 'betaald (fake mode)')
    assertEq(order.data.amountCents, 6500, 'bedrag 25+20+20')
    assertEq(order.data.seatQuota, 1, 'één plek te claimen')
    assert(order.data.items.some((i) => i.customName === 'CI Tester'), 'polo-opdruk in order')
  })

  await test('dagticket za+zo kost 20 euro', async () => {
    const r = await koop([{ productId: 'ticket-dag-2026', size: 'zo+za', qty: 1 }], 'dagje@test.nl', ['Dagje', 'Tester'])
    const order = await jsonReq(base, `/api/order/${orderIdVan(r)}`)
    assertEq(order.data.amountCents, 2000, 'bedrag')
    assert(order.data.items[0].size === 'za+zo', 'dagen canoniek geordend')
  })

  await test('plattegrond is dicht zonder login', async () => {
    const r = await jsonReq(base, '/api/seats')
    assertEq(r.status, 401, 'status')
  })

  const cookie = sessionCookie('koper@test.nl')
  await test('plattegrond open met sessie', async () => {
    const r = await jsonReq(base, '/api/seats', { cookie })
    assertEq(r.status, 200, 'status')
  })

  await test('plek claimen, dubbel claimen en quota', async () => {
    let r = await jsonReq(base, '/api/seats/claim', {
      method: 'POST',
      body: { orderId, seatId: 'r0c5', nickname: 'CI-er' },
    })
    assertEq(r.status, 200, 'eerste claim')

    const tweede = await koop([{ productId: 'ticket-weekend-2026', qty: 1 }], 'ander@test.nl', ['Ander', 'Mens'])
    r = await jsonReq(base, '/api/seats/claim', {
      method: 'POST',
      body: { orderId: orderIdVan(tweede), seatId: 'r0c5', nickname: 'Kaper' },
    })
    assertEq(r.status, 409, 'zelfde plek geweigerd')

    r = await jsonReq(base, '/api/seats/claim', {
      method: 'POST',
      body: { orderId, seatId: 'r0c6', nickname: 'CI-er' },
    })
    assertEq(r.status, 403, 'quota op')
  })

  await test('plek vrijgeven: alleen met eigen order-id, daarna herclaimen', async () => {
    let r = await jsonReq(base, '/api/seats/release', {
      method: 'POST',
      body: { orderId: '00000000-0000-0000-0000-000000000000', seatId: 'r0c5' },
    })
    assert(r.status === 403 || r.status === 404, 'vreemde order geweigerd')

    r = await jsonReq(base, '/api/seats/release', { method: 'POST', body: { orderId, seatId: 'r0c5' } })
    assertEq(r.status, 200, 'eigen plek vrijgegeven')

    r = await jsonReq(base, '/api/seats/claim', {
      method: 'POST',
      body: { orderId, seatId: 'r0c9', nickname: 'CI-er' },
    })
    assertEq(r.status, 200, 'herclaim op andere plek')
  })

  await test('huur-PC-pool: 2 machines per dag', async () => {
    // Test 5 bezette al 1 PC op za; dit weekendpakket maakt za vol (2/2).
    let r = await koop([{ productId: 'computerhuur-2026', size: 'vr+za+zo', qty: 1 }], 'huur@test.nl', ['Huur', 'Alles'])
    assertEq(r.status, 200, 'tweede PC past nog')

    r = await koop([{ productId: 'computerhuur-2026', size: 'za', qty: 1 }], 'telaat@test.nl', ['Te', 'Laat'])
    assertEq(r.status, 409, 'derde PC op za geweigerd')
    assert(r.data.error.includes('huur-PC'), 'foutmelding noemt huur-PC')

    r = await koop([{ productId: 'computerhuur-2026', size: 'vr', qty: 1 }], 'vrijdag@test.nl', ['Vrij', 'Dag'])
    assertEq(r.status, 200, 'vrijdag heeft nog een PC vrij')
  })

  await test('login: onbekend adres mag registreren, bekend adres krijgt link', async () => {
    let r = await jsonReq(base, '/api/auth/login', {
      method: 'POST',
      body: { email: 'nieuw@test.nl', turnstileToken: 't' },
    })
    assertEq(r.data.status, 'unknown', 'onbekend')

    r = await jsonReq(base, '/api/auth/register', {
      method: 'POST',
      body: { email: 'nieuw@test.nl', firstName: 'Nieuw', lastName: 'Mens', nickname: 'Newbie', turnstileToken: 't' },
    })
    assertEq(r.data.status, 'sent', 'registratie stuurt link')

    r = await jsonReq(base, '/api/auth/login', {
      method: 'POST',
      body: { email: 'nieuw@test.nl', turnstileToken: 't' },
    })
    assertEq(r.data.status, 'sent', 'nu bekend')
  })

  await test('profiel: lezen (afgeleid van order) en schrijven', async () => {
    let r = await jsonReq(base, '/api/me', { cookie })
    assertEq(r.data.firstName, 'Test', 'voornaam uit order')
    assert(r.data.editions.includes(2026), 'editie 2026 na aankoop')
    assert(r.data.seats.some((s) => s.nickname === 'CI-er'), 'plek op profiel')

    r = await jsonReq(base, '/api/me', {
      method: 'PUT',
      cookie,
      body: { firstName: 'Test', lastName: 'Koper', nickname: 'CI-Held' },
    })
    assertEq(r.status, 200, 'opslaan')
    r = await jsonReq(base, '/api/me', { cookie })
    assertEq(r.data.nickname, 'CI-Held', 'nickname bijgewerkt')
  })

  await test('magic-link login maakt account-rij aan (zichtbaar in Backstage)', async () => {
    const { makeToken } = await import('./helpers.mjs')
    const loginTok = makeToken('lurker@test.nl', 'login', 60_000)
    const res = await fetch(`${base}/api/auth/callback?token=${encodeURIComponent(loginTok)}&next=/account`, {
      redirect: 'manual',
    })
    assertEq(res.status, 302, 'callback redirect')
    d1(persist, "INSERT INTO users (email, role, updated_at) VALUES ('check-admin@test.nl','admin',0) ON CONFLICT(email) DO UPDATE SET role='admin'")
    const r = await jsonReq(base, '/api/admin/users', { cookie: sessionCookie('check-admin@test.nl') })
    assert(r.data.users.some((u) => u.email === 'lurker@test.nl'), 'ingelogde bezoeker in gebruikerslijst')
  })

  await test('backstage: dicht voor users, open voor admins', async () => {
    let r = await jsonReq(base, '/api/admin/overview', { cookie })
    assertEq(r.status, 403, 'user geweigerd')

    d1(persist, "INSERT INTO users (email, role, updated_at) VALUES ('admin@test.nl','admin',0) ON CONFLICT(email) DO UPDATE SET role='admin'")
    const adminCookie = sessionCookie('admin@test.nl')
    r = await jsonReq(base, '/api/admin/overview', { cookie: adminCookie })
    assertEq(r.status, 200, 'admin mag')
    assert(r.data.orders.length >= 3, 'orders zichtbaar')
    assert(r.data.seats.length >= 1, 'plekken zichtbaar')

    const res = await fetch(`${base}/api/admin/export?type=orders`, { headers: { cookie: adminCookie } })
    assertEq(res.status, 200, 'export status')
    assert((res.headers.get('content-type') ?? '').includes('text/csv'), 'export is csv')
    const csv = await res.text()
    assert(csv.includes('koper@test.nl'), 'koper in export')
  })

  await test('backstage: pending annuleren, betaald niet', async () => {
    d1(
      persist,
      "INSERT INTO orders (id, created_at, status, name, first_name, last_name, email, amount_cents, edition) VALUES ('test-pending-1', 1, 'pending', 'Hang Ende', 'Hang', 'Ende', 'hang@test.nl', 1000, 2026)",
    )
    const adminCookie = sessionCookie('admin@test.nl')
    let r = await jsonReq(base, '/api/admin/order', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { orderId: 'test-pending-1', action: 'cancel' },
    })
    assertEq(r.status, 200, 'pending geannuleerd')

    r = await jsonReq(base, '/api/admin/order', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { orderId, action: 'cancel' },
    })
    assertEq(r.status, 409, 'betaalde order niet annuleerbaar')
  })

  await test('backstage: edities bijschrijven synct fototoegang', async () => {
    const adminCookie = sessionCookie('admin@test.nl')
    let r = await jsonReq(base, '/api/admin/users', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { email: 'koper@test.nl', editions: [2024, 2026] },
    })
    assertEq(r.status, 200, 'edities gezet')
    r = await jsonReq(base, '/api/me', { cookie })
    assert(r.data.editions.includes(2024) && r.data.editions.includes(2026), '2024 erbij')
  })
  await test('bestaande sessie zonder account-rij krijgt er een via /api/me', async () => {
    const ghost = sessionCookie('spook@test.nl')
    const r = await jsonReq(base, '/api/me', { cookie: ghost })
    assertEq(r.status, 200, 'profiel')
    const adminCookie = sessionCookie('admin@test.nl')
    const lijst = await jsonReq(base, '/api/admin/users', { cookie: adminCookie })
    assert(lijst.data.users.some((u) => u.email === 'spook@test.nl'), 'rij aangemaakt via profielbezoek')
  })

  await test('polo-opdruk wordt nickname als die nog leeg is', async () => {
    await koop(
      [{ productId: 'polo-2026', size: 'M', customName: 'PoloNick', qty: 1 }],
      'polokoper@test.nl',
      ['Polo', 'Koper'],
    )
    const r = await jsonReq(base, '/api/me', { cookie: sessionCookie('polokoper@test.nl') })
    assertEq(r.data.nickname, 'PoloNick', 'opdruk als nickname')
  })

  await test('nickname-herinnering: beveiligd, verstuurt en herhaalt niet direct', async () => {
    let r = await jsonReq(base, '/api/cron/nickname-reminder', { method: 'POST' })
    assertEq(r.status, 403, 'zonder sleutel dicht')

    const res1 = await fetch(`${base}/api/cron/nickname-reminder`, {
      method: 'POST',
      headers: { 'x-cron-key': 'ci-cron-secret' },
    })
    const d1res = await res1.json()
    assert(d1res.sent >= 1, 'minstens één herinnering verstuurd')

    const res2 = await fetch(`${base}/api/cron/nickname-reminder`, {
      method: 'POST',
      headers: { 'x-cron-key': 'ci-cron-secret' },
    })
    const d2res = await res2.json()
    assertEq(d2res.sent, 0, 'tweede run direct erna stuurt niets')
  })

  await test('gekoppeld oud e-mailadres telt mee voor edities', async () => {
    d1(persist, "INSERT OR IGNORE INTO attendees (email, edition, source) VALUES ('oud-adres@test.nl', 2024, 'import-test')")
    const adminCookie = sessionCookie('admin@test.nl')
    let r = await jsonReq(base, '/api/admin/users', {
      method: 'PATCH',
      cookie: adminCookie,
      body: { email: 'dagje@test.nl', aliases: ['oud-adres@test.nl'] },
    })
    assertEq(r.status, 200, 'alias gekoppeld')

    r = await jsonReq(base, '/api/me', { cookie: sessionCookie('dagje@test.nl') })
    assert(r.data.editions.includes(2024), 'editie van oud adres telt mee')

    r = await jsonReq(base, '/api/admin/users', { cookie: adminCookie })
    const u = r.data.users.find((x) => x.email === 'dagje@test.nl')
    assert(u.aliases?.includes('oud-adres@test.nl'), 'alias zichtbaar in lijst')
  })

} finally {
  stopServer(proc)
}

process.exitCode = summary('integratie') > 0 ? 1 : 0
