import { useRef, useLayoutEffect } from 'react'
import type { CardData } from '../types'

interface Props {
  card?: CardData
  faceDown?: boolean
  size?: 'sm' | 'md' | 'lg'
  dealDelay?: number
  getDealerEl?: () => HTMLDivElement | null
}

const SIZE = {
  sm: 'w-8 h-12 text-xs',
  md: 'w-10 h-14 text-sm sm:w-12 sm:h-16 sm:text-base',
  lg: 'w-12 h-16 text-sm sm:w-14 sm:h-20 sm:text-base',
}

const RED_SUITS = new Set(['♥', '♦'])

export default function Card({ card, faceDown = false, size = 'md', dealDelay, getDealerEl }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // On mount: measure offset from this card to the dealer seat and inject CSS vars.
  // useLayoutEffect with [] runs once on mount — cards are re-mounted each hand via key change.
  useLayoutEffect(() => {
    if (!getDealerEl || !ref.current) return
    const dealerEl = getDealerEl()
    if (!dealerEl) return

    const dRect = dealerEl.getBoundingClientRect()
    const cRect = ref.current.getBoundingClientRect()
    const dx = dRect.left + dRect.width / 2 - (cRect.left + cRect.width / 2)
    const dy = dRect.top + dRect.height / 2 - (cRect.top + cRect.height / 2)

    ref.current.style.setProperty('--deal-from-x', `${dx}px`)
    ref.current.style.setProperty('--deal-from-y', `${dy}px`)
    // Tilt card slightly in the direction it's flying from
    ref.current.style.setProperty('--deal-rotate', `${dx > 0 ? 8 : -8}deg`)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shouldAnimate = getDealerEl !== undefined || dealDelay !== undefined
  const animStyle: React.CSSProperties | undefined = shouldAnimate && dealDelay !== undefined
    ? { animationDelay: `${dealDelay}ms` }
    : undefined
  const animClass = shouldAnimate ? 'deal-card' : ''

  const cls = `${SIZE[size]} rounded-lg border-2 flex flex-col items-center justify-center font-bold select-none shadow ${animClass}`

  if (faceDown || !card) {
    return (
      <div ref={ref} className={`${cls} bg-blue-900 border-blue-700 text-blue-500`} style={animStyle}>
        🂠
      </div>
    )
  }

  const isRed = RED_SUITS.has(card.suit)
  const color = isRed ? 'text-red-500' : 'text-gray-900'

  return (
    <div ref={ref} className={`${cls} bg-white border-gray-300 ${color}`} style={animStyle}>
      <span>{card.rank}</span>
      <span>{card.suit}</span>
    </div>
  )
}
