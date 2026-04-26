import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import RaiseSlider from './RaiseSlider'
import type { ActionType } from '../types'

interface Props {
  onAction: (action: ActionType, amount?: number) => void
}

const ACTION_LABEL: Record<ActionType, string> = {
  fold: 'Fold',
  check: 'Check',
  call: 'Call',
  raise: 'Raise',
  all_in: 'All-in',
}

const ACTION_COLOR: Record<ActionType, string> = {
  fold: 'bg-red-700 hover:bg-red-600',
  check: 'bg-gray-600 hover:bg-gray-500',
  call: 'bg-blue-700 hover:bg-blue-600',
  raise: 'bg-yellow-600 hover:bg-yellow-500',
  all_in: 'bg-orange-600 hover:bg-orange-500',
}

export default function ActionPanel({ onAction }: Props) {
  const pendingAction = useGameStore((s) => s.pendingAction)
  const clearPendingAction = useGameStore((s) => s.clearPendingAction)
  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  const [showRaise, setShowRaise] = useState(false)

  if (!pendingAction) return null

  const { legal_actions, call_amount, min_raise, max_raise } = pendingAction

  const handleAction = (action: ActionType) => {
    clearPendingAction()
    setShowRaise(false)
    if (action === 'raise') {
      onAction('raise', raiseAmount || min_raise)
    } else if (action === 'call') {
      onAction('call', call_amount)
    } else if (action === 'all_in') {
      onAction('all_in', pendingAction.player_chips)
    } else {
      onAction(action, 0)
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 border-t border-gray-700 p-4">
      <div className="max-w-lg mx-auto flex flex-col gap-3">
        {/* Call info */}
        {call_amount > 0 && (
          <div className="text-center text-sm text-gray-400">
            Call amount: <span className="text-blue-300 font-semibold">{call_amount}</span>
          </div>
        )}

        {/* Raise slider */}
        {showRaise && legal_actions.includes('raise') && (
          <RaiseSlider
            min={min_raise}
            max={max_raise}
            onChange={(v) => setRaiseAmount(v)}
          />
        )}

        {/* Action buttons */}
        <div className="flex gap-2 justify-center flex-wrap">
          {legal_actions.map((action) => (
            <button
              key={action}
              onClick={() => {
                if (action === 'raise') {
                  setShowRaise((v) => !v)
                  setRaiseAmount(min_raise)
                } else {
                  handleAction(action)
                }
              }}
              className={`px-5 py-2 rounded-lg text-white font-semibold text-sm transition
                ${ACTION_COLOR[action] ?? 'bg-gray-600 hover:bg-gray-500'}`}
            >
              {ACTION_LABEL[action]}
              {action === 'call' && call_amount > 0 && ` (${call_amount})`}
            </button>
          ))}
          {/* Confirm raise */}
          {showRaise && (
            <button
              onClick={() => handleAction('raise')}
              className="px-5 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold text-sm"
            >
              Confirm {raiseAmount || min_raise}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
