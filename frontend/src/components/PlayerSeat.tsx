import { useCallback } from 'react'
import type { PlayerData } from '../types'
import { useGameStore } from '../store/gameStore'
import { useDealContext } from '../context/DealContext'
import Card from './Card'

interface Props {
  player: PlayerData
  dealDelays: [number, number]  // [card0Delay ms, card1Delay ms] – clockwise stagger
  positionLabel?: string
  equity?: number | null        // only set for the human player
  actionLabel?: string | null   // last action in this round
}

function actionLabelColor(label: string): string {
  switch (label) {
    case 'FOLD':   return 'bg-gray-700 text-gray-400'
    case 'CHECK':  return 'bg-gray-600 text-gray-300'
    case 'CALL':   return 'bg-gray-600 text-gray-200'
    case 'RAISE':  return 'bg-gray-500 text-white'
    case 'ALL-IN': return 'bg-gray-700 text-amber-200'
    default:       return 'bg-gray-700 text-gray-400'
  }
}

const STATUS_BORDER: Record<string, string> = {
  active: 'border-white/60',
  folded: 'border-gray-600 opacity-50',
  all_in: 'border-amber-200',
  bust:   'border-gray-800',
}

const POSITION_COLOR: Record<string, string> = {
  'SB':     'bg-blue-700 text-white',
  'BB':     'bg-blue-700 text-white',
  'BTN':    'bg-blue-700 text-white',
  'SB/BTN': 'bg-blue-700 text-white',
  'CO':     'bg-gray-600 text-gray-200',
  'HJ':     'bg-gray-600 text-gray-200',
  'LJ':     'bg-gray-600 text-gray-200',
  'UTG':    'bg-gray-600 text-gray-200',
  'UTG+1':  'bg-gray-600 text-gray-200',
  'UTG+2':  'bg-gray-600 text-gray-200',
}

export default function PlayerSeat({ player, dealDelays, positionLabel, equity, actionLabel }: Props) {
  const { showdown, pendingAction, dealRevision } = useGameStore()
  const dealCtx = useDealContext()

  // Register this seat's DOM element so the dealer origin can be looked up
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    dealCtx?.registerSeat(player.name, el)
  }, [player.name, dealCtx])

  const showdownInfo = showdown?.find((s) => s.name === player.name)
  const displayCards = showdownInfo?.hole_cards ?? player.hole_cards
  const isWaiting = pendingAction !== null && player.is_human

  return (
    <div
      ref={handleRef}
      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border-2
        w-24 sm:w-28
        ${STATUS_BORDER[player.status] ?? 'border-gray-600'}
        ${player.is_human ? 'bg-green-950/50' : 'bg-gray-800/70'}
        ${isWaiting ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-gray-900' : ''}
      `}
    >
      {positionLabel && (
        <span className={`absolute -top-3 -left-3 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow whitespace-nowrap
          ${POSITION_COLOR[positionLabel] ?? 'bg-gray-600 text-white'}`}>
          {positionLabel}
        </span>
      )}

      {/* Name */}
      <span className={`text-xs font-bold truncate w-full text-center ${player.is_human ? 'text-green-300' : 'text-gray-200'}`}>
        {player.is_human ? `★ ${player.name}` : player.name}
      </span>

      {/* Equity badge (human only) */}
      {equity != null && (
        <div className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300 border border-gray-600 mb-1">
          ~{equity}% (2&4)
        </div>
      )}

      {/* Hole cards */}
      <div className="flex gap-1">
        {displayCards.length > 0 ? (
          displayCards.map((c, i) => (
            <Card
              key={`${dealRevision}-${i}`}
              card={c}
              size="sm"
              dealDelay={dealDelays[i] ?? 0}
              getDealerEl={dealCtx?.getDealerEl}
            />
          ))
        ) : player.status !== 'folded' ? (
          <>
            <Card key={`${dealRevision}-back-0`} faceDown size="sm" dealDelay={dealDelays[0]} getDealerEl={dealCtx?.getDealerEl} />
            <Card key={`${dealRevision}-back-1`} faceDown size="sm" dealDelay={dealDelays[1]} getDealerEl={dealCtx?.getDealerEl} />
          </>
        ) : (
          <span className="text-xs text-gray-500">folded</span>
        )}
      </div>

      {/* Hand description at showdown */}
      {showdownInfo && (
        <span className="text-[10px] text-gray-300 text-center leading-tight">
          {showdownInfo.hand_description}
        </span>
      )}

      {/* Chips + bet + action label */}
      <div className="text-xs text-gray-300 flex items-center flex-wrap justify-center gap-1">
        <span className="text-amber-200 font-semibold">{player.chips}</span>
        {player.current_bet > 0 && (
          <span className="text-gray-400">(+{player.current_bet})</span>
        )}
        {actionLabel && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${actionLabelColor(actionLabel)}`}>
            {actionLabel}
          </span>
        )}
      </div>
    </div>
  )
}
