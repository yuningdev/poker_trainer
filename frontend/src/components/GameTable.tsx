import { useEffect, useRef, useState, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import { DealProvider } from '../context/DealContext'
import CommunityCards from './CommunityCards'
import PlayerSeat from './PlayerSeat'
import PotDisplay from './PotDisplay'
import ActionLog from './ActionLog'
import HandResultModal from './HandResultModal'
import InfoPanel from './InfoPanel'
import { playChip, playDeal, playCheck, playFold, playWin } from '../hooks/useSound'
import { useIsLandscapePhone } from '../hooks/useIsLandscapePhone'
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

/** Denomination colors matching ChipStack (radial-gradient bg + border color). */
const CHIP_DENOMS_ANIM = [
  { mult: 50, bg: 'radial-gradient(circle at 35% 35%, #a78bfa, #7c3aed)', border: '#a78bfa' }, // 25BB purple
  { mult: 10, bg: 'radial-gradient(circle at 35% 35%, #d1d5db, #6b7280)', border: '#d1d5db' }, // 5BB  gray
  { mult:  2, bg: 'radial-gradient(circle at 35% 35%, #fca5a5, #dc2626)', border: '#fca5a5' }, // 1BB  red
  { mult:  1, bg: 'radial-gradient(circle at 35% 35%, #67e8f9, #0891b2)', border: '#67e8f9' }, // 0.5BB teal
]
const WIN_CHIP_STYLE = {
  bg: 'radial-gradient(circle at 35% 35%, #fde68a, #b45309)',
  border: '#fde68a',
}

interface ChipAnim {
  id: number
  from: { left: string; top: string }
  to:   { left: string; top: string }
  chipBg: string
  chipBorder: string
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
      {/* Poker chip disc */}
      <div
        className="w-5 h-5 rounded-full shadow-lg border-2 flex items-center justify-center"
        style={{
          background: anim.chipBg,
          borderColor: anim.chipBorder,
        }}
      />
    </div>
  )
}

// ── Bet badge ─────────────────────────────────────────────────────────────────
/** Compact chip+amount label shown in the bet area in front of each player. */
function BetBadge({ amount }: { amount: number }) {
  return (
    <div className="flex items-center gap-1 bg-[#0d1829]/90 rounded-full px-1.5 py-0.5 shadow-md border border-[#2a4060] whitespace-nowrap">
      <div className="w-2.5 h-2.5 rounded-full bg-[#4a7fa5] shrink-0" />
      <span className="text-gray-200 font-bold text-[11px] leading-none">{amount}</span>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────────────────
export default function GameTable({ onAction: _onAction }: Props) {
  const store = useGameStore()
  const { players, dealerPosition, currentRoundActions, pendingNewHand, log, lastResult, dealRevision, roomConfig, phaseChangeTick, phaseChangeBets, displayBets, displayChips } = store
  const bigBlind = roomConfig?.big_blind ?? 20
  const n = players.length
  const dealerName = players[dealerPosition]?.name ?? ''

  const isLS = useIsLandscapePhone()

  // ── Landscape-aware oval radii ───────────────────────────────────────────────
  const RX  = isLS ? 0.42 : 0.44  // horizontal seat radius
  const RY  = isLS ? 0.26 : 0.40  // vertical seat radius
  const BRX = isLS ? 0.30 : 0.33  // bet badge horizontal radius
  const BRY = isLS ? 0.18 : 0.27  // bet badge vertical radius

  const seatPos = (f: number) => ovalPosition(f, RX, RY)
  const betPos  = (f: number) => ovalPosition(f, BRX, BRY)

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
  const betPosRef  = useRef<Record<string, { left: string; top: string }>>({})
  const seatMap: Record<string, { left: string; top: string }> = {}
  const betMap:  Record<string, { left: string; top: string }> = {}
  if (humanEntry) {
    seatMap[humanEntry.player.name] = seatPos(0.5)
    betMap[humanEntry.player.name]  = betPos(0.5)
  }
  opponentEntries.forEach(({ player }, idx) => {
    const frac = opponentFraction(idx)
    seatMap[player.name] = seatPos(frac)
    betMap[player.name]  = betPos(frac)
  })
  seatPosRef.current = seatMap
  betPosRef.current  = betMap

  // ── Chip animations ──────────────────────────────────────────────────────────
  const [chipAnims, setChipAnims] = useState<ChipAnim[]>([])
  const chipIdRef = useRef(0)

  const removeChip = useCallback((id: number) => {
    setChipAnims((prev) => prev.filter((c) => c.id !== id))
  }, [])

  function spawnChip(
    from: { left: string; top: string },
    to:   { left: string; top: string },
    chipBg: string,
    chipBorder: string,
    delayMs = 0,
  ) {
    const id = ++chipIdRef.current
    const spawn = () => setChipAnims((prev) => [...prev, { id, from, to, chipBg, chipBorder }])
    if (delayMs > 0) { setTimeout(spawn, delayMs) } else { spawn() }
  }

  /** Decompose `amount` into denominations and spawn appropriately-colored chips. */
  function spawnChipsByDenom(
    from: { left: string; top: string },
    to:   { left: string; top: string },
    amount: number,
    startDelayMs = 0,
  ) {
    const halfBb = Math.max(1, Math.floor(bigBlind / 2))
    let rem = Math.max(amount, 0)
    let delay = startDelayMs
    let spawned = 0
    for (const d of CHIP_DENOMS_ANIM) {
      if (spawned >= 4) break  // cap total tokens to keep it tidy
      const value = halfBb * d.mult
      const n = Math.floor(rem / value)
      if (n > 0) {
        // Cap per-denomination tokens to 2 to avoid screen clutter
        const toSpawn = Math.min(n, 2, 4 - spawned)
        for (let i = 0; i < toSpawn; i++) {
          spawnChip(from, to, d.bg, d.border, delay)
          delay += 60
          spawned++
        }
        rem -= n * value
      }
    }
    // Fallback: always spawn at least one chip (lowest denom)
    if (spawned === 0) {
      const d = CHIP_DENOMS_ANIM[3]
      spawnChip(from, to, d.bg, d.border, startDelayMs)
    }
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
        // Chips fly seat → bet area (halfway to pot), not directly to pot.
        // They merge into the pot on the next PHASE_CHANGE.
        const amountMatch = text.match(/(\d+)$/)
        const amount = amountMatch ? parseInt(amountMatch[1], 10) : bigBlind
        const bp = betPosRef.current[entry.player] ?? POT_POS
        if (seat) spawnChipsByDenom(seat, bp, amount)
        playChip()
        continue
      }

      if (text === 'goes all-in') {
        // For all-in, burst chips from seat → bet area
        const player = players.find((p) => p.name === entry.player)
        const amount = player ? Math.max(player.current_bet, bigBlind) : bigBlind * 5
        const bp = betPosRef.current[entry.player] ?? POT_POS
        if (seat) {
          spawnChipsByDenom(seat, bp, amount, 0)
          spawnChipsByDenom(seat, bp, amount, 90)
        }
        playChip()
        setTimeout(() => playChip(0.25), 80)
        setTimeout(() => playChip(0.2), 160)
        continue
      }
    }
  }, [log])

  // ── Watch PHASE_CHANGE → bet-area chips fly to pot ──────────────────────────
  const prevPhaseTickRef = useRef(phaseChangeTick)
  useEffect(() => {
    if (phaseChangeTick === prevPhaseTickRef.current) return
    prevPhaseTickRef.current = phaseChangeTick

    // Animate each player's bet chips from the bet area into the pot center
    let delay = 0
    for (const [name, betAmt] of Object.entries(phaseChangeBets)) {
      if (betAmt <= 0) continue
      const bp = betPosRef.current[name]
      if (!bp) continue
      spawnChipsByDenom(bp, POT_POS, betAmt, delay)
      delay += 60
    }
    if (delay > 0) playChip()
  }, [phaseChangeTick])

  // ── Watch HAND_RESULT → chips fly pot→winner + win sound ────────────────────
  const lastResultRef = useRef(lastResult)
  useEffect(() => {
    if (!lastResult || lastResult === lastResultRef.current) return
    lastResultRef.current = lastResult

    const winnerPos = seatPosRef.current[lastResult.winner]
    if (winnerPos) {
      for (let i = 0; i < 6; i++) {
        spawnChip(POT_POS, winnerPos, WIN_CHIP_STYLE.bg, WIN_CHIP_STYLE.border, i * 55)
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
      <div className={`${isLS ? 'h-dvh overflow-hidden' : 'min-h-screen'} bg-[#0d1117] text-white flex flex-col overflow-x-hidden`}>
        <div className={`flex flex-1 gap-0 ${isLS ? 'h-dvh' : 'min-h-screen'}`}>
          {/* ── Main table area ── */}
          <div className={`flex-1 flex flex-col items-center justify-center min-h-0
            ${isLS ? 'p-1 pb-[52px]' : 'p-2 sm:p-6 pb-28 sm:pb-32'}`}>
            <div
              className={`relative w-full ${isLS ? '' : 'max-w-[900px]'}`}
              style={isLS
                ? { height: 'calc(100dvh - 56px)', maxWidth: '100%' }
                : { paddingBottom: 'min(65%, 560px)', maxWidth: '900px' }
              }
            >
              {/* Oval table felt */}
              <div className="absolute inset-0 rounded-[50%] bg-[#0d1829] border-2 border-[#1e3350] shadow-2xl shadow-black/80" />

              {/* Table inner ring (decorative) */}
              <div className="absolute inset-[8%] rounded-[50%] border border-white/5 pointer-events-none" />

              {/* Chip animation layer — lives inside the oval container */}
              {chipAnims.map((anim) => (
                <ChipToken key={anim.id} anim={anim} onDone={removeChip} />
              ))}

              {/* Bet badges: compact chip+amount label in front of each player.
                  Use displayBets (real-time accumulator) so bot bets show immediately. */}
              {humanEntry && (displayBets[humanEntry.player.name] ?? 0) > 0 && (() => {
                const pos = betPos(0.5)
                return (
                  <div
                    className="absolute pointer-events-none z-20"
                    style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                  >
                    <BetBadge amount={displayBets[humanEntry.player.name]} />
                  </div>
                )
              })()}
              {opponentEntries.map(({ player }, opponentIdx) => {
                const betAmt = displayBets[player.name] ?? 0
                if (betAmt <= 0) return null
                const fraction = opponentFraction(opponentIdx)
                const pos = betPos(fraction)
                return (
                  <div
                    key={`bet-${player.name}`}
                    className="absolute pointer-events-none z-20"
                    style={{ left: pos.left, top: pos.top, transform: 'translate(-50%, -50%)' }}
                  >
                    <BetBadge amount={betAmt} />
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

              {/* Human player at bottom-center (fraction = 0.5) */}
              {humanEntry && (() => {
                const pos = seatPos(0.5)
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
                      compact={isLS}
                      chipOverride={displayChips[humanEntry.player.name]}
                    />
                  </div>
                )
              })()}

              {/* Opponents distributed clockwise around the oval */}
              {opponentEntries.map(({ player, seatIndex }, opponentIdx) => {
                const fraction = opponentFraction(opponentIdx)
                const pos = seatPos(fraction)
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
                      compact={isLS}
                      chipOverride={displayChips[player.name]}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── Action log sidebar (sm+ only, hidden in landscape) ── */}
          <div
            className={`${isLS ? 'hidden' : 'hidden sm:flex'} border-l border-[#1e2433] bg-[#0d1117]/80 flex-col shrink-0 transition-all duration-300 ${logOpen ? 'w-52' : 'w-8'}`}
          >
            {logOpen ? (
              <>
                <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest px-3 py-2 border-b border-[#1e2433]">
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
                  className="text-[#2a3347] hover:text-gray-200 transition text-xs leading-none p-1"
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
