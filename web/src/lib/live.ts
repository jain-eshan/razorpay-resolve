import { useEffect, useState } from 'react'
import { get, type Schemas } from './api'

type Thread = Schemas['ThreadDetail']

// Polls one thread so two screens (the customer's phone and the founder's view) stay in step.
export function useLiveThread(tid: string | undefined, version = 0) {
  const [t, setT] = useState<Thread>()
  useEffect(() => {
    if (!tid) return
    let on = true
    const load = () => get<Thread>(`/api/threads/${tid}`).then((d) => on && setT(d), () => undefined)
    load()
    const h = setInterval(load, 1500)
    return () => {
      on = false
      clearInterval(h)
    }
  }, [tid, version])
  return t
}
