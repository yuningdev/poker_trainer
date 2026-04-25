import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'

export default function ActionLog() {
  const log = useGameStore((s) => s.log)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  return (
    <div className="h-full overflow-y-auto flex flex-col gap-1 text-xs px-2">
      {log.map((entry) => (
        <div key={entry.id} className="flex gap-1">
          <span className="text-gray-500 shrink-0">{entry.player}:</span>
          <span className="text-gray-300">{entry.text}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
