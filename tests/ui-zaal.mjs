/*
 * UI-test op de plattegrond met een echte browser. Dekt wat de API-tests niet
 * zien: dat elke plek zijn eigen naamveld heeft, dat het veld voor de volgende
 * plek leeg is (en niet stilletjes de vorige naam overneemt), dat de deelbare
 * link er staat, en dat wie een plek toegestuurd kreeg alleen zijn eigen naam
 * kan wijzigen.
 */
import { chromium } from 'playwright'
import {
  assert,
  assertEq,
  jsonReq,
  makeToken,
  startServer,
  stopServer,
  summary,
  test,
} from './helpers.mjs'

const PORT = 8802
const { proc, base } = await startServer({ port: PORT, mollieKey: 'fake' })
const browser = await chromium.launch()

const openAs = async (email) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1300 } })
  await ctx.addCookies([
    { name: 'legolan_sessie', value: await makeToken(email), domain: 'localhost', path: '/' },
  ])
  const page = await ctx.newPage()
  const fouten = []
  page.on('pageerror', (e) => fouten.push(e.message))
  page.fouten = fouten
  await page.goto(`${base}/zaal`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(700)
  return page
}

const kaart = async (email) =>
  (await jsonReq(base, '/api/seats', { cookie: `legolan_sessie=${await makeToken(email)}` })).data
    .seats

try {
  await jsonReq(base, '/api/checkout', {
    method: 'POST',
    body: {
      firstName: 'Duo',
      lastName: 'Boeker',
      email: 'duo@test.nl',
      turnstileToken: 't',
      items: [{ productId: 'ticket-weekend-2026', qty: 2 }],
    },
  })

  const koper = await openAs('duo@test.nl')
  const naamVeld = koper.getByLabel(/Gamernaam voor de plek/)

  await test('twee plekken, elk met zijn eigen naam', async () => {
    await naamVeld.fill('Electrochris')
    await koper.getByTitle(/Plek 20 - vrij/).click()
    await koper.waitForTimeout(900)

    assertEq(await naamVeld.inputValue(), '', 'naamveld leeg voor de volgende plek')

    await naamVeld.fill('Vriendje')
    await koper.getByLabel(/E-mailadres van wie op deze plek zit/).fill('vriend@test.nl')
    await koper.getByTitle(/Plek 21 - vrij/).click()
    await koper.waitForTimeout(1200)

    const seats = await kaart('duo@test.nl')
    assertEq(seats.length, 2, 'twee plekken bezet')
    const namen = seats.map((s) => s.nickname).sort()
    assertEq(namen.join(','), 'Electrochris,Vriendje', 'twee verschillende namen')
    assert(
      (await koper.locator('p.text-bulb').first().innerText()).includes('vriend@test.nl'),
      'melding noemt de verstuurde inloglink',
    )
  })

  await test('deelbare link staat klaar zolang er plekken vrij zijn', async () => {
    // Beide plekken zijn nu geclaimd, dus de claimbox (met de link) is weg.
    assertEq(await koper.getByLabel(/Deelbare link/).count(), 0, 'link weg als alles geclaimd is')

    const solo = await jsonReq(base, '/api/checkout', {
      method: 'POST',
      body: {
        firstName: 'Solo',
        lastName: 'Koper',
        email: 'solo@test.nl',
        turnstileToken: 't',
        items: [{ productId: 'ticket-weekend-2026', qty: 1 }],
      },
    })
    const orderId = solo.data.checkoutUrl.split('order=')[1]

    const page = await openAs('solo@test.nl')
    const link = await page.getByLabel(/Deelbare link/).inputValue()
    assert(link.includes(`/zaal?order=${orderId}`), `link wijst naar de bestelling: ${link}`)
    await page.close()
  })

  await test('gekoppelde bezoeker beheert alleen zijn eigen plek', async () => {
    const vriend = await openAs('vriend@test.nl')
    const blok = vriend.locator('section.neon-box')
    assertEq(await blok.locator('li').count(), 1, 'ziet alleen zijn eigen plek')
    assertEq(await blok.getByRole('button', { name: /Vrijgeven/ }).count(), 0, 'geen vrijgeefknop')
    assertEq(await blok.locator('input[type=email]').count(), 0, 'geen e-mailveld')

    await blok.locator('li input').first().fill('Vriend Zelf')
    await blok.getByRole('button', { name: /Opslaan/ }).click()
    await vriend.waitForTimeout(1000)

    const seats = await kaart('duo@test.nl')
    assert(
      seats.some((s) => s.nickname === 'Vriend Zelf'),
      'nieuwe naam staat op de kaart',
    )
    assert(
      seats.some((s) => s.nickname === 'Electrochris'),
      'plek van de koper ongemoeid',
    )
    assertEq(vriend.fouten.length, 0, `geen js-fouten: ${vriend.fouten.join(' | ')}`)
    await vriend.close()
  })

  assertEq(koper.fouten.length, 0, `geen js-fouten bij de koper: ${koper.fouten.join(' | ')}`)
} finally {
  await browser.close()
  stopServer(proc)
}

process.exit(summary('ui-zaal') === 0 ? 0 : 1)
