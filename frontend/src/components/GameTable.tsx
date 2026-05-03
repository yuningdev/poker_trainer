import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { DealProvider } from '../context/DealContext'
import CommunityCards from './CommunityCards'
import PlayerSeat from './PlayerSeat'
import PotDisplay from './PotDisplay'
import ActionLog from './ActionLog'
import type { ActionType } from '../types'

interface Props {
  onAction: (action: ActionType, amount?: number) => void
}

// Cards are dealt clockwise starting from SB (first active player left of dealer).
// relativeIndex = (seatIndex - sbIndex + N) % N
//   0 = SB (first to receive), 1 = BB, …, last = dealer
// First pass:  card 0 delay = rel * INTERVAL
// Second pass: card 1 delay = (N + rel) * INTERVAL
const DEAL_INTERVAL = 130  // ms between each card dealt

import type { PlayerData } from '../types'

function findSmallBlindIndex(players: PlayerData[], dealerPosition: number): number {
  const n = players.length
  for (let i = 1; i <= n; i++) {
    const idx = (dealerPosition + i) % n
    if (players[idx].chips > 0) return idx
  }
  return (dealerPosition + 1) % n
}

// Position labels by number of active (non-bust) players and clockwise offset from SB.
// offset 0 = SB, 1 = BB, last = BTN (dealer)
const POSITION_LABELS: Record<number, string[]> = {
  2:  ['SB/BTN', 'BB'],
  3:  ['SB', 'BB', 'BTN'],
  4:  ['SB', 'BB', 'CO', 'BTN'],
  5:  ['SB', 'BB', 'UTG', 'CO', 'BTN'],
  6:  ['SB', 'BB', 'UTG', 'HJ', 'CO', 'BTN'],
  7:  ['SB', 'BB', 'UTG', 'UTG+1', 'HJ', 'CO', 'BTN'],
  8:  ['SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO', 'BTN'],
  9:  ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO', 'BTN'],
}

function computePositionLabels(players: PlayerData[], dealerPosition: number): string[] {
  const sbIndex = findSmallBlindIndex(players, dealerPosition)
  const activePlayers = players.filter(p => p.status !== 'bust')
  const activeCount = activePlayers.length
  const labels = POSITION_LABELS[activeCount] ?? POSITION_LABELS[9] ?? []

  return players.map((p) => {
    if (p.status === 'bust') return ''
    // offset from SB among active players only
    const activeFromSb = activePlayers.findIndex(ap => ap.name === p.name)
    const sbActiveIndex = activePlayers.findIndex(ap => ap.name === players[sbIndex]?.name)
    const offset = (activeFromSb - sbActiveIndex + activeCount) % activeCount
    return labels[offset] ?? ''
  })
}

/**
 * Compute oval seat position as CSS left/top percentages.
 * fraction=0 → 6 o'clock (bottom), goes clockwise.
 * rx/ry are radius as fraction of container width/height (0–1).
 */
function ovalPosition(fraction: number, rx = 0.44, ry = 0.40): { left: string; top: string } {
  const angle = 2 * Math.PI * fraction
  const x = 50 + rx * 100 * Math.sin(angle)
  const y = 50 + ry * 100 * (-Math.cos(angle))
  return { left: `${x}%`, top: `${y}%` }
}

export default function GameTable({ onAction: _onAction }: Props) {
  const store = useGameStore()
  const { players, dealerPosition, humanEquity, currentRoundActions, pendingNewHand } = store
  const n = players.length
  const dealerName = players[dealerPosition]?.name ?? ''

  const sbIndex = findSmallBlindIndex(players, dealerPosition)
  const positionLabels = computePositionLabels(players, dealerPosition)

  // Collapsible action log (Change 4)
  const [logOpen, setLogOpen] = useState(false)

  // Seat animation state (Change 5)
  const [animating, setAnimating] = useState(false)

  // Change 2: wait 2500ms after NEW_HAND before flushing visual state
  useEffect(() => {
    if (!pendingNewHand) return
    setAnimating(true)
    const timer = setTimeout(() => {
      store.flushNewHand()
      setAnimating(false)
    }, 2500)
    return () => clearTimeout(timer)
  }, [pendingNewHand])

  function dealDelaysFor(seatIndex: number): [number, number] {
    const rel = (seatIndex - sbIndex + n) % n
    return [rel * DEAL_INTERVAL, (n + rel) * DEAL_INTERVAL]
  }

  const humanIndex = players.findIndex((p) => p.is_human)

  // Only show non-bust players in the seating arrangement
  const activePlayers = players
    .map((p, i) => ({ player: p, seatIndex: i }))
    .filter(({ player }) => player.status !== 'bust')

  const humanEntry = activePlayers.find(({ seatIndex }) => seatIndex === humanIndex)
  const opponentEntries = activePlayers.filter(({ seatIndex }) => seatIndex !== humanIndex)

  // Total seats in oval = 1 (human) + opponents
  const totalSeats = activePlayers.length

  // Human is always at fraction=0 (bottom). Opponents spread clockwise from fraction 1/total.
  // e.g. 2 players total: human=0, opponent=0.5
  //      3 players total: human=0, opp1=0.33, opp2=0.67
  function opponentFraction(opponentIdx: number): number {
    return (opponentIdx + 1) / totalSeats
  }

  const seatTransitionClass = 'transition-all duration-700'
  const seatAnimClass = animating ? 'scale-95 opacity-80' : ''

  return (
    <DealProvider dealerName={dealerName}>
      <div className="min-h-screen bg-gray-950 text-white flex flex-col overflow-x-hidden">
        <div className="flex flex-1 gap-0 min-h-screen">
          {/* ── Main table area ── */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-6 pb-28 sm:pb-32">
            {/*
              Oval table container.
              We use a relative container with a fixed aspect ratio that looks like a poker table.
              Players are absolutely positioned around the oval edge.
            */}
            <div
              className="relative w-full max-w-[900px]"
              style={{ paddingBottom: 'min(65%, 560px)' }}
            >
              {/* Oval table felt */}
              <div className="absolute inset-0 rounded-[50%] bg-green-900 border-4 border-green-700 shadow-2xl shadow-black/60" />

              {/* Table inner ring (decorative) */}
              <div className="absolute inset-[8%] rounded-[50%] border border-green-700/40 pointer-events-none" />

              {/* Center: community cards + pot */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 sm:gap-3 pointer-events-none">
                <div className="pointer-events-auto">
                  <CommunityCards />
                </div>
                <div className="pointer-events-auto">
                  <PotDisplay />
                </div>
              </div>

              {/* Human player at bottom-center (fraction = 0) */}
              {humanEntry && (() => {
                const pos = ovalPosition(0)
                return (
                  <div
                    key={humanEntry.player.name}
                    className={`absolute z-10 ${seatTransitionClass} ${seatAnimClass}`}
                    style={{
                      left: pos.left,
                      top: pos.top,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <PlayerSeat
                      player={humanEntry.player}
                      dealDelays={dealDelaysFor(humanEntry.seatIndex)}
                      positionLabel={positionLabels[humanEntry.seatIndex]}
                      equity={humanEquity}
                      actionLabel={currentRoundActions[humanEntry.player.name] ?? null}
                    />
                  </div>
                )
              })()}

              {/* Opponent players distributed clockwise around the oval */}
              {opponentEntries.map(({ player, seatIndex }, opponentIdx) => {
                const fraction = opponentFraction(opponentIdx)
                const pos = ovalPosition(fraction)
                return (
                  <div
                    key={player.name}
                    className={`absolute z-10 ${seatTransitionClass} ${seatAnimClass}`}
                    style={{
                      left: pos.left,
                      top: pos.top,
                      transform: 'translate(-50%, -50%)',
                    }}
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

          {/* ── Action log sidebar (hidden on mobile, visible from sm) ── */}
          {/* Change 4: collapsible sidebar */}
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
                  >
                    ◀
                  </button>
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
                >
                  ▶
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Action log for mobile (bottom strip, collapsible) ── */}
        <div className="sm:hidden fixed bottom-[72px] left-0 right-0 z-20 pointer-events-none">
          {/* Shown as a small strip — ActionPanel sits above this */}
        </div>
      </div>
    </DealProvider>
  )
}
