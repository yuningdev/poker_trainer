import { useGameStore } from '../store/gameStore'

export default function PotDisplay() {
  const { pot, handNum } = useGameStore()

  return (
    <div className="flex items-center gap-2 sm:gap-4 text-center">
      <div className="text-[10px] sm:text-sm text-gray-400">
        Hand <span className="text-white font-bold">#{handNum}</span>
      </div>
      <div className="bg-yellow-900/40 border border-yellow-700 rounded-full px-2 sm:px-4 py-0.5 sm:py-1">
        <span className="text-yellow-400 font-bold text-sm sm:text-lg">Pot: {pot}</span>
      </div>
    </div>
  )
}
