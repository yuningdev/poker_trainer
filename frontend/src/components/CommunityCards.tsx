import { useGameStore } from '../store/gameStore'
import Card from './Card'

export default function CommunityCards() {
  const { communityCards, phase } = useGameStore()

  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs text-gray-400 uppercase tracking-widest">
        {phase.replace('_', ' ')}
      </span>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} card={communityCards[i]} faceDown={!communityCards[i]} size="lg" />
        ))}
      </div>
    </div>
  )
}
