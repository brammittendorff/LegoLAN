import { useCopy } from '../theme'

export default function MarqueeStrip() {
  const c = useCopy()
  // Twee keer dezelfde reeks zodat de -50%-loop naadloos is.
  const words = [...c.marqueeWords, ...c.marqueeWords]

  return (
    <div className="overflow-hidden border-y border-neon/25 bg-velvet py-3" aria-hidden="true">
      <div className="marquee-track">
        {words.map((w, i) => (
          <span
            key={i}
            className={`whitespace-nowrap font-label text-sm tracking-[0.25em] ${
              i % 2 === 0 ? 'neon-text' : 'neon-text-gold'
            }`}
          >
            ★ {w}
          </span>
        ))}
      </div>
    </div>
  )
}
