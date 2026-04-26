import { useGameStore } from '../store/gameStore'
import HumanBustOverlay from './HumanBustOverlay'

interface Props {
  onPlayAgain: () => void
  onViewHistory: () => void
}

export default function HandResultOverlay({ onPlayAgain, onViewHistory }: Props) {
  const { lastResult, gameOver } = useGameStore()

  if (gameOver) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 border-2 border-yellow-500 rounded-2xl p-8 text-center shadow-2xl max-w-sm w-full mx-4">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-yellow-400 text-2xl font-bold mb-1">Game Over</h2>
          <p className="text-white text-lg mb-4">
            <span className="text-yellow-300 font-bold">{gameOver.winner}</span> wins with{' '}
            <span className="text-yellow-300 font-bold">{gameOver.chips}</span> chips!
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onPlayAgain}
              className="px-6 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-xl font-bold transition"
            >
              Play Again
            </button>
            <button
              onClick={onViewHistory}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-xl text-sm transition"
            >
              View History
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!lastResult) return <HumanBustOverlay onPlayAgain={onPlayAgain} />

  return (
    <>
      <HumanBustOverlay onPlayAgain={onPlayAgain} />
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40
        bg-gray-800/95 border border-yellow-600 rounded-xl px-6 py-3 text-center shadow-xl
        animate-bounce-once">
        <p className="text-yellow-400 font-bold">
          {lastResult.winner} wins <span className="text-white">{lastResult.amount}</span> chips
        </p>
        <p className="text-gray-300 text-sm">{lastResult.hand}</p>
      </div>
    </>
  )
}
