import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { DealProvider } from '../context/DealContext'
import CommunityCards from './CommunityCards'
import PlayerSeat from './PlayerSeat'
import PotDisplay from './PotDisplay'
import ActionLog from './ActionLog'
import HandResultModal from './HandResultModal'
import InfoPanel from './InfoPanel'
import { ActionToast } from './ActionToast'
import { ChipStack } from './ChipStack'
import { playChip, playDeal, playCheck, playFold, playWin } from '../hooks/useSound'
import type { ActionType, PlayerData } from '../types'

interface Props {
  onAction: (action: ActionType, amount?: number) => void
}

const DEAL_INTERVAL = 130 // ms between each card dealt

// ── Oval geometry ────────────────────────────────────────────────────────────
function ovalPosition(fraction: number, rx = 0.44, ry = 0.40): { left: string; top: string } {
  const angle = 2 * Math.PI * fraction
  const x = 50 + rx * 100 * Math.sin(angle)
  const y = 50 + ry * 100 * (-Math.cos(angle))
  return { left: `${x}%`, top: `${y}%` }
}

// ── Position label helpers ───────────────────────────────────────────────────
function findSmallBlindIndex(players: PlayerData[], dealerPosition: number): number {
  const n = players.length
  for (let i = 1; i <= n; i++) {
    const idx = (dealerPosition + i) % n
    if (players[idx].chips > 0) return idx
  }
  return (dealerPosition + 1) % n
}

const POSITION_LABELS: Record<number, string[]> = {
  2: ['SB/BTN', 'BB'],
  3: ['SB', 'BB', 'BTN'],
  4: ['SB', 'BB', 'CO', 'BTN'],
  5: ['SB', 'BB', 'UTG', 'CO', 'BTN'],
  6: ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
  7: ['SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO', 'BTN'],
  8: ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'],
  9: ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'],
}

function computePositionLabels(players: PlayerData[], dealerPosition: number): string[] {
  const sbIndex = findSmallBlindIndex(players, dealerPosition)
  const activePlayers = players.filter((p) => p.status !== 'bust')
  const activeCount = activePlayers.length
  const labels = POSITION_LABELS[activeCount] ?? POSITION_LABELS[9] ?? []
  return players.map((p) => {
    if (p.status === 'bust') return ''
    const activeFromSb = activePlayers.findIndex((ap) => ap.name === p.name)
    const sbActiveIndex = activePlayers.findIndex((ap) => ap.name === players[sbIndex]?.name)
    const offset = (activeFromSb - sbActiveIndex + activeCount) % activeCount
    return labels[offset] ?? ''
  })
}

// ── Chip animation token ─────────────────────────────────────────────────────
interface ChipAnim {
  id: number
  from: { left: string; top: string }
  to:   { left: string; top: string }
  /** 'bet' = player→pot (gold), 'win' = pot→player (green) */
  variant: 'bet' | 'win'
}

interface ChipTokenProps {
  anim: ChipAnim
  onDone: (id: number) => void
}

function ChipToken({ anim, onDone }: ChipTokenProps) {
  const [flying, setFlying] = useState(false)
  const doneRef = useRef(false)

  useEffect(() => {
    // Double RAF ensures the element is painted at 'from' before transition starts
    const r1 = requestAnimationFrame(() => {
      const r2 = requestAnimationFrame(() => setFlying(true))
      return () => cancelAnimationFrame(r2)
    })
    return () => cancelAnimationFrame(r1)
  }, [])

  useEffect(() => {
    if (!flying || doneRef.current) return
    const t = setTimeout(() => {
      doneRef.current = true
      onDone(anim.id)
    }, 520)
    return () => clearTimeout(t)
  }, [flying, anim.id, onDone])

  const pos = flying ? anim.to : anim.from

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: pos.left,
        top: pos.top,
        transform: 'translate(-50%, -50%)',
        transition: flying ? 'left 0.44s cubic-bezier(.4,0,.2,1), top 0.44s cubic-bezier(.4,0,.2,1)' : 'none',
        zIndex: 30,
        willChange: 'left, top',
      }}
    >
      {/* Outer chip ring */}
      <div
        className="w-5 h-5 rounded-full shadow-lg border-2 border-dashed flex items-center justify-center"
        style={{
          background: anim.variant === 'bet'
            ? 'radial-gradient(circle at 35% 35%, #fde68a, #b45309)'
            : 'radial-gradient(circle at 35% 35%, #86efac, #15803d)',
          borderColor: anim.variant === 'bet' ? '#fde68a' : '#86efac',
        }}
      />
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
/** Position halfway between the seat and pot center (for bet-chip display). */
function betPosition(fraction: number): { left: string; top: string } {
  return ovalPosition(fraction, 0.20, 0.17)
}

export default function GameTable({ onAction: _onAction }: Props) {
  const store = useGameStore()
  const { players, dealerPosition, currentRoundActions, pendingNewHand, log, lastResult, dealRevision, roomConfig } = store
  const bigBlind = roomConfig?.big_blind ?? 20
  const n = players.length
  const dealerName = players[dealerPosition]?.name ?? ''

  const sbIndex = findSmallBlindIndex(players, dealerPosition)
  const positionLabels = computePositionLabels(players, dealerPosition)

  const [logOpen, setLogOpen] = useState(false)
  const [animating, setAnimating] = useState(false)

  // ── Seat layout ─────────────────────────────────────────────────────────────
  const humanIndex = players.findIndex((p) => p.is_human)
  const activePlayers = players
    .map((p, i) => ({ player: p, seatIndex: i }))
    .filter(({ player }) => player.status !== 'bust')
  const humanEntry = activePlayers.find(({ seatIndex }) => seatIndex === humanIndex)
  const opponentEntries = activePlayers.filter(({ seatIndex }) => seatIndex !== humanIndex)
  const totalSeats = activePlayers.length

  function opponentFraction(opponentIdx: number): number {
    return ((0.5 + (opponentIdx + 1) / totalSeats) % 1 + 1) % 1
  }

  // Keep a ref to the current seat→position map so effects can read it without
  // being re-triggered every render.
  const seatPosRef = useRef<Record<string, { left: string; top: string }>>({})
  const map: Record<string, { left: string; top: string }> = {}
  if (humanEntry) map[humanEntry.player.name] = ovalPosition(0.5)
  opponentEntries.forEach(({ player }, idx) => {
    map[player.name] = ovalPosition(opponentFraction(idx))
  })
  seatPosRef.current = map

  // ── Chip animations ──────────────────────────────────────────────────────────
  const [chipAnims, setChipAnims] = useState<ChipAnim[]>([])
  const chipIdRef = useRef(0)

  const removeChip = useCallback((id: number) => {
    setChipAnims((prev) => prev.filter((c) => c.id !== id))
  }, [])

  function spawnChip(
    from: { left: string; top: string },
    to:   { left: string; top: string },
    variant: ChipAnim['variant'],
    delayMs = 0,
  ) {
    const id = ++chipIdRef.current
    const spawn = () => setChipAnims((prev) => [...prev, { id, from, to, variant }])
    if (delayMs > 0) { setTimeout(spawn, delayMs) } else { spawn() }
  }

  const POT_POS = { left: '50%', top: '50%' }

  // ── Watch ACTION_LOG → sounds + chip-to-pot animations ──────────────────────
  const lastLogIdRef = useRef(-1)

  useEffect(() => {
    const newEntries = log.filter((e) => e.id > lastLogIdRef.current)
    if (newEntries.length === 0) return
    lastLogIdRef.current = Math.max(...newEntries.map((e) => e.id))

    for (const entry of newEntries) {
      const seat = seatPosRef.current[entry.player]
      const { text } = entry

      if (text === 'folds') { playFold(); continue }
      if (text === 'checks') { playCheck(); continue }

      if (
        text.startsWith('calls') ||
        text.startsWith('raises') ||
        text.startsWith('posts')
      ) {
        if (seat) spawnChip(seat, POT_POS, 'bet')
        playChip()
        continue
      }

      if (text === 'goes all-in') {
        if (seat) {
          spawnChip(seat, POT_POS, 'bet', 0)
          spawnChip(seat, POT_POS, 'bet', 70)
          spawnChip(seat, POT_POS, 'bet', 140)
        }
        playChip()
        setTimeout(() => playChip(0.25), 80)
        setTimeout(() => playChip(0.2), 160)
        continue
      }
    }
  }, [log])

  // ── Watch HAND_RESULT → chips fly pot→winner + win sound ────────────────────
  const lastResultRef = useRef(lastResult)
  useEffect(() => {
    if (!lastResult || lastResult === lastResultRef.current) return
    lastResultRef.current = lastResult

    const winnerPos = seatPosRef.current[lastResult.winner]
    if (winnerPos) {
      for (let i = 0; i < 6; i++) {
        spawnChip(POT_POS, winnerPos, 'win', i * 55)
      }
    }
    playWin()
  }, [lastResult])

  // ── Deal sound when a new hand is dealt ─────────────────────────────────────
  const prevRevisionRef = useRef(dealRevision)
  useEffect(() => {
    if (dealRevision === prevRevisionRef.current) return
    prevRevisionRef.current = dealRevision
    // Stagger deal sounds to match card-by-card animation
    const total = n * 2
    for (let i = 0; i < total; i++) {
      setTimeout(() => playDeal(), i * DEAL_INTERVAL)
    }
  }, [dealRevision, n])

  // ── pendingNewHand seat-pulse animation ─────────────────────────────────────
  useEffect(() => {
    if (pendingNewHand) setAnimating(true)
    else setAnimating(false)
  }, [pendingNewHand])

  function dealDelaysFor(seatIndex: number): [number, number] {
    const rel = (seatIndex - sbIndex + n) % n
    return [rel * DEAL_INTERVAL, (n + rel) * DEAL_INTERVAL]
  }

  const seatTransitionClass = 'transition-all duration-700'
  const seatAnimClass = animating ? 'scale-95 opacity-80' : ''

  return (
    <DealProvider dealerName={dealerName}>
      <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-x-hidden">
        <div className="flex flex-1 gap-0 min-h-screen">
          {/* ── Main table area ── */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-6 pb-28 sm:pb-32">
            <div
              className="relative w-full max-w-[900px]"
              style={{ paddingBottom: 'min(65%, 560px)' }}
            >
              {/* Oval table felt */}
              <div className="absolute inset-0 rounded-[50%] bg-green-900 border-4 border-green-700 shadow-2xl shadow-black/60" />

              {/* Table inner ring (decorative) */}
              <div className="absolute inset-[8%] rounded-[50%] border border-green-700/40 pointer-events-none" />

              {/* Chip animation layer — lives inside the oval container */}
              {chipAnims.map((anim) => (
                <ChipToken key={anim.id} anim={anim} onDone={removeChip} />
              ))}

              {/* Bet-area chip stacks: each player's current_bet shown halfway
                  between their seat and the pot center */}
              {humanEntry && humanEntry.player.current_bet > 0 && (() => {
                const pos = betPosition(0.5)
                return (
                  <div
                    className="absolute pointer-events-none z-15"
                    style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                  >
                    <ChipStack chips={humanEntry.player.current_bet} bigBlind={bigBlind} maxStack={3} scale={0.9} />
                  </div>
                )
              })()}
              {opponentEntries.map(({ player }, opponentIdx) => {
                if (player.current_bet <= 0) return null
                const fraction = opponentFraction(opponentIdx)
                const pos = betPosition(fraction)
                return (
                  <div
                    key={`bet-${player.name}`}
                    className="absolute pointer-events-none z-15"
                    style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                  >
                    <ChipStack chips={player.current_bet} bigBlind={bigBlind} maxStack={3} scale={0.9} />
                  </div>
                )
              })}

              {/* Center: community cards + pot */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 pointer-events-none">
                <div className="pointer-events-auto">
                  <CommunityCards />
                </div>
                <div className="pointer-events-auto">
                  <PotDisplay />
                </div>
              </div>

              {/* Action toast — anchored inside the oval below the pot */}
              <ActionToast />

              {/* Human player at bottom-center (fraction = 0.5) */}
              {humanEntry && (() => {
                const pos = ovalPosition(0.5)
                return (
                  <div
                    key={humanEntry.player.name}
                    className={`absolute z-10 ${seatTransitionClass} ${seatAnimClass}`}
                    style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                  >
                    <PlayerSeat
                      player={humanEntry.player}
                      dealDelays={dealDelaysFor(humanEntry.seatIndex)}
                      positionLabel={positionLabels[humanEntry.seatIndex]}
                      actionLabel={currentRoundActions[humanEntry.player.name] ?? null}
                    />
                  </div>
                )
              })()}

              {/* Opponents distributed clockwise around the oval */}
              {opponentEntries.map(({ player, seatIndex }, opponentIdx) => {
                const fraction = opponentFraction(opponentIdx)
                const pos = ovalPosition(fraction)
                return (
                  <div
                    key={player.name}
                    className={`absolute z-10 ${seatTransitionClass} ${seatAnimClass}`}
                    style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                  >
                    <PlayerSeat
                      player={player}
                      dealDelays={dealDelaysFor(seatIndex)}
                      positionLabel={positionLabels[seatIndex]}
                      actionLabel={currentRoundActions[player.name] ?? null}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Action log sidebar (sm+) ── */}
          <div
            className={`hidden sm:flex border-l border-gray-800 bg-gray-900/50 flex-col shrink-0 transition-all duration-300 ${logOpen ? 'w-52' : 'w-8'}`}
          >
            {logOpen ? (
              <>
                <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest px-3 py-2 border-b border-gray-800">
                  <span>Log</span>
                  <button
                    onClick={() => setLogOpen(false)}
                    className="text-gray-400 hover:text-gray-200 transition leading-none"
                    title="Collapse log"
                  >◀</button>
                </div>
                <div className="flex-1 overflow-hidden py-2">
                  <ActionLog />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center pt-2">
                <button
                  onClick={() => setLogOpen(true)}
                  className="text-gray-500 hover:text-gray-200 transition text-xs leading-none p-1"
                  title="Expand log"
                >▶</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hand result modal */}
      <HandResultModal onFlush={() => { store.flushNewHand(); setAnimating(false) }} />

      {/* Info panel */}
      <InfoPanel />
    </DealProvider>
  )
}
