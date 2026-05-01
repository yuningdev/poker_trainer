import { useEffect, useCallback, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { usePokerSocket } from '../hooks/usePokerSocket'
import { useHistoryStore } from '../store/historyStore'
import { RoomLobby } from '../components/RoomLobby'
import GameTable from '../components/GameTable'
import ActionPanel from '../components/ActionPanel'
import HandResultOverlay from '../components/HandResultOverlay'
import HistoryView from '../components/HistoryView'

export function RoomPage() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>()
  const { roomStatus, gameOver, log, handNum } = useGameStore()
  const { startGame, sendAction } = usePokerSocket(paramRoomId ?? null)
  const addRecord = useHistoryStore((s) => s.addRecord)
  const [showHistory, setShowHistory] = useState(false)

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
    startGame()
  }, [startGame])

  const handleViewHistory = useCallback(() => {
    setShowHistory(true)
  }, [])

  const handleNewGame = useCallback(() => {
    setShowHistory(false)
    startGame()
  }, [startGame])

  if (showHistory) {
    return (
      <HistoryView
        onBack={() => setShowHistory(false)}
        onNewGame={handleNewGame}
      />
    )
  }

  // Not yet connected / no room state received
  if (!roomStatus) {
    return (
      <div className="min-h-screen bg-green-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 text-white">♠</div>
          <p className="text-gray-400">Connecting...</p>
        </div>
      </div>
    )
  }

  if (roomStatus === 'waiting') {
    return <RoomLobby onStart={startGame} />
  }

  // roomStatus === 'playing' | 'finished'
  return (
    <>
      <GameTable onAction={sendAction} />
      <ActionPanel onAction={sendAction} />
      <HandResultOverlay onPlayAgain={handlePlayAgain} onViewHistory={handleViewHistory} />
      <button
        onClick={() => setShowHistory(true)}
        className="fixed top-3 right-3 z-30 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 hover:text-white rounded-lg text-xs font-medium transition border border-gray-700"
      >
        History
      </button>
    </>
  )
}
