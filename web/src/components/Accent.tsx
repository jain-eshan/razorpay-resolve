import type { ReactNode } from 'react'

// The one playful touch Blindspot borrows from Razorpay Engage's launch: a key word in a hero heading set in an italic serif. Use it on one phrase in a heading,
// on hero and launch moments only, never in tables, labels or body text (web/DESIGN.md section 21). Falls back to Georgia italic if the font does not load.
export function Accent({ children }: { children: ReactNode }) {
  return <span style={{ fontFamily: "'Instrument Serif', Georgia, 'Times New Roman', serif", fontStyle: 'italic', fontWeight: 400, fontSize: '1.12em', letterSpacing: 0 }}>{children}</span>
}
