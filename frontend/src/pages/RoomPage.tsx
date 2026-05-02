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

function NamePrompt({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) { setErr('Please enter your name'); return }
    onSubmit(trimmed)
  }

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-2">Join Room</h2>
        <p className="text-gray-400 text-sm mb-6">Enter your name to join the table.</p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your name"
          className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 outline-none mb-3"
        />
        {err && <p className="text-red-400 text-sm mb-3">{err}</p>}
        <button
          onClick={submit}
          className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
        >
          Join
        </button>
      </div>
    </div>
  )
}

export function RoomPage() {
  const { roomId: paramRoomId } = useParams<{ roomId: string }>()
  const { roomStatus, gameOver, log, handNum } = useGameStore()
  const [hasName, setHasName] = useState<boolean>(
    () => !!localStorage.getItem('poker_player_name')
  )

  // Hook is called unconditionally; pass null until the user has entered a name
  // so the WebSocket only connects after we have a real name to send.
  const { startGame, sendAction } = usePokerSocket(hasName ? paramRoomId ?? null : null)
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

  // Guest opened the invite link without setting a name — prompt first.
  if (!hasName) {
    return (
      <NamePrompt
        onSubmit={(name) => {
          localStorage.setItem('poker_player_name', name)
          setHasName(true)
        }}
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
