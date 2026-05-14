import { useEffect, useState } from 'react'

export function useIsLandscapePhone(): boolean {
  const [isLS, setIsLS] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-height: 500px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(max-height: 500px)')
    const handler = (e: MediaQueryListEvent) => setIsLS(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isLS
}
