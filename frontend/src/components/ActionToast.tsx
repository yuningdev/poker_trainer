/**
 * ActionToast — full-width banner shown below the community cards whenever
 * a player acts.  Displays the player name + action in large, colour-coded text
 * so it is impossible to miss who did what and for how much.
 *
 * Triggered by new ACTION_LOG entries.  Fades out automatically after ~1.8 s.
 */

import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../store/gameStore'

interface Toast {
  key: number
  player: string
  label: string
  amount: string
  color: string
}

function parseToast(player: string, text: string): Omit<Toast, 'key'> | null {
  // Skip system / narrator lines
  if (player === '—' || player === '·') return null

  if (text === 'folds') return { player, label: 'FOLD', amount: '', color: 'text-gray-400' }
  if (text === 'checks') return { player, label: 'CHECK', amount: '', color: 'text-gray-200' }
  if (text === 'goes all-in') return { player, label: 'ALL IN', amount: '', color: 'text-amber-300' }

  const callM = text.match(/^calls (\d+)$/)
  if (callM) return { player, label: 'CALL', amount: callM[1], color: 'text-blue-300' }

  const raiseM = text.match(/^raises to (\d+)$/)
  if (raiseM) return { player, label: 'RAISE', amount: raiseM[1], color: 'text-green-300' }

  const sbM = text.match(/^posts small blind (\d+)$/)
  if (sbM) return { player, label: 'SMALL BLIND', amount: sbM[1], color: 'text-gray-400' }

  const bbM = text.match(/^posts big blind (\d+)$/)
  if (bbM) return { player, label: 'BIG BLIND', amount: bbM[1], color: 'text-gray-400' }

  const winsM = text.match(/^wins (\d+)/)
  if (winsM) return { player, label: 'WINS', amount: winsM[1], color: 'text-yellow-300' }

  return null
}

export function ActionToast() {
  const log = useGameStore((s) => s.log)
  const [toast, setToast] = useState<Toast | null>(null)
  const [visible, setVisible] = useState(false)
  const lastIdRef = useRef(-1)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toastCountRef = useRef(0)

  useEffect(() => {
    const newEntries = log.filter((e) => e.id > lastIdRef.current)
    if (newEntries.length === 0) return

    // Find the last meaningful action in the batch
    let parsed: Omit<Toast, 'key'> | null = null
    for (const entry of newEntries) {
      const p = parseToast(entry.player, entry.text)
      if (p) parsed = p
      if (entry.id > lastIdRef.current) lastIdRef.current = entry.id
    }
    if (!parsed) return

    // Clear any pending fade timer
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)

    const key = ++toastCountRef.current
    setToast({ ...parsed, key })
    setVisible(true)

    fadeTimerRef.current = setTimeout(() => setVisible(false), 1600)
  }, [log])

  if (!toast) return null

  return (
    <div
      className={`pointer-events-none select-none transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      style={{ position: 'absolute', bottom: '12%', left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 25 }}
    >
      <div className="flex flex-col items-center gap-0.5 bg-black/55 backdrop-blur-sm rounded-2xl px-6 py-2.5 shadow-xl">
        <span className="text-gray-400 text-xs font-semibold uppercase tracking-widest leading-none">
          {toast.player}
        </span>
        <span className={`font-black text-2xl sm:text-3xl leading-tight tracking-wide ${toast.color}`}>
          {toast.label}
          {toast.amount && (
            <span className="text-white ml-2">{toast.amount}</span>
          )}
        </span>
      </div>
    </div>
  )
}
