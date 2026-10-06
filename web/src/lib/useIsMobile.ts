import { useEffect, useState } from 'react'

// True below Blade's `m` breakpoint (768px), for the few props Blade does not make responsive.
export function useIsMobile() {
  const q = '(max-width: 767px)'
  const [mobile, setMobile] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setMobile(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return mobile
}
