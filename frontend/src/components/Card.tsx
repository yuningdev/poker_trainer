import type { CardData } from '../types'

interface Props {
  card?: CardData
  faceDown?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE = {
  sm: 'w-8 h-12 text-xs',
  md: 'w-12 h-16 text-sm',
  lg: 'w-14 h-20 text-base',
}

const RED_SUITS = new Set(['♥', '♦'])

export default function Card({ card, faceDown = false, size = 'md' }: Props) {
  const cls = `${SIZE[size]} rounded-lg border-2 flex flex-col items-center justify-center font-bold select-none shadow`

  if (faceDown || !card) {
    return (
      <div className={`${cls} bg-blue-800 border-blue-600 text-blue-400`}>
        🂠
      </div>
    )
  }

  const isRed = RED_SUITS.has(card.suit)
  const color = isRed ? 'text-red-500' : 'text-gray-100'

  return (
    <div className={`${cls} bg-white border-gray-300 ${color}`}>
      <span>{card.rank}</span>
      <span>{card.suit}</span>
    </div>
  )
}
