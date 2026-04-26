import { createContext, useContext, useRef, useCallback, useMemo, useEffect } from 'react'
import type { ReactNode } from 'react'

interface DealContextValue {
  registerSeat: (name: string, el: HTMLDivElement | null) => void
  getDealerEl: () => HTMLDivElement | null
}

const DealContext = createContext<DealContextValue | null>(null)

export function useDealContext() {
  return useContext(DealContext)
}

interface Props {
  dealerName: string
  children: ReactNode
}

export function DealProvider({ dealerName, children }: Props) {
  const seatRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())
  const dealerNameRef = useRef(dealerName)

  useEffect(() => {
    dealerNameRef.current = dealerName
  }, [dealerName])

  const registerSeat = useCallback((name: string, el: HTMLDivElement | null) => {
    seatRefs.current.set(name, el)
  }, [])

  const getDealerEl = useCallback(() => {
    return seatRefs.current.get(dealerNameRef.current) ?? null
  }, [])

  const value = useMemo(() => ({ registerSeat, getDealerEl }), [registerSeat, getDealerEl])

  return <DealContext.Provider value={value}>{children}</DealContext.Provider>
}
