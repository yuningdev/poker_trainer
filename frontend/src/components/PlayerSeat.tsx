import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayerData } from '../types'
import { useGameStore } from '../store/gameStore'
import { useDealContext } from '../context/DealContext'
import Card from './Card'
import { ChipStack } from './ChipStack'

interface Props {
  player: PlayerData
  dealDelays: [number, number]  // [card0Delay ms, card1Delay ms] – clockwise stagger
  positionLabel?: string
  equity?: number | null        // kept in signature but no longer rendered here (see InfoPanel)
  actionLabel?: string | null   // last action in this round
}

function actionToastColor(label: string): string {
  if (label === 'FOLD')           return 'text-gray-400'
  if (label === 'CHECK')          return 'text-gray-200'
  if (label.startsWith('CALL'))   return 'text-blue-300'
  if (label.startsWith('RAISE'))  return 'text-green-300'
  if (label === 'ALL-IN')         return 'text-amber-300'
  return 'text-gray-300'
}

function actionLabelColor(label: string): string {
  if (label === 'FOLD')            return 'bg-gray-700 text-gray-400'
  if (label === 'CHECK')           return 'bg-gray-600 text-gray-300'
  if (label.startsWith('CALL'))    return 'bg-gray-600 text-gray-200'
  if (label.startsWith('RAISE'))   return 'bg-gray-500 text-white'
  if (label === 'ALL-IN')          return 'bg-gray-700 text-amber-200'
  return 'bg-gray-700 text-gray-400'
}

const POSITION_BADGE: Record<string, string> = {
  'SB':     'bg-[#c9a84c] text-[#0d1117] font-bold',
  'BB':     'bg-[#c9a84c] text-[#0d1117] font-bold',
  'BTN':    'bg-[#c9a84c] text-[#0d1117] font-bold',
  'SB/BTN': 'bg-[#c9a84c] text-[#0d1117] font-bold',
  'CO':     'bg-[#2a3347] text-gray-300',
  'HJ':     'bg-[#2a3347] text-gray-300',
  'LJ':     'bg-[#2a3347] text-gray-300',
  'UTG':    'bg-[#2a3347] text-gray-300',
  'UTG+1':  'bg-[#2a3347] text-gray-300',
  'UTG+2':  'bg-[#2a3347] text-gray-300',
}

export default function PlayerSeat({ player, dealDelays, positionLabel, actionLabel }: Props) {
  const { showdown, pendingAction, dealRevision, started, lastResult, pendingNewHand, thinkingPlayer, thinkingPlayerName, roomConfig } = useGameStore()
  const bigBlind = roomConfig?.big_blind ?? 20
  const dealCtx = useDealContext()

  // Register this seat's DOM element so the dealer origin can be looked up
  const handleRef = useCallback((el: HTMLDivElement | null) => {
    dealCtx?.registerSeat(player.name, el)
  }, [player.name, dealCtx])

  const showdownInfo = showdown?.find((s) => s.name === player.name)
  const displayCards = showdownInfo?.hole_cards ?? player.hole_cards
  const isWaiting = pendingAction !== null && player.is_human

  // Show thinking animation only on the specific bot whose turn it is.
  const isThinking = !player.is_human
    && player.status === 'active'
    && thinkingPlayer !== null
    && player.name === thinkingPlayerName
    && started
    && showdown === null
    && lastResult === null
    && !pendingNewHand

  // ── Action flash toast (appears above this seat, fades out after 1.6s) ──────
  const [flashLabel, setFlashLabel] = useState<string | null>(null)
  const [flashVisible, setFlashVisible] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevLabelRef = useRef<string | null | undefined>(null)

  useEffect(() => {
    // Only fire when the label changes to a new non-null value
    if (!actionLabel || actionLabel === prevLabelRef.current) return
    prevLabelRef.current = actionLabel

    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashLabel(actionLabel)
    setFlashVisible(true)
    flashTimerRef.current = setTimeout(() => setFlashVisible(false), 1500)
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current) }
  }, [actionLabel])

  // DiceBear avatar URL
  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=b6e3f4`

  const positionBadgeClass = positionLabel
    ? (POSITION_BADGE[positionLabel] ?? 'bg-[#2a3347] text-gray-300')
    : ''

  // ── Flash toast (shared) ─────────────────────────────────────────────────────
  const flashToast = flashLabel ? (
    <div
      className={`absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap pointer-events-none z-20
        transition-opacity duration-300 ${flashVisible ? 'opacity-100' : 'opacity-0'}`}
    >
      <span className={`text-sm font-black px-2 py-0.5 rounded-lg bg-black/80 shadow-lg ${actionToastColor(flashLabel)}`}>
        {flashLabel}
      </span>
    </div>
  ) : null

  // ── BOT layout ───────────────────────────────────────────────────────────────
  if (!player.is_human) {
    const isFolded = player.status === 'folded'
    const isBust   = player.status === 'bust'

    return (
      <div
        ref={handleRef}
        className={`relative flex flex-col items-center gap-1 p-2 rounded-xl
          w-28
          bg-[#1e2433] border border-[#2a3347]
          shadow-lg shadow-black/50
          ${isFolded || isBust ? 'opacity-40' : ''}
          ${isThinking ? 'ring-2 ring-yellow-400/60 scale-105 animate-pulse' : ''}
          transition-transform duration-200
        `}
      >
        {/* Position badge — top-left */}
        {positionLabel && (
          <span className={`absolute -top-3 -left-3 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap
            ${positionBadgeClass}`}>
            {positionLabel}
          </span>
        )}

        {/* Flash toast */}
        {flashToast}

        {/* Avatar */}
        <img
          src={avatarUrl}
          alt={player.name}
          className="w-8 h-8 rounded-full object-cover bg-[#2a3347]"
        />

        {/* Name */}
        <span className="text-white font-semibold text-xs truncate w-full text-center">
          {player.name}
        </span>

        {/* Thinking indicator */}
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

        {/* Hand description at showdown — shown for bots too */}
        {showdownInfo && (
          <span className="text-[9px] text-gray-300 text-center leading-tight">
            {showdownInfo.hand_description}
          </span>
        )}

        {/* Chip stack visual */}
        {player.status !== 'bust' && player.chips > 0 && (
          <ChipStack chips={player.chips} bigBlind={bigBlind} maxStack={4} scale={0.85} />
        )}

        {/* Chip count + action label */}
        <div className="flex items-center flex-wrap justify-center gap-1">
          <span className="text-[#c9a84c] font-bold text-sm">{player.chips}</span>
          {actionLabel && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionLabelColor(actionLabel)}`}>
              {actionLabel}
            </span>
          )}
        </div>
      </div>
    )
  }

  // ── HUMAN layout ─────────────────────────────────────────────────────────────
  return (
    <div
      ref={handleRef}
      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-2xl
        w-36 sm:w-40
        bg-[#1e2433] border-2 border-[#c9a84c]/30
        shadow-xl shadow-black/60
        ${isWaiting ? 'ring-2 ring-white/60' : ''}
        transition-transform duration-200
      `}
    >
      {/* Position badge — top-left */}
      {positionLabel && (
        <span className={`absolute -top-3 -left-3 text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap
          ${positionBadgeClass}`}>
          {positionLabel}
        </span>
      )}

      {/* "You" label — top-right */}
      <span className="absolute -top-3 -right-3 text-[10px] px-1.5 py-0.5 rounded-full
        bg-[#c9a84c]/20 text-[#c9a84c] font-bold border border-[#c9a84c]/40 whitespace-nowrap">
        You
      </span>

      {/* Flash toast */}
      {flashToast}

      {/* Avatar + name row */}
      <div className="flex items-center gap-1.5 w-full">
        <img
          src={avatarUrl}
          alt={player.name}
          className="w-8 h-8 rounded-full object-cover bg-[#2a3347] shrink-0"
        />
        <span className="text-white font-semibold text-xs truncate flex-1">
          {player.name}
        </span>
      </div>

      {/* Hole cards — prominently shown */}
      <div className="flex gap-1.5 justify-center">
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

      {/* Chip stack visual */}
      {player.status !== 'bust' && player.chips > 0 && (
        <ChipStack chips={player.chips} bigBlind={bigBlind} maxStack={4} scale={0.9} />
      )}

      {/* Chip count + action label */}
      <div className="flex items-center flex-wrap justify-center gap-1">
        <span className="text-[#c9a84c] font-bold text-sm">{player.chips}</span>
        {actionLabel && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${actionLabelColor(actionLabel)}`}>
            {actionLabel}
          </span>
        )}
      </div>
    </div>
  )
}
