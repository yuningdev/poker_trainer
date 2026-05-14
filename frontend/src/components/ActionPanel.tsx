import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import RaiseSlider from './RaiseSlider'
import { TimerBar } from './TimerBar'
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
  fold:   'bg-gray-700 hover:bg-gray-600 active:bg-gray-500',
  check:  'bg-gray-600 hover:bg-gray-500 active:bg-gray-400',
  call:   'bg-blue-700 hover:bg-blue-600 active:bg-blue-500',
  raise:  'bg-gray-500 hover:bg-gray-400 active:bg-gray-300',
  all_in: 'bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-amber-200',
}

export default function ActionPanel({ onAction }: Props) {
  const pendingAction = useGameStore((s) => s.pendingAction)
  const pendingNewHand = useGameStore((s) => s.pendingNewHand)
  const clearPendingAction = useGameStore((s) => s.clearPendingAction)
  const timeRemaining = useGameStore((s) => s.timeRemaining)
  const roomConfig = useGameStore((s) => s.roomConfig)
  const [raiseAmount, setRaiseAmount] = useState<number>(0)
  const [showRaise, setShowRaise] = useState(false)

  // Don't show while the hand result modal is open — wait for host to confirm
  if (!pendingAction || pendingNewHand) return null

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
    <div className="fixed bottom-0 left-0 right-0 bg-[#0d1117]/97 border-t border-[#2a3347]
      p-3 sm:p-4 [@media(max-height:500px)]:p-1.5 z-30">
      <div className="max-w-lg mx-auto flex flex-col gap-2 [@media(max-height:500px)]:gap-1">
        {/* Timer bar */}
        {timeRemaining !== null && roomConfig?.time_bank ? (
          <TimerBar seconds={timeRemaining} total={roomConfig.time_bank} />
        ) : null}

        {/* Call info */}
        {call_amount > 0 && (
          <div className="text-center text-xs [@media(max-height:500px)]:text-[10px] text-gray-400">
            Call: <span className="text-white font-semibold">{call_amount}</span>
          </div>
        )}

        {/* Raise slider */}
        {showRaise && legal_actions.includes('raise') && (
          <RaiseSlider
            min={min_raise}
            max={max_raise}
            bigBlind={roomConfig?.big_blind ?? 20}
            onChange={(v) => setRaiseAmount(v)}
          />
        )}

        {/* Action buttons — min 44px height for mobile touch targets */}
        <div className="flex gap-1.5 [@media(max-height:500px)]:gap-1 justify-center flex-wrap">
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
              className={`min-h-[44px] [@media(max-height:500px)]:min-h-[34px]
                px-4 [@media(max-height:500px)]:px-3
                py-2 [@media(max-height:500px)]:py-0.5
                rounded-lg text-white font-semibold
                text-sm [@media(max-height:500px)]:text-xs
                transition ${ACTION_COLOR[action] ?? 'bg-gray-600 hover:bg-gray-500'}`}
            >
              {ACTION_LABEL[action]}
              {action === 'call' && call_amount > 0 && ` (${call_amount})`}
            </button>
          ))}
          {/* Confirm raise */}
          {showRaise && (
            <button
              onClick={() => handleAction('raise')}
              className="min-h-[44px] [@media(max-height:500px)]:min-h-[34px]
                px-4 [@media(max-height:500px)]:px-3
                py-2 [@media(max-height:500px)]:py-0.5
                rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-semibold
                text-sm [@media(max-height:500px)]:text-xs"
            >
              Confirm {raiseAmount || min_raise}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
