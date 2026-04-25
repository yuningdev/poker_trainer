import { useGameStore } from '../store/gameStore'
import CommunityCards from './CommunityCards'
import PlayerSeat from './PlayerSeat'
import PotDisplay from './PotDisplay'
import ActionLog from './ActionLog'
import HandResultOverlay from './HandResultOverlay'
import type { ActionType } from '../types'

interface Props {
  onAction: (action: ActionType, amount?: number) => void
}

export default function GameTable({ onAction: _onAction }: Props) {
  const { players, dealerPosition } = useGameStore()

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <HandResultOverlay />

      <div className="flex flex-1 gap-0">
        {/* ── Main table area ── */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-6 pb-24">
          {/* Top row players (opponents) */}
          <div className="flex gap-3 flex-wrap justify-center">
            {players
              .filter((_, i) => i !== players.findIndex((p) => p.is_human))
              .slice(0, Math.ceil(players.length / 2))
              .map((player) => (
                <PlayerSeat
                  key={player.name}
                  player={player}
                  isDealer={players.indexOf(player) === dealerPosition}
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
            {players
              .filter((_, i) => i !== players.findIndex((p) => p.is_human))
              .slice(Math.ceil(players.length / 2))
              .map((player) => (
                <PlayerSeat
                  key={player.name}
                  player={player}
                  isDealer={players.indexOf(player) === dealerPosition}
                />
              ))}
          </div>

          {/* Human player */}
          <div className="flex justify-center">
            {players
              .filter((p) => p.is_human)
              .map((player) => (
                <PlayerSeat
                  key={player.name}
                  player={player}
                  isDealer={players.indexOf(player) === dealerPosition}
                />
              ))}
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
  )
}
