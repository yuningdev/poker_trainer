import { useState } from 'react'

interface Props {
  min: number
  max: number
  onChange: (amount: number) => void
}

export default function RaiseSlider({ min, max, onChange }: Props) {
  const [value, setValue] = useState(min)

  const handleChange = (v: number) => {
    setValue(v)
    onChange(v)
  }

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{min}</span>
        <span className="text-yellow-300 font-bold text-sm">{value}</span>
        <span>{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={Math.max(1, Math.floor((max - min) / 100))}
        onChange={(e) => handleChange(Number(e.target.value))}
        className="w-full accent-yellow-400"
      />
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => handleChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="bg-gray-700 text-white text-center rounded px-2 py-1 text-sm w-full"
      />
    </div>
  )
}
