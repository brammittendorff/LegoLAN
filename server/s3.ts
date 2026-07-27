import type { Env } from './types'

/*
 * Minimale S3 SigV4-presigner voor Wasabi (geen dependencies; Workers-crypto).
 * We geven de browser tijdelijke (1 uur) getekende URLs; de bucket zelf
 * blijft privé.
 */

export function wasabiConfigured(env: Env): boolean {
  return !!(
    env.WASABI_ENDPOINT &&
    env.WASABI_BUCKET &&
    env.WASABI_ACCESS_KEY_ID &&
    env.WASABI_SECRET_ACCESS_KEY
  )
}

const enc = new TextEncoder()

const hex = (buf: ArrayBuffer): string =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

const sha256Hex = async (data: string): Promise<string> =>
  hex(await crypto.subtle.digest('SHA-256', enc.encode(data)))

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key instanceof Uint8Array ? (key as Uint8Array<ArrayBuffer>) : new Uint8Array(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}

// S3-stijl URI-encoding (RFC 3986: ook !'()* encoderen)
const rfc3986 = (s: string): string =>
  encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())

const encodeKeyPath = (key: string): string => key.split('/').map(rfc3986).join('/')

async function presign(
  env: Env,
  path: string,
  query: Record<string, string>,
  expiresS: number,
): Promise<string> {
  const endpoint = new URL(env.WASABI_ENDPOINT!)
  const region = env.WASABI_REGION || 'eu-central-1'
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'
  const date = amzDate.slice(0, 8)
  const scope = `${date}/${region}/s3/aws4_request`

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${env.WASABI_ACCESS_KEY_ID}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresS),
    'X-Amz-SignedHeaders': 'host',
    ...query,
  }
  const canonicalQuery = Object.keys(params)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(params[k])}`)
    .join('&')

  const canonicalRequest = [
    'GET',
    path,
    canonicalQuery,
    `host:${endpoint.host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(canonicalRequest)].join('\n')

  let signingKey: ArrayBuffer | Uint8Array = enc.encode('AWS4' + env.WASABI_SECRET_ACCESS_KEY)
  for (const part of [date, region, 's3', 'aws4_request']) {
    signingKey = await hmac(signingKey, part)
  }
  const signature = hex(await hmac(signingKey, stringToSign))

  return `${endpoint.origin}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/** Tijdelijke download-URL voor één object. */
export function presignGetObject(env: Env, key: string, expiresS = 3600): Promise<string> {
  return presign(env, `/${env.WASABI_BUCKET}/${encodeKeyPath(key)}`, {}, expiresS)
}

const decodeXml = (s: string): string =>
  s
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&apos;', "'")

/** Alle object-keys onder een prefix (max 1000; genoeg voor een fotoalbum). */
export async function listObjects(env: Env, prefix: string): Promise<string[]> {
  const url = await presign(
    env,
    `/${env.WASABI_BUCKET}`,
    { 'list-type': '2', prefix, 'max-keys': '1000' },
    300,
  )
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Wasabi list ${prefix}: ${res.status} ${await res.text()}`)
  }
  const xml = await res.text()
  return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => decodeXml(m[1]))
}
