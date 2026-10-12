import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

// The width of an element, measured before the first paint and kept up to date, so a layout that depends on room (two cards side by side, or a list instead of a
// time axis) is chosen before anything is drawn and never changes after.
export function useWidth<T extends HTMLElement>(): [RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(Math.round(el.getBoundingClientRect().width))
    const watch = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return [ref, w]
}
