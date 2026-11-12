import { useState } from 'react'

/** Image with the design's fallback: the name's first letter on a card tile when the image is missing or fails. */
export function Img({ src, name, className = '' }: { src: string; name: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={name}
        className={`flex items-center justify-center bg-card text-2xl font-bold text-gold/80 ${className}`}
      >
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }
  return <img src={src} alt={name} loading="lazy" onError={() => setFailed(true)} className={`object-cover ${className}`} />
}
