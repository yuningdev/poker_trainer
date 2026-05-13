import { useCallback, useEffect, useRef, useState } from 'react'
import type { PlayerData } from '../types'
import { useGameStore } from '../store/gameStore'
import { useDealContext } from '../context/DealContext'
import Card from './Card'
import { ChipStack } from './ChipStack'

interface Props {
  player: PlayerData
  dealDelays: [number, number]
  positionLabel?: string
  equity?: number | null
  actionLabel?: string | null
}

// Position badge colours
const POSITION_BADGE: Record<string, string> = {
  'SB':     'bg-[#c9a84c] text-[#0d1117] font-bold',
  'BB':     'bg-[#c9a84c] text-[#0d1117] font-bold',
  'BTN':    'bg-[#c9a84c] text-[#0d1117] font-bold',
  'SB/BTN': 'bg-[#c9a84c] text-[#0d1117] font-bold',
  'CO':     'bg-[#2a3347] text-gray-300 font-semibold',
  'HJ':     'bg-[#2a3347] text-gray-300 font-semibold',
  'LJ':     'bg-[#2a3347] text-gray-300 font-semibold',
  'UTG':    'bg-[#2a3347] text-gray-300 font-semibold',
  'UTG+1':  'bg-[#2a3347] text-gray-300 font-semibold',
  'UTG+2':  'bg-[#2a3347] text-gray-300 font-semibold',
}

function actionLabelStyle(label: string): string {
  if (label === 'FOLD')           return 'bg-[#1e2433] text-gray-500'
  if (label === 'CHECK')          return 'bg-[#1e2433] text-gray-300'
  if (label.startsWith('CALL'))   return 'bg-blue-900/60 text-blue-300'
  if (label.startsWith('RAISE'))  return 'bg-green-900/60 text-green-300'
  if (label === 'ALL-IN')         return 'bg-yellow-900/40 text-yellow-300'
  return 'bg-[#1e2433] text-gray-400'
}

function actionToastColor(label: string): string {
  if (label === 'FOLD')           return 'text-gray-400'
  if (label === 'CHECK')          return 'text-gray-200'
  if (label.startsWith('CALL'))   return 'text-blue-300'
  if (label.startsWith('RAISE'))  return 'text-green-300'
  if (label === 'ALL-IN')         return 'text-yellow-300'
  return 'text-gray-300'
}

export default function PlayerSeat({ player, dealDelays, positionLabel, actionLabel }: Props) {
  const {
    showdown, pendingAction, dealRevision, started, lastResult,
    pendingNewHand, thinkingPlayer, thinkingPlayerName, roomConfig,
  } = useGameStore()
  const bigBlind = roomConfig?.big_blind ?? 20
  const dealCtx = useDealContext()

  const handleRef = useCallback((el: HTMLDivElement | null) => {
    dealCtx?.registerSeat(player.name, el)
  }, [player.name, dealCtx])

  const showdownInfo = showdown?.find((s) => s.name === player.name)
  const isWaiting   = pendingAction !== null && player.is_human
  const isFolded    = player.status === 'folded'
  const isBust      = player.status === 'bust'

  const isThinking = !player.is_human
    && player.status === 'active'
    && thinkingPlayer !== null
    && player.name === thinkingPlayerName
    && started
    && showdown === null
    && lastResult === null
    && !pendingNewHand

  // ── Flash toast ──────────────────────────────────────────────────────────────
  const [flashLabel, setFlashLabel]   = useState<string | null>(null)
  const [flashVisible, setFlashVisible] = useState(false)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevLabelRef  = useRef<string | null | undefined>(null)

  useEffect(() => {
    if (!actionLabel || actionLabel === prevLabelRef.current) return
    prevLabelRef.current = actionLabel
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current)
    setFlashLabel(actionLabel)
    setFlashVisible(true)
    flashTimerRef.current = setTimeout(() => setFlashVisible(false), 1500)
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current) }
  }, [actionLabel])

  const avatarUrl = `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(player.name)}&backgroundColor=b6e3f4`
  const positionBadgeClass = positionLabel
    ? (POSITION_BADGE[positionLabel] ?? 'bg-[#2a3347] text-gray-300 font-semibold')
    : ''

  // ── Position badge pill ──────────────────────────────────────────────────────
  const positionBadge = positionLabel ? (
    <span className={`absolute -top-3 -left-3 z-20 text-[10px] px-1.5 py-0.5 rounded-full
      whitespace-nowrap shadow-md ${positionBadgeClass}`}>
      {positionLabel}
    </span>
  ) : null

  // ── Flash toast element ──────────────────────────────────────────────────────
  const flashToast = flashLabel ? (
    <div className={`absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap
      pointer-events-none z-30 transition-opacity duration-300
      ${flashVisible ? 'opacity-100' : 'opacity-0'}`}>
      <span className={`text-xs font-black px-2 py-0.5 rounded-lg bg-black/85 shadow-lg
        ${actionToastColor(flashLabel)}`}>
        {flashLabel}
      </span>
    </div>
  ) : null

  // ════════════════════════════════════════════════════════════════════════════
  // BOT LAYOUT — info panel on top, chip stacks floating below on the felt
  // ════════════════════════════════════════════════════════════════════════════
  if (!player.is_human) {
    return (
      <div ref={handleRef} className="relative flex flex-col items-center gap-1.5">
        {positionBadge}
        {flashToast}

        {/* ── Info panel ─────────────────────────────────────────────────── */}
        <div className={`
          flex flex-col items-center gap-1 px-2.5 pt-2 pb-1.5 rounded-xl
          w-[88px]
          bg-[#1b2333] border border-[#2a3347]/80
          shadow-lg shadow-black/60
          ${isFolded || isBust ? 'opacity-40' : ''}
          ${isThinking ? 'ring-2 ring-yellow-400/50 scale-105 animate-pulse' : ''}
          transition-transform duration-200
        `}>
          {/* Avatar */}
          <img
            src={avatarUrl}
            alt={player.name}
            className="w-9 h-9 rounded-full object-cover bg-[#2a3347]"
          />

          {/* Name */}
          <span className="text-white font-semibold text-[11px] truncate w-full text-center leading-none">
            {player.name}
          </span>

          {/* Thinking dots */}
          {isThinking && (
            <span className="flex gap-0.5 items-center">
              <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          )}

          {/* Showdown cards */}
          {showdownInfo?.hole_cards && showdownInfo.hole_cards.length > 0 && (
            <div className="flex gap-0.5 justify-center">
              {showdownInfo.hole_cards.map((c, i) => (
                <Card key={i} card={c} size="sm" dealDelay={0} getDealerEl={dealCtx?.getDealerEl} />
              ))}
            </div>
          )}

          {/* Hand description */}
          {showdownInfo && (
            <span className="text-[9px] text-gray-300 text-center leading-tight">
              {showdownInfo.hand_description}
            </span>
          )}

          {/* Action badge */}
          {actionLabel && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${actionLabelStyle(actionLabel)}`}>
              {actionLabel}
            </span>
          )}

          {/* Chip count */}
          <span className="text-[#c9a84c] font-bold text-sm leading-none pb-0.5">
            {player.chips}
          </span>
        </div>

        {/* ── Chip stacks floating on table felt ─────────────────────────── */}
        {!isBust && player.chips > 0 && (
          <ChipStack chips={player.chips} bigBlind={bigBlind} maxStack={4} scale={0.82} />
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════════
  // HUMAN LAYOUT — larger panel, cards + chips inside
  // ════════════════════════════════════════════════════════════════════════════
  const displayCards = showdownInfo?.hole_cards ?? player.hole_cards

  return (
    <div
      ref={handleRef}
      className={`
        relative flex flex-col items-center gap-2 px-3 pt-2.5 pb-2 rounded-2xl
        w-36 sm:w-40
        bg-[#1b2333] border-2 border-[#c9a84c]/35
        shadow-xl shadow-black/70
        ${isWaiting ? 'ring-2 ring-white/50' : ''}
        transition-transform duration-200
      `}
    >
      {positionBadge}

      {/* "You" badge — top-right */}
      <span className="absolute -top-3 -right-3 z-20 text-[10px] px-1.5 py-0.5 rounded-full
        bg-[#c9a84c]/20 text-[#c9a84c] font-bold border border-[#c9a84c]/40 whitespace-nowrap">
        You
      </span>

      {flashToast}

      {/* Avatar + name row */}
      <div className="flex items-center gap-1.5 w-full">
        <img
          src={avatarUrl}
          alt={player.name}
          className="w-7 h-7 rounded-full object-cover bg-[#2a3347] shrink-0"
        />
        <span className="text-white font-semibold text-xs truncate flex-1 leading-none">
          {player.name}
        </span>
      </div>

      {/* Hole cards */}
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
          <span className="text-xs text-gray-500 py-2">folded</span>
        )}
      </div>

      {/* Hand description at showdown */}
      {showdownInfo && (
        <span className="text-[10px] text-gray-300 text-center leading-tight">
          {showdownInfo.hand_description}
        </span>
      )}

      {/* Action label */}
      {actionLabel && (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${actionLabelStyle(actionLabel)}`}>
          {actionLabel}
        </span>
      )}

      {/* Chip stack inside panel */}
      {player.status !== 'bust' && player.chips > 0 && (
        <ChipStack chips={player.chips} bigBlind={bigBlind} maxStack={4} scale={0.88} />
      )}

      {/* Chip count */}
      <span className="text-[#c9a84c] font-bold text-sm leading-none">
        {player.chips}
      </span>
    </div>
  )
}
