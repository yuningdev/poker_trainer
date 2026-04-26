import { useEffect, useRef, useCallback, useState } from 'react'
import { useGameStore } from './store/gameStore'
import { usePokerSocket } from './hooks/usePokerSocket'
import { useHistoryStore } from './store/historyStore'
import GameTable from './components/GameTable'
import ActionPanel from './components/ActionPanel'
import HandResultOverlay from './components/HandResultOverlay'
import HistoryView from './components/HistoryView'

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
  const { connected, started, gameOver, log, handNum } = useGameStore()
  const addRecord = useHistoryStore((s) => s.addRecord)
  const [showHistory, setShowHistory] = useState(false)
  const autoStarted = useRef(false)

  // Auto-start exactly once when WebSocket first connects
  useEffect(() => {
    if (connected && !autoStarted.current) {
      autoStarted.current = true
      startGame(DEFAULT_CONFIG)
    }
  }, [connected, startGame])

  // Auto-save game record when game ends
  useEffect(() => {
    if (gameOver) {
      addRecord({
        date: new Date().toISOString(),
        winner: gameOver.winner,
        winnerChips: gameOver.chips,
        handsPlayed: handNum,
        log: [...log],
      })
    }
  }, [gameOver]) // intentionally only track gameOver changes

  const handlePlayAgain = useCallback(() => {
    startGame(DEFAULT_CONFIG)
  }, [startGame])

  const handleViewHistory = useCallback(() => {
    setShowHistory(true)
  }, [])

  const handleNewGame = useCallback(() => {
    setShowHistory(false)
    startGame(DEFAULT_CONFIG)
  }, [startGame])

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

  if (showHistory) {
    return (
      <HistoryView
        onBack={() => setShowHistory(false)}
        onNewGame={handleNewGame}
      />
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
      <HandResultOverlay onPlayAgain={handlePlayAgain} onViewHistory={handleViewHistory} />
      {/* History button — top-right corner */}
      <button
        onClick={() => setShowHistory(true)}
        className="fixed top-3 right-3 z-30 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition border border-gray-700"
      >
        History
      </button>
    </>
  )
}
