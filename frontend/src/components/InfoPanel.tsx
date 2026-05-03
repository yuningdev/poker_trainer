import { useState } from 'react'
import { useGameStore } from '../store/gameStore'

type Tab = 'table' | 'odds'

export default function InfoPanel() {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>('table')
  const { roomConfig, roomName, humanEquity, phase } = useGameStore()

  const bigBlind = roomConfig?.big_blind ?? 0
  const smallBlind = bigBlind / 2
  const startingChips = roomConfig?.starting_chips ?? 0
  const timeBank = roomConfig?.time_bank ?? 0
  const botStrategy = roomConfig?.bot_strategy ?? '—'
  const totalSeats = roomConfig?.total_seats ?? 0

  return (
    <>
      {/* Floating info button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-4 z-30 w-9 h-9 rounded-full bg-gray-800 border border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700 flex items-center justify-center text-base font-bold transition shadow-lg"
        title="Table info & odds"
        aria-label="Open info panel"
      >
        &#9432;
      </button>

      {/* Panel overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 flex items-end sm:items-center justify-center sm:justify-end p-0 sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-gray-900 border border-gray-700 rounded-t-2xl sm:rounded-2xl w-full sm:w-80 max-h-[70vh] sm:max-h-[600px] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <span className="text-white font-bold text-sm">Info</span>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-white text-lg leading-none transition"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800">
              <button
                onClick={() => setTab('table')}
                className={`flex-1 text-xs font-semibold py-2 transition ${
                  tab === 'table'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Table Info
              </button>
              <button
                onClick={() => setTab('odds')}
                className={`flex-1 text-xs font-semibold py-2 transition ${
                  tab === 'odds'
                    ? 'text-white border-b-2 border-yellow-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                Odds / 2&amp;4
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {tab === 'table' && (
                <div className="flex flex-col gap-3">
                  <Row label="Room" value={roomName ?? '—'} />
                  <Row label="Small blind" value={smallBlind} />
                  <Row label="Big blind" value={bigBlind} />
                  <Row label="Starting chips" value={startingChips} />
                  <Row label="Time bank" value={timeBank > 0 ? `${timeBank}s` : 'Unlimited'} />
                  <Row label="Bot strategy" value={botStrategy} />
                  <Row label="Total seats" value={totalSeats} />
                </div>
              )}

              {tab === 'odds' && (
                <div className="flex flex-col gap-4">
                  {/* Current equity */}
                  <div className="text-center">
                    <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">
                      Your current equity
                    </p>
                    {humanEquity != null ? (
                      <p className="text-yellow-400 text-4xl font-bold">
                        ~{humanEquity}%
                      </p>
                    ) : (
                      <p className="text-gray-500 text-sm">Not available</p>
                    )}
                    <p className="text-gray-500 text-xs mt-1">
                      Phase: {phase.replace('_', ' ')}
                    </p>
                  </div>

                  {/* Rule of 2&4 explanation */}
                  <div className="bg-gray-800 rounded-xl p-3 flex flex-col gap-2 text-xs text-gray-300">
                    <p className="font-bold text-gray-100 text-sm">Rule of 2 &amp; 4</p>
                    <p>
                      Count your <span className="text-yellow-300 font-semibold">outs</span> (cards
                      that complete your hand), then:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-gray-400">
                      <li>
                        <span className="text-gray-200 font-semibold">Flop</span> (2 cards to come):
                        outs &times; 4
                      </li>
                      <li>
                        <span className="text-gray-200 font-semibold">Turn</span> (1 card to come):
                        outs &times; 2
                      </li>
                    </ul>
                    <p className="text-gray-500">
                      Example: 9 outs on the flop ≈ 36% chance to hit.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-100 font-semibold">{value}</span>
    </div>
  )
}
