import { useGameStore } from '../store/gameStore'
import HumanBustOverlay from './HumanBustOverlay'

export default function HandResultOverlay() {
  const { lastResult, gameOver } = useGameStore()

  if (gameOver) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
        <div className="bg-gray-800 border-2 border-yellow-500 rounded-2xl p-8 text-center shadow-2xl">
          <div className="text-4xl mb-2">🏆</div>
          <h2 className="text-yellow-400 text-2xl font-bold mb-1">Game Over</h2>
          <p className="text-white text-lg">
            <span className="text-yellow-300 font-bold">{gameOver.winner}</span> wins with{' '}
            <span className="text-yellow-300 font-bold">{gameOver.chips}</span> chips!
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-semibold"
          >
            Play Again
          </button>
        </div>
      </div>
    )
  }

  if (!lastResult) return <HumanBustOverlay />

  return (
    <>
      <HumanBustOverlay />
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
