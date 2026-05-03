import { useCallback } from 'react'
import type { PlayerData } from '../types'
import { useGameStore } from '../store/gameStore'
import { useDealContext } from '../context/DealContext'
import Card from './Card'

interface Props {
  player: PlayerData
  dealDelays: [number, number]  // [card0Delay ms, card1Delay ms] – clockwise stagger
  positionLabel?: string
  equity?: number | null        // kept in signature but no longer rendered here (see InfoPanel)
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

const STATUS_BG: Record<string, string> = {
  active: 'bg-gray-800/80',
  folded: 'bg-gray-800/60 opacity-50',
  all_in: 'bg-amber-950/80',
  bust:   'bg-gray-900/40',
}

const POSITION_COLOR: Record<string, string> = {
  'SB':     'bg-blue-600 text-white shadow-sm',
  'BB':     'bg-blue-600 text-white shadow-sm',
  'BTN':    'bg-blue-600 text-white shadow-sm',
  'SB/BTN': 'bg-blue-600 text-white shadow-sm',
  'CO':     'bg-gray-500 text-white',
  'HJ':     'bg-gray-500 text-white',
  'LJ':     'bg-gray-500 text-white',
  'UTG':    'bg-gray-500 text-white',
  'UTG+1':  'bg-gray-500 text-white',
  'UTG+2':  'bg-gray-500 text-white',
}

export default function PlayerSeat({ player, dealDelays, positionLabel, actionLabel }: Props) {
  const { showdown, pendingAction, dealRevision, started, lastResult, pendingNewHand } = useGameStore()
  const dealCtx = useDealContext()

  // Register this seat's DOM element so the dealer origin can be looked up
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    dealCtx?.registerSeat(player.name, el)
  }, [player.name, dealCtx])

  const showdownInfo = showdown?.find((s) => s.name === player.name)
  const displayCards = showdownInfo?.hole_cards ?? player.hole_cards
  const isWaiting = pendingAction !== null && player.is_human

  // Show thinking animation on all active non-human players when it's not the
  // human's turn (pendingAction === null) and the game is live.
  const isThinking = !player.is_human
    && player.status === 'active'
    && pendingAction === null
    && started
    && showdown === null
    && lastResult === null
    && !pendingNewHand

  // Change 6: DiceBear avatar URL
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=b6e3f4`

  return (
    <div
      ref={handleRef}
      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl shadow-lg
        w-auto
        ${player.is_human ? 'bg-green-950/50' : (STATUS_BG[player.status] ?? 'bg-gray-800/80')}
        ${isWaiting ? 'ring-2 ring-white/70 ring-offset-1 ring-offset-gray-900' : ''}
        ${isThinking ? 'scale-105 ring-2 ring-yellow-400/60 ring-offset-1 ring-offset-gray-900 animate-pulse' : ''}
        transition-transform duration-200
      `}
    >
      {positionLabel && (
        <span className={`absolute -top-4 -left-4 text-xs font-bold px-2 py-0.5 rounded-full whitespace-nowrap
          ${POSITION_COLOR[positionLabel] ?? 'bg-gray-500 text-white'}`}>
          {positionLabel}
        </span>
      )}

      {/* Change 6: Avatar */}
      <img
        src={avatarUrl}
        alt={player.name}
        className={`rounded-full object-cover ${player.is_human ? 'w-10 h-10 bg-green-900' : 'w-8 h-8 bg-gray-700'}`}
      />

      {/* Name */}
      <span className={`text-xs font-bold truncate w-full text-center ${player.is_human ? 'text-green-300' : 'text-gray-200'}`}>
        {player.is_human ? `★ ${player.name}` : player.name}
      </span>

      {/* Thinking indicator – label + animated bouncing dots */}
      {isThinking && (
        <span className="flex flex-col items-center gap-0.5">
          <span className="text-[9px] text-yellow-400 font-semibold leading-none">Thinking</span>
          <span className="flex gap-0.5 items-center">
            <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </span>
      )}

      {/* Hole cards (Change 5: size="md") */}
      <div className="flex gap-1">
        {displayCards.length > 0 ? (
          displayCards.map((c, i) => (
            <Card
              key={`${dealRevision}-${i}`}
              card={c}
              size="md"
              dealDelay={dealDelays[i] ?? 0}
              getDealerEl={dealCtx?.getDealerEl}
            />
          ))
        ) : player.status !== 'folded' ? (
          <>
            <Card key={`${dealRevision}-back-0`} faceDown size="md" dealDelay={dealDelays[0]} getDealerEl={dealCtx?.getDealerEl} />
            <Card key={`${dealRevision}-back-1`} faceDown size="md" dealDelay={dealDelays[1]} getDealerEl={dealCtx?.getDealerEl} />
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
