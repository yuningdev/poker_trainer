import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { LogEntry } from '../types'

export interface GameRecord {
  id: number
  date: string
  winner: string
  winnerChips: number
  handsPlayed: number
  log: LogEntry[]
}

interface HistoryState {
  records: GameRecord[]
  addRecord: (r: Omit<GameRecord, 'id'>) => void
}

let _nextId = 1

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      records: [],
      addRecord: (r) =>
        set((s) => ({
          records: [{ ...r, id: _nextId++ }, ...s.records],
        })),
    }),
    { name: 'poker-history' }
  )
)
