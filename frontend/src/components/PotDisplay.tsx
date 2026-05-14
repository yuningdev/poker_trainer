import { useGameStore } from '../store/gameStore'

export default function PotDisplay() {
  const { potBase, displayBets, handNum } = useGameStore()

  // Live pot = base (previous streets) + all current-street bets accumulated so far.
  // This updates in real time from ACTION_LOG without waiting for TABLE_STATE.
  const livePot = potBase + Object.values(displayBets).reduce((a, b) => a + b, 0)

  return (
    <div className="flex items-center gap-2 sm:gap-4 text-center">
      <div className="text-[10px] sm:text-sm text-gray-400">
        Hand <span className="text-white font-bold">#{handNum}</span>
      </div>
      <div className="bg-yellow-900/40 border border-yellow-700 rounded-full px-2 sm:px-4 py-0.5 sm:py-1">
        <span className="text-yellow-400 font-bold text-sm sm:text-lg">Pot: {livePot}</span>
      </div>
    </div>
  )
}
