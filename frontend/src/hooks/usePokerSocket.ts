import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import type { ActionType, ServerMessage } from '../types'

export function usePokerSocket(roomId: string | null) {
  const ws = useRef<WebSocket | null>(null)
  const { dispatch, setConnected, myPlayerId } = useGameStore()

  useEffect(() => {
    if (!roomId) return

    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const socket = new WebSocket(`${proto}//${location.host}/ws/${roomId}`)
    ws.current = socket

    socket.onopen = () => {
      setConnected(true)
      // First message must be JOIN_ROOM
      const name = localStorage.getItem('poker_player_name') || 'Player'
      socket.send(JSON.stringify({ type: 'JOIN_ROOM', player_id: myPlayerId, name }))
    }

    socket.onclose = () => {
      setConnected(false)
    }

    socket.onerror = (e) => {
      console.error('[WS] error', e)
      setConnected(false)
    }

    socket.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data)
        dispatch(msg)
      } catch (e) {
        console.error('[WS] failed to parse message', e)
      }
    }

    return () => {
      socket.close()
    }
  }, [roomId]) // intentionally only re-run when roomId changes

  const startGame = useCallback(() => {
    ws.current?.send(JSON.stringify({ type: 'START_GAME' }))
  }, [])

  const sendAction = useCallback((action: ActionType, amount = 0) => {
    ws.current?.send(JSON.stringify({ type: 'PLAYER_ACTION', action, amount }))
    useGameStore.getState().setTimeRemaining(null)
  }, [])

  return { startGame, sendAction }
}
