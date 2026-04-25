import { useEffect, useRef, useCallback } from 'react'
import { useGameStore } from '../store/gameStore'
import type { ActionType, StartGameConfig, ServerMessage } from '../types'

const WS_URL = '/ws'

export function usePokerSocket() {
  const ws = useRef<WebSocket | null>(null)
  const { dispatch, setConnected, reset } = useGameStore()

  useEffect(() => {
    const socket = new WebSocket(WS_URL)
    ws.current = socket

    socket.onopen = () => {
      setConnected(true)
    }

    socket.onclose = () => {
      setConnected(false)
    }

    socket.onerror = (e) => {
      console.error('[WS] error', e)
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
  }, [dispatch, setConnected])

  const startGame = useCallback((config: StartGameConfig) => {
    reset()
    ws.current?.send(JSON.stringify({ type: 'START_GAME', config }))
  }, [reset])

  const sendAction = useCallback((action: ActionType, amount = 0) => {
    ws.current?.send(JSON.stringify({ type: 'PLAYER_ACTION', action, amount }))
  }, [])

  return { startGame, sendAction }
}
