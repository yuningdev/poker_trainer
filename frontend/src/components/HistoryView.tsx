import { useState } from 'react'
import { useHistoryStore, type GameRecord } from '../store/historyStore'

interface Props {
  onBack: () => void
  onNewGame: () => void
}

export default function HistoryView({ onBack, onNewGame }: Props) {
  const records = useHistoryStore((s) => s.records)
  const [expanded, setExpanded] = useState<number | null>(null)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition text-sm"
        >
          ← Back to Game
        </button>
        <h1 className="text-xl font-bold text-white">Game History</h1>
        <button
          onClick={onNewGame}
          className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-semibold transition"
        >
          New Game
        </button>
      </div>

      {/* Records */}
      <div className="flex-1 overflow-y-auto px-6 py-4 max-w-2xl mx-auto w-full">
        {records.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-4xl mb-3">🃏</p>
            <p>No games yet. Play a game to see history here.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {records.map((r) => (
              <GameRecordCard
                key={r.id}
                record={r}
                expanded={expanded === r.id}
                onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function GameRecordCard({
  record,
  expanded,
  onToggle,
}: {
  record: GameRecord
  expanded: boolean
  onToggle: () => void
}) {
  const date = new Date(record.date)
  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-gray-750 transition"
      >
        <div>
          <p className="font-semibold text-white">
            🏆 <span className="text-yellow-300">{record.winner}</span> won with{' '}
            <span className="text-yellow-300">{record.winnerChips}</span> chips
          </p>
          <p className="text-sm text-gray-400 mt-0.5">
            {record.handsPlayed} hands · {dateStr}
          </p>
        </div>
        <span className="text-gray-400 text-sm ml-4">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-700 px-5 py-3 max-h-72 overflow-y-auto">
          <div className="flex flex-col gap-1">
            {record.log.map((entry) => (
              <p key={entry.id} className="text-sm text-gray-300">
                <span className="text-gray-500 mr-2">{entry.player}</span>
                {entry.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
