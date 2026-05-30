import { create } from 'zustand'
import type {
  GameState,
  ServerMessage,
  Phase,
  RoomStateMsg,
  WelcomeMsg,
  TableStateMsg,
} from '../types'

let _logId = 0

function parseActionLabel(text: string): string | null {
  if (text === 'folds') return 'FOLD'
  if (text === 'checks') return 'CHECK'
  if (text.startsWith('calls')) {
    const m = text.match(/calls (\d+)/)
    return m ? `CALL ${m[1]}` : 'CALL'
  }
  if (text.startsWith('raises')) {
    const m = text.match(/raises to (\d+)/)
    return m ? `RAISE ${m[1]}` : 'RAISE'
  }
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
  pendingNewHand: null,
  bufferedTableState: null,
  bufferedPendingAction: null,
  thinkingPlayer: null,
  thinkingPlayerName: null,
  phaseChangeTick: 0,
  phaseChangeBets: {},
  displayBets: {},
  displayChips: {},
  potBase: 0,
  // Room state
  roomId: null,
  roomName: null,
  roomConfig: null,
  roomPlayers: [],
  roomStatus: null,
  hostId: null,
  myPlayerId: _myPlayerId,
  isCurrentPlayerHost: false,
}

interface GameStore extends GameState {
  setConnected: (v: boolean) => void
  dispatch: (msg: ServerMessage) => void
  clearPendingAction: () => void
  reset: () => void
  flushNewHand: () => void
  setRoomState: (msg: RoomStateMsg) => void
  setWelcome: (msg: WelcomeMsg) => void
  addRoomPlayer: (player: { player_id: string; name: string }) => void
  removeRoomPlayer: (player_id: string) => void
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

  flushNewHand: () => set((s) => {
    if (!s.pendingNewHand) return {}
    const buffered = s.bufferedTableState
    const base = {
      showdown: null,
      lastResult: null,
      dealRevision: s.dealRevision + 1,
      currentRoundActions: {},
      thinkingPlayer: null,
      thinkingPlayerName: null,
      pendingNewHand: null,
      bufferedTableState: null,
      // Promote buffered ACTION_REQUIRED so the action panel appears right after
      // the "Next Hand" click (instead of auto-flushing mid-modal).
      pendingAction: s.bufferedPendingAction ?? null,
      bufferedPendingAction: null,
    }
    if (buffered) {
      const humanBust = buffered.players.some((p) => p.is_human && p.status === 'bust')
      const displayBets  = Object.fromEntries(buffered.players.map((p) => [p.name, p.current_bet]))
      const displayChips = Object.fromEntries(buffered.players.map((p) => [p.name, p.chips]))
      const sumCurrentBets = buffered.players.reduce((acc, p) => acc + p.current_bet, 0)
      const potBase = buffered.pot - sumCurrentBets
      return {
        ...base,
        started: true,
        phase: buffered.phase as Phase,
        pot: buffered.pot,
        potBase,
        displayBets,
        displayChips,
        communityCards: buffered.community_cards,
        dealerPosition: buffered.dealer_position,
        players: buffered.players,
        humanBust,
        humanEquity: buffered.human_equity ?? null,
      }
    }
    return base
  }),

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

  dispatch: (msg: ServerMessage) => {
    switch (msg.type) {
      case 'TABLE_STATE': {
        const { pendingNewHand, lastResult } = get()
        // Only buffer when BOTH pendingNewHand and lastResult are set —
        // meaning the hand result modal is visible and the host hasn't
        // confirmed yet. If lastResult is null (e.g. hand 1, first deal),
        // apply immediately so players are visible right away.
        if (pendingNewHand !== null && lastResult !== null) {
          set({ bufferedTableState: msg as TableStateMsg })
          break
        }
        const humanBust = msg.players.some((p) => p.is_human && p.status === 'bust')
        // Sync displayBets + displayChips from authoritative server values
        const displayBets  = Object.fromEntries(msg.players.map((p) => [p.name, p.current_bet]))
        const displayChips = Object.fromEntries(msg.players.map((p) => [p.name, p.chips]))
        // potBase = pot excluding the current-street bets already in it.
        // This lets PotDisplay show a live pot: potBase + sum(displayBets).
        const sumCurrentBets = msg.players.reduce((s, p) => s + p.current_bet, 0)
        const potBase = msg.pot - sumCurrentBets
        set({
          started: true,
          phase: msg.phase as Phase,
          pot: msg.pot,
          communityCards: msg.community_cards,
          dealerPosition: msg.dealer_position,
          players: msg.players,
          humanBust,
          humanEquity: msg.human_equity ?? null,
          bufferedTableState: null,
          currentRoundActions: {},
          displayBets,
          displayChips,
          potBase,
          // Clear pendingNewHand when table state is applied directly —
          // this unblocks the ActionPanel for hand #1 (no prior lastResult).
          pendingNewHand: null,
        })
        break
      }

      case 'ACTION_REQUIRED': {
        const { myPlayerId, pendingNewHand } = get()
        const thinkingPlayer = msg.player_id ?? null
        const thinkingPlayerName = msg.player_name ?? null
        // In multiplayer, only activate the action panel for the player whose
        // turn it is. Single-player events have no player_id — always show.
        const isMyTurn = !msg.player_id || msg.player_id === myPlayerId
        if (!isMyTurn) {
          set({ thinkingPlayer, thinkingPlayerName })
          break
        }
        // If the hand result modal is still showing, buffer this action required.
        // The host will apply it when they click "Next Hand".
        if (pendingNewHand !== null) {
          set({ bufferedPendingAction: msg, thinkingPlayer, thinkingPlayerName })
          break
        }
        set({ pendingAction: msg, thinkingPlayer, thinkingPlayerName })
        break
      }

      case 'PHASE_CHANGE':
        // PRE_FLOP fires at hand start (not a street transition) — skip clearing
        // displayBets so the blind-post badges (SB=10, BB=20) stay visible.
        // "Pre-Flop" is the legacy casing the backend emits; guard both forms.
        if (msg.phase === 'PRE_FLOP' || msg.phase === 'Pre-Flop') break
        set((s) => {
          const mergingSum = Object.values(s.displayBets).reduce((a, b) => a + b, 0)
          return {
            // Keep showdown alive while the hand result modal is visible —
            // the next hand's PRE_FLOP PHASE_CHANGE arrives before the host
            // clicks "Next Hand", which would wipe out the winner's cards.
            showdown: s.lastResult !== null ? s.showdown : null,
            currentRoundActions: {},
            phaseChangeTick: s.phaseChangeTick + 1,
            // Snapshot displayBets for the animation, then reset for the new street.
            phaseChangeBets: { ...s.displayBets },
            displayBets: {},
            // Accumulate the merged bets into potBase so live pot stays correct
            // before the next TABLE_STATE arrives.
            potBase: s.potBase + mergingSum,
          }
        })
        break

      case 'ACTION_LOG': {
        const label = parseActionLabel(msg.text)
        const { text, player } = msg
        set((s) => {
          // Parse bet amounts to keep displayBets + displayChips in sync
          // without waiting for TABLE_STATE.
          // "posts ... X"  → absolute blind posted
          // "calls X"      → incremental amount added
          // "raises to X"  → absolute total bet this round
          // "goes all-in"  → all remaining chips committed
          let displayBets  = s.displayBets
          let displayChips = s.displayChips
          const postsMatch  = text.match(/^posts .+ (\d+)$/)
          const callsMatch  = text.match(/^calls (\d+)$/)
          const raisesMatch = text.match(/^raises to (\d+)$/)

          if (postsMatch) {
            const amt = parseInt(postsMatch[1], 10)
            displayBets  = { ...displayBets,  [player]: amt }
            displayChips = { ...displayChips, [player]: Math.max(0, (displayChips[player] ?? 0) - amt) }
          } else if (callsMatch) {
            const amt  = parseInt(callsMatch[1], 10)
            const prev = displayBets[player] ?? 0
            displayBets  = { ...displayBets,  [player]: prev + amt }
            displayChips = { ...displayChips, [player]: Math.max(0, (displayChips[player] ?? 0) - amt) }
          } else if (raisesMatch) {
            const newTotal   = parseInt(raisesMatch[1], 10)
            const prev       = displayBets[player] ?? 0
            const additional = Math.max(0, newTotal - prev)
            displayBets  = { ...displayBets,  [player]: newTotal }
            displayChips = { ...displayChips, [player]: Math.max(0, (displayChips[player] ?? 0) - additional) }
          } else if (text === 'goes all-in') {
            const remaining = displayChips[player] ?? 0
            const prevBet   = displayBets[player] ?? 0
            displayBets  = { ...displayBets,  [player]: remaining + prevBet }
            displayChips = { ...displayChips, [player]: 0 }
          }

          return {
            log: [...s.log, { id: _logId++, player, text }],
            currentRoundActions: label
              ? { ...s.currentRoundActions, [player]: label }
              : s.currentRoundActions,
            thinkingPlayer: null,
            displayBets,
            displayChips,
          }
        })
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
          pendingNewHand: msg,
          thinkingPlayer: null,
          displayBets: {},
          // displayChips intentionally NOT reset here — keep previous hand's
          // values so blind-posting ACTION_LOGs can subtract from the correct
          // starting stack while the next TABLE_STATE is still buffered.
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

      case 'BOT_THINKING':
        set({ thinkingPlayer: '_bot', thinkingPlayerName: msg.player_name })
        break
    }
  },
}))
