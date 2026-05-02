import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { useDealContext } from '../context/DealContext'
import Card from './Card'

export default function CommunityCards() {
  const { communityCards, phase } = useGameStore()
  const dealCtx = useDealContext()

  // Track previous count to detect newly revealed cards
  const prevCountRef = useRef(0)
  const prevCount = prevCountRef.current

  useEffect(() => {
    prevCountRef.current = communityCards.length
  }, [communityCards.length])

  return (
    <div className="flex flex-col items-center gap-1 sm:gap-2">
      <span className="text-[10px] sm:text-xs text-gray-400 uppercase tracking-widest">
        {phase.replace('_', ' ')}
      </span>
      <div className="flex gap-1 sm:gap-2">
        {Array.from({ length: 5 }).map((_, i) => {
          const card = communityCards[i]
          const isNew = card !== undefined && i >= prevCount
          // Stagger within the newly revealed batch (0, 130, 260 ms for Flop)
          const delay = isNew ? (i - prevCount) * 130 : undefined
          // Always render all 5 slots; dealt cards show face-up, undealt show face-down
          return (
            <Card
              key={card ? `${card.rank}-${card.suit}` : `empty-${i}`}
              card={card}
              faceDown={!card}
              size="md"
              dealDelay={delay}
              getDealerEl={isNew ? dealCtx?.getDealerEl : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
