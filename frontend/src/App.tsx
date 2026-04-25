import { useEffect } from 'react'
import { useGameStore } from './store/gameStore'
import { usePokerSocket } from './hooks/usePokerSocket'
import GameTable from './components/GameTable'
import ActionPanel from './components/ActionPanel'

const DEFAULT_CONFIG = {
  human_name: 'You',
  starting_chips: 1000,
  small_blind: 10,
  big_blind: 20,
  bots: [
    { name: 'Alice', strategy: 'aggressive' as const },
    { name: 'Bob',   strategy: 'passive'    as const },
    { name: 'Carol', strategy: 'random'     as const },
  ],
}

export default function App() {
  const { startGame, sendAction } = usePokerSocket()
  const { connected, started } = useGameStore()

  // Auto-start once connected
  useEffect(() => {
    if (connected && !started) {
      startGame(DEFAULT_CONFIG)
    }
  }, [connected, started, startGame])

  if (!connected) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="text-4xl mb-4">♠</div>
          <p className="text-gray-400">Connecting to server…</p>
        </div>
      </div>
    )
  }

  if (!started) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <p className="text-gray-400">Starting game…</p>
      </div>
    )
  }

  return (
    <>
      <GameTable onAction={sendAction} />
      <ActionPanel onAction={sendAction} />
    </>
  )
}
