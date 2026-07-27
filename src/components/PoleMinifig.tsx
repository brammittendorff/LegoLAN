/** Silhouet van een minifiguur aan een paal. Puur decoratie, jaarlijks vervangbaar. */
export default function PoleMinifig({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 200" className={className} aria-hidden="true">
      <g fill="currentColor">
        {/* de paal (voor de netwerkkabels, uiteraard) */}
        <rect x="57" y="4" width="6" height="192" rx="3" />
        <g transform="rotate(-16 60 100)">
          {/* nopje + hoofd */}
          <rect x="26" y="52" width="10" height="7" rx="2" />
          <rect x="20" y="59" width="22" height="17" rx="5" />
          {/* romp */}
          <path d="M22 79 L44 79 L48 106 L18 106 Z" />
          {/* arm naar de paal */}
          <rect x="41" y="80" width="21" height="8" rx="4" transform="rotate(6 41 80)" />
          {/* benen in actie */}
          <rect x="21" y="106" width="11" height="27" rx="3" transform="rotate(16 21 106)" />
          <rect x="34" y="105" width="11" height="30" rx="3" transform="rotate(-32 34 105)" />
        </g>
      </g>
    </svg>
  )
}
