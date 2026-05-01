interface Props {
  seconds: number
  total: number
}

export function TimerBar({ seconds, total }: Props) {
  const pct = total > 0 ? (seconds / total) * 100 : 0
  const color =
    seconds <= 5 ? 'bg-red-500' : seconds <= 10 ? 'bg-yellow-500' : 'bg-green-500'

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Time remaining</span>
        <span className={seconds <= 5 ? 'text-red-400 font-bold' : ''}>{seconds}s</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
