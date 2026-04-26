import { create } from 'zustand'
import type {
  GameState,
  ServerMessage,
  Phase,
} from '../types'

let _logId = 0

const initialState: GameState = {
  connected: false,
  started: false,
  phase: 'PRE_FLOP',
  handNum: 0,
  pot: 0,
  communityCards: [],
  dealerPosition: 0,
  players: [],
  pendingAction: null,
  log: [],
  showdown: null,
  lastResult: null,
  gameOver: null,
  dealRevision: 0,
  humanBust: false,
}

interface GameStore extends GameState {
  setConnected: (v: boolean) => void
  dispatch: (msg: ServerMessage) => void
  clearPendingAction: () => void
  reset: () => void
}

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  reset: () => set((s) => ({ ...initialState, connected: s.connected })),

  clearPendingAction: () => set({ pendingAction: null }),

  dispatch: (msg: ServerMessage) => {
    switch (msg.type) {
      case 'TABLE_STATE': {
        const humanBust = msg.players.some((p) => p.is_human && p.status === 'bust')
        set({
          started: true,
          phase: msg.phase as Phase,
          pot: msg.pot,
          communityCards: msg.community_cards,
          dealerPosition: msg.dealer_position,
          players: msg.players,
          humanBust,
        })
        break
      }

      case 'ACTION_REQUIRED':
        set({ pendingAction: msg })
        break

      case 'PHASE_CHANGE':
        set({ showdown: null })
        break

      case 'ACTION_LOG':
        set((s) => ({
          log: [...s.log, { id: _logId++, player: msg.player, text: msg.text }],
        }))
        break

      case 'SHOWDOWN':
        set({ showdown: msg.players, pendingAction: null })
        break

      case 'HAND_RESULT':
        set({ lastResult: msg, pendingAction: null })
        break

      case 'PLAYER_BUST':
        set((s) => ({
          log: [
            ...s.log,
            { id: _logId++, player: msg.player, text: 'has been eliminated 💀' },
          ],
        }))
        break

      case 'NEW_HAND':
        set((s) => ({
          handNum: msg.hand_num,
          showdown: null,
          lastResult: null,
          dealRevision: s.dealRevision + 1,
          log: [
            ...s.log,
            { id: _logId++, player: '—', text: `Hand #${msg.hand_num} begins` },
          ],
        }))
        break

      case 'GAME_OVER':
        set({ gameOver: msg, pendingAction: null })
        break

      case 'MESSAGE':
        set((s) => ({
          log: [...s.log, { id: _logId++, player: '·', text: msg.text }],
        }))
        break

      case 'ERROR':
        console.warn('[WS Error]', msg.message)
        break
    }
  },
}))
