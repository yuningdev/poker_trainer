import { useState } from 'react'
import { useGameStore } from '../store/gameStore'

interface Props {
  onStart: () => void
}

export function RoomLobby({ onStart }: Props) {
  const { roomId, roomName, roomPlayers, roomConfig, hostId, myPlayerId } = useGameStore()
  const [copied, setCopied] = useState(false)
  const isHost = myPlayerId === hostId

  const inviteLink = `${window.location.origin}/room/${roomId}`

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const botSeats = Math.max(0, (roomConfig?.total_seats ?? 0) - roomPlayers.length)

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{roomName}</h2>
            <span className="text-gray-400 font-mono text-sm">Room: {roomId}</span>
          </div>
          <span className="bg-yellow-500/20 text-yellow-400 text-xs px-3 py-1 rounded-full font-medium">
            Waiting
          </span>
        </div>

        {/* Invite link */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <p className="text-gray-400 text-xs mb-2">Invite Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteLink}
              className="flex-1 bg-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 outline-none truncate"
            />
            <button
              onClick={copyLink}
              className="bg-green-600 hover:bg-green-500 text-white text-sm px-4 py-2 rounded-lg transition-colors whitespace-nowrap"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Players */}
        <div className="mb-6">
          <h3 className="text-gray-400 text-sm mb-3">
            Players ({roomPlayers.length}/{roomConfig?.total_seats})
          </h3>
          <div className="space-y-2">
            {roomPlayers.map((p) => (
              <div
                key={p.player_id}
                className="flex items-center gap-3 bg-gray-800 rounded-lg px-4 py-3"
              >
                <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center text-white text-sm font-bold">
                  {p.name[0]?.toUpperCase()}
                </div>
                <span className="text-white font-medium">{p.name}</span>
                {p.player_id === hostId && p.player_id !== myPlayerId && (
                  <span className="ml-auto text-xs text-yellow-400">Host</span>
                )}
                {p.player_id === myPlayerId && p.player_id === hostId && (
                  <span className="ml-auto text-xs text-yellow-400">Host (You)</span>
                )}
                {p.player_id === myPlayerId && p.player_id !== hostId && (
                  <span className="ml-auto text-xs text-green-400">You</span>
                )}
              </div>
            ))}
            {Array.from({ length: botSeats }).map((_, i) => (
              <div
                key={`bot-${i}`}
                className="flex items-center gap-3 bg-gray-800/50 rounded-lg px-4 py-3 opacity-60"
              >
                <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-gray-400 text-sm">
                  B
                </div>
                <span className="text-gray-500">Bot Player</span>
              </div>
            ))}
          </div>
        </div>

        {/* Room settings summary */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6 grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-500">Blinds</span>
            <p className="text-white font-medium">
              ${roomConfig?.big_blind ? roomConfig.big_blind / 2 : 0}/${roomConfig?.big_blind}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Starting Chips</span>
            <p className="text-white font-medium">
              {roomConfig?.starting_chips?.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Time Bank</span>
            <p className="text-white font-medium">
              {roomConfig?.time_bank === 0 ? 'Unlimited' : `${roomConfig?.time_bank}s`}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Bots</span>
            <p className="text-white font-medium">
              {botSeats} x {roomConfig?.bot_strategy}
            </p>
          </div>
        </div>

        {isHost ? (
          <button
            onClick={onStart}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
          >
            Start Game
          </button>
        ) : (
          <p className="text-center text-gray-400">Waiting for host to start the game...</p>
        )}
      </div>
    </div>
  )
}
