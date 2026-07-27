/*
 * End-to-end met de ECHTE Mollie test-omgeving: afrekenen, op de Mollie
 * testpagina "Betaald" kiezen, terugkomen op /bedankt en een plek claimen.
 * Vereist MOLLIE_TEST_API_KEY in de omgeving (test_...).
 */
import { chromium } from 'playwright'
import {
  assert,
  assertEq,
  jsonReq,
  sessionCookie,
  startServer,
  stopServer,
  summary,
  test,
} from './helpers.mjs'

const KEY = process.env.MOLLIE_TEST_API_KEY
if (!KEY || !KEY.startsWith('test_')) {
  console.error('MOLLIE_TEST_API_KEY (test_...) ontbreekt')
  process.exit(1)
}

const PORT = 8802
const EMAIL = 'e2e@test.nl'
const { proc, base } = await startServer({ port: PORT, mollieKey: KEY })

try {
  let orderId = ''
  let checkoutUrl = ''

  await test('checkout maakt een echte Mollie-testbetaling aan', async () => {
    const r = await jsonReq(base, '/api/checkout', {
      method: 'POST',
      body: {
        firstName: 'End',
        lastName: 'Toend',
        email: EMAIL,
        items: [{ productId: 'ticket-weekend-2026', qty: 1 }],
      },
    })
    assertEq(r.status, 200, 'status')
    checkoutUrl = r.data.checkoutUrl
    assert(checkoutUrl.startsWith('https://www.mollie.com/'), 'checkout-URL van Mollie')
  })

  await test('betaling afronden op de Mollie-testpagina (iDEAL, Betaald)', async () => {
    const browser = await chromium.launch({ headless: true })
    try {
      const page = await browser.newPage()
      await page.goto(checkoutUrl, { waitUntil: 'domcontentloaded' })
      await page.click('button[value="ideal"]', { timeout: 20_000 })
      await page.click('button[name="issuer"]', { timeout: 20_000 })
      await page.check('input[name="final_state"][value="paid"]', { timeout: 20_000 })
      await page.click('button[name="submit"]')
      await page.waitForURL('**/bedankt**', { timeout: 30_000 })
      orderId = new URL(page.url()).searchParams.get('order')
      assert(orderId, 'order-id in redirect')
    } finally {
      await browser.close()
    }
  })

  await test('order wordt betaald (statussync met Mollie)', async () => {
    for (let i = 0; i < 30; i++) {
      const r = await jsonReq(base, `/api/order/${orderId}`)
      if (r.data?.status === 'paid') {
        assertEq(r.data.seatQuota, 1, 'plek te claimen')
        return
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    throw new Error('order werd niet betaald binnen 60s')
  })

  await test('plek claimen na betaling', async () => {
    const cookie = sessionCookie(EMAIL)
    let r = await jsonReq(base, '/api/seats/claim', {
      method: 'POST',
      body: { orderId, seatId: 'r7c12', nickname: 'E2E-er' },
    })
    assertEq(r.status, 200, 'claim')
    r = await jsonReq(base, '/api/seats', { cookie })
    assert(r.data.seats.some((s) => s.seatId === 'r7c12' && s.nickname === 'E2E-er'), 'plek op de kaart')
  })
} finally {
  stopServer(proc)
}

process.exitCode = summary('e2e-mollie') > 0 ? 1 : 0
