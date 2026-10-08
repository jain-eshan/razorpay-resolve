import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../razorsense'

// A figure that counts up to its value when it first shows. Instant for people who ask for less motion.
export function useCountUp(target: number, ms = 900) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion) return
    const start = performance.now()
    let raf = requestAnimationFrame(function tick(t) {
      const p = Math.min(1, (t - start) / ms)
      setN(Math.round(target * (1 - (1 - p) ** 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    })
    const done = setTimeout(() => setN(target), ms + 100)  // animation frames pause in a hidden tab; the figure must still end on the right number
    return () => { cancelAnimationFrame(raf); clearTimeout(done) }
  }, [target, ms])
  return prefersReducedMotion ? target : n
}
