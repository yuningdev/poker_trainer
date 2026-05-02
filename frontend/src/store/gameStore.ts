import { create } from 'zustand'
import type {
  GameState,
  ServerMessage,
  Phase,
  RoomStateMsg,
  WelcomeMsg,
} from '../types'

let _logId = 0

function parseActionLabel(text: string): string | null {
  if (text === 'folds') return 'FOLD'
  if (text === 'checks') return 'CHECK'
  if (text.startsWith('calls')) return 'CALL'
  if (text.startsWith('raises')) return 'RAISE'
  if (text === 'goes all-in') return 'ALL-IN'
  return null
}

// Generate or retrieve persistent player ID
const _myPlayerId: string = localStorage.getItem('poker_player_id') ?? (() => {
  const id = crypto.randomUUID()
  localStorage.setItem('poker_player_id', id)
  return id
})()

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
  humanEquity: null,
  currentRoundActions: {},
  // Room state
  roomId: null,
  roomName: null,
  roomConfig: null,
  roomPlayers: [],
  roomStatus: null,
  hostId: null,
  myPlayerId: _myPlayerId,
  timeRemaining: null,
  isCurrentPlayerHost: false,
}

interface GameStore extends GameState {
  setConnected: (v: boolean) => void
  dispatch: (msg: ServerMessage) => void
  clearPendingAction: () => void
  reset: () => void
  setRoomState: (msg: RoomStateMsg) => void
  setWelcome: (msg: WelcomeMsg) => void
  addRoomPlayer: (player: { player_id: string; name: string }) => void
  removeRoomPlayer: (player_id: string) => void
  setTimeRemaining: (seconds: number | null) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  setConnected: (connected) => set({ connected }),

  reset: () => set((s) => ({
    ...initialState,
    connected: s.connected,
    // Preserve room & identity state across resets
    myPlayerId: s.myPlayerId,
    roomId: s.roomId,
    roomName: s.roomName,
    roomConfig: s.roomConfig,
    roomPlayers: s.roomPlayers,
    roomStatus: s.roomStatus,
    hostId: s.hostId,
    isCurrentPlayerHost: s.isCurrentPlayerHost,
  })),

  clearPendingAction: () => set({ pendingAction: null }),

  setRoomState: (msg: RoomStateMsg) => set({
    roomId: msg.room_id,
    roomName: msg.room_name,
    hostId: msg.host_id,
    roomPlayers: msg.players,
    roomStatus: msg.status,
    roomConfig: msg.config,
  }),

  setWelcome: (msg: WelcomeMsg) => {
    // Trust the server's view of who we are. If our localStorage player_id
    // diverged (e.g., backend regenerated it), this corrects it so badges
    // and ACTION_REQUIRED filtering work consistently.
    if (msg.player_id) {
      localStorage.setItem('poker_player_id', msg.player_id)
    }
    set({
      isCurrentPlayerHost: msg.is_host,
      myPlayerId: msg.player_id,
    })
  },

  addRoomPlayer: (player) => set((s) => ({
    roomPlayers: [...s.roomPlayers, player],
  })),

  removeRoomPlayer: (player_id) => set((s) => ({
    roomPlayers: s.roomPlayers.filter((p) => p.player_id !== player_id),
  })),

  setTimeRemaining: (seconds) => set({ timeRemaining: seconds }),

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
          humanEquity: msg.human_equity ?? null,
        })
        break
      }

      case 'ACTION_REQUIRED': {
        const { roomConfig, myPlayerId } = get()
        // In multiplayer, only activate the action panel for the player whose
        // turn it is. Single-player events have no player_id — always show.
        const isMyTurn = !msg.player_id || msg.player_id === myPlayerId
        if (!isMyTurn) break
        set({
          pendingAction: msg,
          timeRemaining: (roomConfig && roomConfig.time_bank > 0) ? roomConfig.time_bank : null,
        })
        break
      }

      case 'PHASE_CHANGE':
        set({ showdown: null, currentRoundActions: {} })
        break

      case 'ACTION_LOG': {
        const label = parseActionLabel(msg.text)
        set((s) => ({
          log: [...s.log, { id: _logId++, player: msg.player, text: msg.text }],
          currentRoundActions: label
            ? { ...s.currentRoundActions, [msg.player]: label }
            : s.currentRoundActions,
        }))
        break
      }

      case 'SHOWDOWN':
        set({ showdown: msg.players, pendingAction: null })
        break

      case 'HAND_RESULT':
        set({ lastResult: msg, pendingAction: null, currentRoundActions: {} })
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
          currentRoundActions: {},
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

      case 'ROOM_STATE':
        get().setRoomState(msg)
        break

      case 'WELCOME':
        get().setWelcome(msg)
        break

      case 'PLAYER_JOINED':
        get().addRoomPlayer({ player_id: msg.player_id, name: msg.name })
        break

      case 'PLAYER_LEFT':
        get().removeRoomPlayer(msg.player_id)
        break

      case 'TIME_WARNING':
        set({ timeRemaining: msg.seconds_remaining })
        break
    }
  },
}))
