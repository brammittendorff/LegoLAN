import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useLang } from '../lib/i18n'
import LoginForm from '../components/LoginForm'

type Albums = {
  configured: boolean
  albums: { edition: number; photos: { key: string; url: string }[] }[]
}

export default function Fotos() {
  const { t } = useLang()
  const { user, loading } = useAuth()
  const [params] = useSearchParams()
  const badLink = params.get('fout') === 'link'
  const [albums, setAlbums] = useState<Albums | null>(null)

  useEffect(() => {
    if (!user) {
      setAlbums(null)
      return
    }
    api
      .photos()
      .then(setAlbums)
      .catch(() => setAlbums({ configured: false, albums: [] }))
  }, [user])

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="text-center">
        <h1 className="neon-script text-6xl md:text-7xl">{t("de foto's", 'the photos')}</h1>
        <p className="mt-4 text-smoke/80">
          {t(
            'Wat er op LEGOLAN gebeurt, blijft op LEGOLAN. Behalve als je erbij was: dan mag je kijken.',
            'What happens at LEGOLAN stays at LEGOLAN. Unless you were there: then you get to look.',
          )}
        </p>
      </header>

      {loading && <p className="mt-16 text-center text-smoke/70">{t('Laden...', 'Loading...')}</p>}

      {!loading && !user && (
        <div className="mx-auto mt-12 max-w-md">
          {badLink && (
            <p className="mb-6 text-center text-sm text-neon-soft">
              {t(
                'Die inloglink is verlopen of niet geldig. Vraag hieronder een nieuwe aan.',
                'That sign-in link is expired or invalid. Request a new one below.',
              )}
            </p>
          )}
          <LoginForm next="/fotos" />
        </div>
      )}

      {!loading && user && (
        <div className="mt-12">
          {user.editions.length === 0 && (
            <p className="text-center text-smoke/80">
              {t(
                'We konden geen edities aan dit adres koppelen. Ticket met een ander mailadres gekocht? Probeer dat, of stuur ons een berichtje.',
                'We could not link any editions to this address. Bought your ticket with a different email? Try that one, or drop us a message.',
              )}
            </p>
          )}

          {albums === null && user.editions.length > 0 && (
            <p className="text-center text-smoke/70">{t('Albums laden...', 'Loading albums...')}</p>
          )}

          {albums && !albums.configured && user.editions.length > 0 && (
            <p className="text-center text-smoke/80">
              {t(
                `Je hebt toegang tot: ${user.editions.join(', ')}. De albums worden nog gevuld - kom snel terug.`,
                `You have access to: ${user.editions.join(', ')}. The albums are still being filled - check back soon.`,
              )}
            </p>
          )}

          {albums?.configured &&
            albums.albums.map((album) => (
              <section key={album.edition} className="mt-14 first:mt-0">
                <h2 className="text-center">
                  <span className="neon-script text-4xl">LEGOLAN {album.edition}</span>
                </h2>
                {album.photos.length === 0 ? (
                  <p className="mt-4 text-center text-sm text-smoke/70">
                    {t(
                      'Nog geen foto\'s in dit album. De fotograaf is "aan het nabewerken".',
                      'No photos in this album yet. The photographer is "still editing".',
                    )}
                  </p>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {album.photos.map((photo) => (
                      <a
                        key={photo.key}
                        href={photo.url}
                        target="_blank"
                        rel="noreferrer"
                        className="card-velvet block overflow-hidden transition-shadow hover:shadow-[0_0_16px_rgb(255_46_136/0.4)]"
                      >
                        <img
                          src={photo.url}
                          alt=""
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </section>
            ))}
        </div>
      )}
    </div>
  )
}
