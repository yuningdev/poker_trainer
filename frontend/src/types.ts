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

export type ClientMessage = StartGameMsg | PlayerActionMsg

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
}
