/*
 * E-mailtemplate in de stijl van de site: donkere club, roze neon, gouden
 * lampjes. Alles inline-styled en in tabellen, want e-mailclients zijn
 * gevoelige wezens.
 */

const VOID = '#0b0612'
const VELVET = '#1a0e28'
const NEON = '#ff2e88'
const BULB = '#ffc96b'
const SMOKE = '#cdbbdf'
const MILK = '#fff6fb'
const GRAPE_BORDER = 'rgba(177,75,255,0.35)'

export type EmailOpts = {
  /** Grote regel bovenaan de kaart */
  heading: string
  /** Alinea's/HTML in de kaart (al ge-escaped waar nodig) */
  bodyHtml: string
  /** Optionele roze knop */
  cta?: { label: string; url: string }
  /** Regel onder de knop, bv. de losse link */
  afterCtaHtml?: string
}

const dots = (n: number): string =>
  Array.from({ length: n }, (_, i) => `<span style="color:${i % 2 ? NEON : BULB}">&bull;</span>`).join(
    '&nbsp;',
  )

export function renderEmail(opts: EmailOpts): string {
  const cta = opts.cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px auto 0 auto">
         <tr><td style="border-radius:999px;background:${NEON}">
           <a href="${opts.cta.url}"
              style="display:inline-block;padding:13px 30px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:${VOID};text-decoration:none;border-radius:999px">
             ${opts.cta.label}
           </a>
         </td></tr>
       </table>`
    : ''

  const afterCta = opts.afterCtaHtml
    ? `<p style="margin:18px 0 0 0;font-size:12px;line-height:1.6;color:${SMOKE};opacity:0.75;text-align:center;word-break:break-all">${opts.afterCtaHtml}</p>`
    : ''

  return `<!doctype html>
<html lang="nl">
<body style="margin:0;padding:0;background:${VOID}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${VOID}">
    <tr><td align="center" style="padding:32px 16px">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
        <tr><td align="center" style="padding:0 0 14px 0;font-size:12px;letter-spacing:4px">${dots(11)}</td></tr>

        <tr><td align="center" style="padding:0 0 22px 0">
          <div style="font-family:Georgia,'Times New Roman',serif;font-size:34px;font-weight:bold;letter-spacing:8px;color:${NEON}">LEGOLAN</div>
          <div style="font-family:'Courier New',monospace;font-size:11px;letter-spacing:5px;color:${BULB};padding-top:6px">STRIPCLUB&nbsp;EDITIE&nbsp;2026</div>
        </td></tr>

        <tr><td style="background:${VELVET};border:1px solid ${GRAPE_BORDER};border-radius:16px;padding:32px 30px">
          <h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:21px;color:${MILK}">${opts.heading}</h1>
          <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.7;color:${SMOKE}">
            ${opts.bodyHtml}
          </div>
          ${cta}
          ${afterCta}
        </td></tr>

        <tr><td align="center" style="padding:22px 0 0 0;font-size:12px;letter-spacing:4px">${dots(11)}</td></tr>

        <tr><td align="center" style="padding:16px 8px 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:${SMOKE};opacity:0.55">
          LEGOLAN wordt gedraaid door vrijwilligers. Deze mail is discreet verstuurd, zoals beloofd.<br>
          Niet gelieerd aan de LEGO Group. Of aan een echte stripclub. Echt niet.
        </td></tr>
      </table>

    </td></tr>
  </table>
</body>
</html>`
}

export function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
