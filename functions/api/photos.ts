import { editionsForEmail, emailFromRequest } from '../../server/auth'
import { err, json } from '../../server/http'
import { listObjects, presignGetObject, wasabiConfigured } from '../../server/s3'
import type { Env } from '../../server/types'

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif)$/i

/** De albums van de ingelogde bezoeker: alleen edities waar diegene bij was. */
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const email = await emailFromRequest(env, request)
  if (!email) return err('Niet ingelogd.', 401)

  const editions = await editionsForEmail(env, email)

  if (!wasabiConfigured(env)) {
    return json({
      configured: false,
      albums: editions.map((edition) => ({ edition, photos: [] })),
    })
  }

  const albums = await Promise.all(
    editions.map(async (edition) => {
      try {
        const keys = (await listObjects(env, `${edition}/`)).filter((k) => IMAGE_RE.test(k))
        const photos = await Promise.all(
          keys.map(async (key) => ({ key, url: await presignGetObject(env, key, 3600) })),
        )
        return { edition, photos }
      } catch (e) {
        console.error(`album ${edition} laden mislukt`, e)
        return { edition, photos: [] }
      }
    }),
  )

  return json({ configured: true, albums })
}
