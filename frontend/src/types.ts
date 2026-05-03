// ── Shared types mirroring the WebSocket protocol ────────────────────────────

export interface CardData {
  rank: string  // "A", "K", "Q", "J", "10", "2"–"9"
  suit: string  // "♠" | "♥" | "♦" | "♣"
}

export type PlayerStatus = 'active' | 'folded' | 'all_in' | 'bust'

export type Phase = 'PRE_FLOP' | 'FLOP' | 'TURN' | 'RIVER' | 'SHOWDOWN'

export type ActionType = 'fold' | 'check' | 'call' | 'raise' | 'all_in'

export interface PlayerData {
  name: string
  chips: number
  current_bet: number
  status: PlayerStatus
  is_human: boolean
  hole_cards: CardData[]  // populated only for human player (or at showdown)
}

// ── Server → Browser messages ─────────────────────────────────────────────────

export interface TableStateMsg {
  type: 'TABLE_STATE'
  phase: Phase
  pot: number
  community_cards: CardData[]
  dealer_position: number
  players: PlayerData[]
  human_equity: number | null
}

export interface ActionRequiredMsg {
  type: 'ACTION_REQUIRED'
  legal_actions: ActionType[]
  call_amount: number
  min_raise: number
  max_raise: number
  pot: number
  current_bet: number
  player_chips: number
  player_name?: string  // whose turn it is
  player_id?: string    // filters action panel in multiplayer
}

export interface PhaseChangeMsg {
  type: 'PHASE_CHANGE'
  phase: string
}

export interface ActionLogMsg {
  type: 'ACTION_LOG'
  player: string
  text: string
}

export interface ShowdownPlayer {
  name: string
  hole_cards: CardData[]
  hand_description: string
}

export interface ShowdownMsg {
  type: 'SHOWDOWN'
  players: ShowdownPlayer[]
}

export interface HandResultMsg {
  type: 'HAND_RESULT'
  winner: string
  hand: string
  amount: number
}

export interface PlayerBustMsg {
  type: 'PLAYER_BUST'
  player: string
}

export interface GameOverMsg {
  type: 'GAME_OVER'
  winner: string
  chips: number
}

export interface NewHandMsg {
  type: 'NEW_HAND'
  hand_num: number
}

export interface MessageMsg {
  type: 'MESSAGE'
  text: string
}

export interface ErrorMsg {
  type: 'ERROR'
  message: string
}

export type ServerMessage =
  | TableStateMsg
  | ActionRequiredMsg
  | PhaseChangeMsg
  | ActionLogMsg
  | ShowdownMsg
  | HandResultMsg
  | PlayerBustMsg
  | GameOverMsg
  | NewHandMsg
  | MessageMsg
  | ErrorMsg
  | RoomStateMsg
  | PlayerJoinedMsg
  | PlayerLeftMsg
  | TimeWarningMsg
  | WelcomeMsg

// ── Browser → Server messages ─────────────────────────────────────────────────

export interface BotConfig {
  name: string
  strategy: 'aggressive' | 'passive' | 'random'
}

export interface StartGameConfig {
  human_name: string
  starting_chips: number
  small_blind: number
  big_blind: number
  bots: BotConfig[]
}

export interface StartGameMsg {
  type: 'START_GAME'
  config: StartGameConfig
}

export interface PlayerActionMsg {
  type: 'PLAYER_ACTION'
  action: ActionType
  amount: number
}

export type ClientMessage = StartGameMsg | PlayerActionMsg | JoinRoomMsg

// ── Room-related client → server messages ─────────────────────────────────────

export type JoinRoomMsg = { type: 'JOIN_ROOM'; player_id: string; name: string }

// ── Room-related server → client messages ─────────────────────────────────────

export type RoomStateMsg = {
  type: 'ROOM_STATE'
  room_id: string
  room_name: string
  host_id: string
  players: { player_id: string; name: string }[]
  status: 'waiting' | 'playing' | 'finished'
  config: {
    total_seats: number
    big_blind: number
    starting_chips: number
    time_bank: number
    bot_strategy: string
  }
}

export type PlayerJoinedMsg = { type: 'PLAYER_JOINED'; player_id: string; name: string }
export type PlayerLeftMsg = { type: 'PLAYER_LEFT'; player_id: string }
export type TimeWarningMsg = { type: 'TIME_WARNING'; player_id: string; seconds_remaining: number }
export type WelcomeMsg = { type: 'WELCOME'; player_id: string; is_host: boolean }

// ── Game state (Zustand store shape) ─────────────────────────────────────────

export interface LogEntry {
  id: number
  player: string
  text: string
}

export interface GameState {
  connected: boolean
  started: boolean
  phase: Phase
  handNum: number
  pot: number
  communityCards: CardData[]
  dealerPosition: number
  players: PlayerData[]
  pendingAction: ActionRequiredMsg | null
  log: LogEntry[]
  showdown: ShowdownPlayer[] | null
  lastResult: HandResultMsg | null
  gameOver: GameOverMsg | null
  dealRevision: number  // increments each NEW_HAND; used to key hole cards for re-animation
  humanBust: boolean    // true when the human player has been eliminated
  humanEquity: number | null
  currentRoundActions: Record<string, string>
  pendingNewHand: NewHandMsg | null
  thinkingPlayer: string | null
  // Room-related state
  roomId: string | null
  roomName: string | null
  roomConfig: RoomStateMsg['config'] | null
  roomPlayers: { player_id: string; name: string }[]
  roomStatus: 'waiting' | 'playing' | 'finished' | null
  hostId: string | null
  myPlayerId: string
  timeRemaining: number | null
  isCurrentPlayerHost: boolean
}
