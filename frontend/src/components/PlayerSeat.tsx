import type { PlayerData } from '../types'
import { useGameStore } from '../store/gameStore'
import Card from './Card'

interface Props {
  player: PlayerData
  isDealer: boolean
}

const STATUS_COLOR: Record<string, string> = {
  active: 'border-green-500',
  folded: 'border-gray-600 opacity-50',
  all_in: 'border-yellow-500',
  bust: 'border-red-800 opacity-30',
}

export default function PlayerSeat({ player, isDealer }: Props) {
  const { showdown, pendingAction } = useGameStore()

  // At showdown, find this player's revealed cards
  const showdownInfo = showdown?.find((s) => s.name === player.name)
  const displayCards = showdownInfo?.hole_cards ?? player.hole_cards
  const isWaiting = pendingAction !== null && player.is_human

  return (
    <div
      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 w-28
        ${STATUS_COLOR[player.status] ?? 'border-gray-600'}
        ${player.is_human ? 'bg-green-950/40' : 'bg-gray-800/60'}
        ${isWaiting ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-gray-900' : ''}
      `}
    >
      {isDealer && (
        <span className="absolute -top-3 -right-3 bg-white text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
          D
        </span>
      )}

      {/* Name */}
      <span className={`text-xs font-bold truncate w-full text-center ${player.is_human ? 'text-green-300' : 'text-gray-200'}`}>
        {player.is_human ? `★ ${player.name}` : player.name}
      </span>

      {/* Hole cards */}
      <div className="flex gap-1">
        {player.status === 'bust' ? (
          <span className="text-xs text-gray-500">bust</span>
        ) : displayCards.length > 0 ? (
          displayCards.map((c, i) => <Card key={i} card={c} size="sm" />)
        ) : player.status !== 'folded' ? (
          <>
            <Card faceDown size="sm" />
            <Card faceDown size="sm" />
          </>
        ) : (
          <span className="text-xs text-gray-500">folded</span>
        )}
      </div>

      {/* Hand description at showdown */}
      {showdownInfo && (
        <span className="text-[10px] text-yellow-300 text-center leading-tight">
          {showdownInfo.hand_description}
        </span>
      )}

      {/* Chips + bet */}
      <div className="text-xs text-gray-300">
        <span className="text-yellow-400 font-semibold">{player.chips}</span>
        {player.current_bet > 0 && (
          <span className="text-gray-400 ml-1">(+{player.current_bet})</span>
        )}
      </div>
    </div>
  )
}
