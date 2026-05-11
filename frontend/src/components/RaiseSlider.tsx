/**
 * RaiseSlider — raise amount picker.
 *
 * - Slider snaps to 0.5 BB increments.
 * - Quick buttons for 1 BB … 5 BB (filtered to the legal range).
 * - "Max" button for all-in.
 */
import { useState, useEffect } from 'react'

interface Props {
  min: number
  max: number
  bigBlind: number
  onChange: (amount: number) => void
}

export default function RaiseSlider({ min, max, bigBlind, onChange }: Props) {
  const halfBb = Math.max(1, Math.floor(bigBlind / 2))

  const snapToHalfBb = (v: number) => {
    const snapped = Math.round(v / halfBb) * halfBb
    return Math.max(min, Math.min(max, snapped))
  }

  const [value, setValue] = useState(() => snapToHalfBb(min))

  // Re-initialize if min changes (new hand / new action)
  useEffect(() => {
    const initial = snapToHalfBb(min)
    setValue(initial)
    onChange(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min])

  const handleChange = (raw: number) => {
    const v = snapToHalfBb(raw)
    setValue(v)
    onChange(v)
  }

  // Quick-bet buttons: 1 BB, 2 BB, 3 BB, 4 BB, 5 BB — only show if in legal range
  const quickBets = [1, 2, 3, 4, 5]
    .map((mult) => ({ label: `${mult}BB`, amount: bigBlind * mult }))
    .filter((q) => q.amount >= min && q.amount <= max)

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Quick-bet row */}
      <div className="flex gap-1 flex-wrap justify-center">
        {quickBets.map((q) => (
          <button
            key={q.label}
            onClick={() => handleChange(q.amount)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition
              ${value === q.amount
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}
          >
            {q.label}
          </button>
        ))}
        {max > min && (
          <button
            onClick={() => handleChange(max)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition
              ${value === max
                ? 'bg-red-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-amber-300'}`}
          >
            All-in
          </button>
        )}
      </div>

      {/* Slider */}
      <div className="flex justify-between text-xs text-gray-400 px-1">
        <span>{min}</span>
        <span className="text-yellow-300 font-bold text-base">{value}</span>
        <span>{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={halfBb}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full accent-yellow-400"
      />
    </div>
  )
}
