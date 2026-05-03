import { useGameStore } from '../store/gameStore'
import Card from './Card'

interface Props {
  onFlush: () => void
}

/**
 * Full-screen modal shown when a hand ends.
 * Visible when both `lastResult` and `pendingNewHand` are set.
 * Host (or single-player) clicks "Next Hand" to advance; guests see a waiting message.
 */
export default function HandResultModal({ onFlush }: Props) {
  const { lastResult, pendingNewHand, showdown, communityCards, players, isCurrentPlayerHost } = useGameStore()

  // Only show when we have a result AND the next hand is queued
  if (!lastResult || !pendingNewHand) return null

  const winnerShowdown = showdown?.find((s) => s.name === lastResult.winner)
  const humanPlayer = players.find((p) => p.is_human)
  const humanShowdown = humanPlayer ? showdown?.find((s) => s.name === humanPlayer.name) : undefined
  const humanIsWinner = humanPlayer?.name === lastResult.winner

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-gray-900 border-2 border-yellow-500 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl flex flex-col gap-4">
        {/* Winner header */}
        <div className="text-center">
          <p className="text-yellow-400 text-2xl font-bold">
            {lastResult.winner} wins {lastResult.amount} chips
          </p>
          <p className="text-gray-300 text-base mt-1">{lastResult.hand}</p>
        </div>

        {/* Winner's hole cards */}
        {winnerShowdown && winnerShowdown.hole_cards.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-widest">
              {lastResult.winner}&apos;s cards
            </span>
            <div className="flex gap-2">
              {winnerShowdown.hole_cards.map((c, i) => (
                <Card key={`winner-${i}`} card={c} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Human's hole cards (only if human didn't win) */}
        {!humanIsWinner && humanShowdown && humanShowdown.hole_cards.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-widest">
              Your cards
            </span>
            <div className="flex gap-2">
              {humanShowdown.hole_cards.map((c, i) => (
                <Card key={`human-${i}`} card={c} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Community cards */}
        {communityCards.length > 0 && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-gray-400 uppercase tracking-widest">Board</span>
            <div className="flex gap-1 sm:gap-2 flex-wrap justify-center">
              {communityCards.map((c, i) => (
                <Card key={`board-${i}`} card={c} size="md" />
              ))}
            </div>
          </div>
        )}

        {/* Action button */}
        <div className="text-center mt-2">
          {isCurrentPlayerHost ? (
            <button
              onClick={onFlush}
              className="px-8 py-3 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded-xl transition text-base"
            >
              Next Hand &rarr;
            </button>
          ) : (
            <p className="text-gray-400 text-sm animate-pulse">
              Waiting for host to start next hand...
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
