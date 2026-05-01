import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'

export function LobbyPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'create' | 'join'>('create')

  // Create room form state
  const [roomName, setRoomName] = useState('My Poker Room')
  const [totalSeats, setTotalSeats] = useState(6)
  const [bigBlind, setBigBlind] = useState(20)
  const [startingChips, setStartingChips] = useState(1000)
  const [timeBank, setTimeBank] = useState(30)
  const [botStrategy, setBotStrategy] = useState('random')
  const [playerName, setPlayerName] = useState(
    localStorage.getItem('poker_player_name') || ''
  )
  const [joinCode, setJoinCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const myPlayerId = useGameStore((s) => s.myPlayerId)

  async function handleCreate() {
    if (!playerName.trim()) { setError('Enter your name'); return }
    setLoading(true)
    setError('')
    try {
      localStorage.setItem('poker_player_name', playerName)
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host_id: myPlayerId,
          room_name: roomName,
          total_seats: totalSeats,
          big_blind: bigBlind,
          starting_chips: startingChips,
          time_bank: timeBank,
          bot_strategy: botStrategy,
        }),
      })
      const data = await res.json()
      navigate(`/room/${data.room_id}`)
    } catch {
      setError('Failed to create room')
    } finally {
      setLoading(false)
    }
  }

  function handleJoin() {
    if (!playerName.trim()) { setError('Enter your name'); return }
    if (!joinCode.trim()) { setError('Enter a room code'); return }
    setError('')
    localStorage.setItem('poker_player_name', playerName)
    navigate(`/room/${joinCode.trim().toUpperCase()}`)
  }

  return (
    <div className="min-h-screen bg-green-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Poker Room</h1>
        <p className="text-gray-400 text-center mb-6">Play Texas Hold'em with friends</p>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
          {(['create', 'join'] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError('') }}
              className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
                tab === t ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t === 'create' ? 'Create Room' : 'Join Room'}
            </button>
          ))}
        </div>

        {/* Player name (always shown) */}
        <div className="mb-4">
          <label className="block text-gray-300 text-sm mb-1">Your Name</label>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 outline-none"
          />
        </div>

        {tab === 'create' ? (
          <>
            <div className="mb-4">
              <label className="block text-gray-300 text-sm mb-1">Room Name</label>
              <input
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-gray-300 text-sm mb-1">Total Seats</label>
                <select
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(+e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                >
                  {[2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Big Blind</label>
                <select
                  value={bigBlind}
                  onChange={(e) => setBigBlind(+e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                >
                  {[10, 20, 50, 100, 200].map((n) => (
                    <option key={n} value={n}>${n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Starting Chips</label>
                <select
                  value={startingChips}
                  onChange={(e) => setStartingChips(+e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                >
                  {[500, 1000, 2000, 5000, 10000].map((n) => (
                    <option key={n} value={n}>{n.toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-1">Time Bank (sec)</label>
                <select
                  value={timeBank}
                  onChange={(e) => setTimeBank(+e.target.value)}
                  className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
                >
                  {[0, 15, 20, 30, 45, 60].map((n) => (
                    <option key={n} value={n}>{n === 0 ? 'Unlimited' : `${n}s`}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm mb-1">Bot Strategy</label>
              <select
                value={botStrategy}
                onChange={(e) => setBotStrategy(e.target.value)}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700"
              >
                <option value="random">Random (Beginner)</option>
                <option value="passive">Passive (Easy)</option>
                <option value="aggressive">Aggressive (Hard)</option>
              </select>
            </div>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleCreate}
              disabled={loading}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-gray-300 text-sm mb-1">Room Code</label>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={6}
                className="w-full bg-gray-800 text-white rounded-lg px-3 py-2 border border-gray-700 focus:border-green-500 outline-none font-mono text-lg tracking-widest text-center uppercase"
              />
            </div>
            {error && <p className="text-red-400 text-sm mb-3">{error}</p>}
            <button
              onClick={handleJoin}
              className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Join Room
            </button>
          </>
        )}
      </div>
    </div>
  )
}
