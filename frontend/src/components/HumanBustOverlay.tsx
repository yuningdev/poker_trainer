import { useState } from 'react'
import { useGameStore } from '../store/gameStore'

interface Props {
  onPlayAgain: () => void
}

export default function HumanBustOverlay({ onPlayAgain }: Props) {
  const { humanBust, gameOver } = useGameStore()
  const [dismissed, setDismissed] = useState(false)

  // Don't show if already dismissed, not bust, or game is already over
  // (game-over overlay takes precedence)
  if (!humanBust || dismissed || gameOver) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-40">
      <div className="overlay-in bg-gray-900 border-2 border-red-700 rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full mx-4">
        <div className="text-5xl mb-3">💀</div>
        <h2 className="text-red-400 text-xl font-bold mb-1">You've been eliminated</h2>
        <p className="text-gray-400 text-sm mb-6">The remaining players are still competing.</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onPlayAgain}
            className="px-6 py-2.5 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl transition"
          >
            Play Again
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition"
          >
            Watch the rest
          </button>
        </div>
      </div>
    </div>
  )
}
