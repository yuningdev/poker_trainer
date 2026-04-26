import { useGameStore } from '../store/gameStore'
import { DealProvider } from '../context/DealContext'
import CommunityCards from './CommunityCards'
import PlayerSeat from './PlayerSeat'
import PotDisplay from './PotDisplay'
import ActionLog from './ActionLog'
import HandResultOverlay from './HandResultOverlay'
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

export default function GameTable({ onAction: _onAction }: Props) {
  const { players, dealerPosition } = useGameStore()
  const n = players.length
  const dealerName = players[dealerPosition]?.name ?? ''

  const sbIndex = findSmallBlindIndex(players, dealerPosition)
  const positionLabels = computePositionLabels(players, dealerPosition)

  function dealDelaysFor(seatIndex: number): [number, number] {
    const rel = (seatIndex - sbIndex + n) % n
    return [rel * DEAL_INTERVAL, (n + rel) * DEAL_INTERVAL]
  }

  const humanIndex = players.findIndex((p) => p.is_human)
  const opponents = players
    .map((p, i) => ({ player: p, seatIndex: i }))
    .filter(({ seatIndex }) => seatIndex !== humanIndex)

  const topRow = opponents.slice(0, Math.ceil(opponents.length / 2))
  const bottomRow = opponents.slice(Math.ceil(opponents.length / 2))

  return (
    <DealProvider dealerName={dealerName}>
      <div className="min-h-screen bg-gray-950 text-white flex flex-col">
        <HandResultOverlay />

        <div className="flex flex-1 gap-0">
          {/* ── Main table area ── */}
          <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 pb-24">
            {/* Top row players (opponents) */}
            <div className="flex gap-3 flex-wrap justify-center">
              {topRow.map(({ player, seatIndex }) => (
                <PlayerSeat
                  key={player.name}
                  player={player}
                  isDealer={seatIndex === dealerPosition}
                  dealDelays={dealDelaysFor(seatIndex)}
                  positionLabel={positionLabels[seatIndex]}
                />
              ))}
            </div>

            {/* Center: community cards + pot */}
            <div className="flex flex-col items-center gap-4 bg-green-900/30 border border-green-800/50 rounded-full px-12 py-6">
              <CommunityCards />
              <PotDisplay />
            </div>

            {/* Bottom row: remaining opponents */}
            <div className="flex gap-3 flex-wrap justify-center">
              {bottomRow.map(({ player, seatIndex }) => (
                <PlayerSeat
                  key={player.name}
                  player={player}
                  isDealer={seatIndex === dealerPosition}
                  dealDelays={dealDelaysFor(seatIndex)}
                  positionLabel={positionLabels[seatIndex]}
                />
              ))}
            </div>

            {/* Human player */}
            <div className="flex justify-center">
              {humanIndex !== -1 && (
                <PlayerSeat
                  key={players[humanIndex].name}
                  player={players[humanIndex]}
                  isDealer={humanIndex === dealerPosition}
                  dealDelays={dealDelaysFor(humanIndex)}
                  positionLabel={positionLabels[humanIndex]}
                />
              )}
            </div>
          </div>

          {/* ── Action log sidebar ── */}
          <div className="w-56 border-l border-gray-800 bg-gray-900/50 flex flex-col">
            <div className="text-xs text-gray-500 uppercase tracking-widest px-3 py-2 border-b border-gray-800">
              Action Log
            </div>
            <div className="flex-1 overflow-hidden py-2">
              <ActionLog />
            </div>
          </div>
        </div>
      </div>
    </DealProvider>
  )
}
