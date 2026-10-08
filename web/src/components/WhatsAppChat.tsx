import { Fragment, type CSSProperties, type ReactNode } from 'react'
import { WA, waTime } from '../lib/whatsapp'

// A WhatsApp chat as it looks on a phone: green header with the business name and verified tick, the beige wallpaper, a date chip, the yellow
// "business account" notice, white bubbles with a tail, a time and double ticks on what the customer sent, quick-reply buttons under a message,
// and the input bar. Used wherever Blindspot shows a message, so the founder sees what the customer sees (web/DESIGN.md section 21).
export type WaMessage = { from: 'business' | 'customer'; text: ReactNode; time?: string; buttons?: string[]; read?: boolean; day?: string }

const svg = (d: string, size = 22, color: string = WA.headerText) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
)
const ICON = {
  back: 'M15 18l-6-6 6-6',
  video: 'M15 10l5-3v10l-5-3M3 7h12v10H3z',
  call: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z',
  more: 'M12 5v.01M12 12v.01M12 19v.01',
  smile: 'M12 21a9 9 0 100-18 9 9 0 000 18zM8.5 14a4.5 4.5 0 007 0M9 9.5v.01M15 9.5v.01',
  clip: 'M20 12l-7.5 7.5a5 5 0 01-7-7L14 4a3.3 3.3 0 014.7 4.7L10 17.5a1.7 1.7 0 01-2.4-2.4L15 7.7',
  camera: 'M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.5 3.5 0 100-7 3.5 3.5 0 000 7z',
  mic: 'M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zM6 11a6 6 0 0012 0M12 17v4',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  lock: 'M7 11V8a5 5 0 0110 0v3M5 11h14v10H5z',
} as const

// Two ticks, blue once the message is read.
// WhatsApp's wallpaper: the real doodle pattern (public/whatsapp-wallpaper.jpg, supplied by Eshan), multiplied over the beige so it takes WhatsApp's warm tint.
const wallpaper = 'url(/whatsapp-wallpaper.jpg)'

// The Razorpay mark (the slanted R) in its own colours, for chats that come from Razorpay. Paths are from public/razorpay-logo.svg.
function RazorpayMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 25" aria-hidden="true"><path fill={WA.rzpBlue} d="M9.05494 7.84177L7.89197 12.1223L14.5486 7.8174L10.195 24.0606L14.6165 24.0643L21.048 0.0723572" /><path fill={WA.rzpNavy} d="M1.89031 17.2356L0.059082 24.0643H9.12142L12.8297 10.1729L1.89031 17.2356Z" /></svg>
  )
}

function Ticks({ read }: { read?: boolean }) {
  const c = read ? WA.tick : WA.time
  return (
    <svg width="16" height="11" viewBox="0 0 16 11" fill="none" stroke={c} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 6l3 3 6-7.5M6.5 8.5l1 1L14 1.5" /></svg>
  )
}

function Verified() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill={WA.verified} d="M12 1l2.6 2 3.3-.2 1.2 3.1 2.9 1.6-.8 3.2L22 12l-1.8 2.3.8 3.2-2.9 1.6-1.2 3.1-3.3-.2L12 23l-2.6-2-3.3.2-1.2-3.1L2 15.5l.8-3.2L1 12l1.8-2.3L2 6.5l2.9-1.6 1.2-3.1 3.3.2z" /><path d="M7.5 12.3l3 3 6-6.3" fill="none" stroke={WA.headerText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" /></svg>
  )
}

function DayChip({ children }: { children: string }) {
  return <div style={{ alignSelf: 'center', background: WA.chip, color: WA.chipText, fontSize: 12, padding: '4px 10px', borderRadius: 7, boxShadow: WA.shadow, margin: '4px 0' }}>{children.toUpperCase()}</div>
}

function Bubble({ m, onButton }: { m: WaMessage; onButton?: (label: string) => void }) {
  const mine = m.from === 'customer'
  const tail: CSSProperties = mine ? { borderTopRightRadius: 0 } : { borderTopLeftRadius: 0 }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start', gap: 2 }}>
      <div style={{ position: 'relative', maxWidth: '84%', background: mine ? WA.bubbleOut : WA.bubbleIn, color: WA.text, borderRadius: 8, padding: '6px 8px 7px 9px', boxShadow: WA.shadow, fontSize: 14.2, lineHeight: '19px', ...tail }}>
        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</span>
        <span style={{ float: 'right', display: 'inline-flex', alignItems: 'center', gap: 3, margin: '6px 0 -4px 10px', fontSize: 11, lineHeight: '11px', color: WA.time }}>
          {m.time ?? waTime()}{mine && <Ticks read={m.read} />}
        </span>
        <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden="true" style={{ position: 'absolute', top: 0, [mine ? 'right' : 'left']: -8, transform: mine ? 'scaleX(-1)' : undefined }}><path d="M8 0v13C6 9 3 5 0 0z" fill={mine ? WA.bubbleOut : WA.bubbleIn} /></svg>
      </div>
      {m.buttons?.map((b) => (
        <button key={b} type="button" disabled={!onButton} onClick={() => onButton?.(b)} style={{ width: '84%', maxWidth: '84%', border: 0, font: 'inherit', cursor: onButton ? 'pointer' : 'default', background: WA.bubbleIn, color: WA.link, borderRadius: 8, boxShadow: WA.shadow, padding: '9px 8px', fontSize: 14.2, fontWeight: 500, textAlign: 'center', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6 }}>
          {svg(ICON.link, 16, WA.link)}{b}
        </button>
      ))}
    </div>
  )
}

// `compact` shows only what matters in a preview: a slim header and the messages, on the wallpaper. No call icons, no input bar, no notice.
// `avatar="razorpay"` puts the Razorpay mark in the profile picture, for chats that come from Razorpay itself.
export function WhatsAppChat({ name, subtitle = 'Business account', messages, notice = true, day = 'Today', minHeight = 0, testID, onButton, compact = false, avatar = 'initial' }: {
  name: string; subtitle?: string; messages: WaMessage[]; notice?: boolean; day?: string; minHeight?: number; testID?: string; onButton?: (label: string) => void; compact?: boolean; avatar?: 'initial' | 'razorpay'
}) {
  return (
    <div data-testid={testID} role="group" aria-label={`WhatsApp chat with ${name}. ${messages.length} message${messages.length === 1 ? '' : 's'}.`}
      style={{ width: '100%', maxWidth: compact ? 340 : 400, borderRadius: compact ? 12 : 16, overflow: 'hidden', border: `1px solid ${WA.chip}`, boxShadow: '0 2px 12px rgba(11, 20, 26, 0.12)', fontFamily: WA.font, background: WA.wallpaper, backgroundImage: wallpaper, backgroundBlendMode: 'multiply', backgroundSize: '640px auto' }}>
      <div style={{ background: WA.header, color: WA.headerText, display: 'flex', alignItems: 'center', gap: 8, padding: compact ? '8px 10px' : '10px 10px 10px 6px' }}>
        {!compact && svg(ICON.back)}
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: WA.bubbleIn, color: WA.header, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{avatar === 'razorpay' ? <RazorpayMark /> : name.slice(0, 1).toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0, lineHeight: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 16, fontWeight: 500 }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span><Verified /></div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>{subtitle}</div>
        </div>
        {!compact && <>{svg(ICON.video)}{svg(ICON.call)}{svg(ICON.more)}</>}
      </div>
      <div style={{ padding: '10px 10px 12px', display: 'flex', flexDirection: 'column', gap: 6, minHeight }}>
        {!messages[0]?.day && <DayChip>{day}</DayChip>}
        {notice && !compact && (
          <div style={{ alignSelf: 'center', background: WA.notice, color: WA.noticeText, fontSize: 12, lineHeight: '16px', padding: '6px 10px', borderRadius: 7, textAlign: 'center', display: 'flex', gap: 6, alignItems: 'flex-start', margin: '2px 6px 4px' }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}>{svg(ICON.lock, 12, WA.noticeText)}</span>
            <span>This business uses a secure service from Meta to manage this chat. Tap to learn more.</span>
          </div>
        )}
        {messages.map((m, i) => <Fragment key={i}>{m.day && <DayChip>{m.day}</DayChip>}<Bubble m={m} onButton={onButton} /></Fragment>)}
      </div>
      {!compact && <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 10px' }} aria-hidden="true">
        <div style={{ flex: 1, background: WA.chip, borderRadius: 24, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', color: WA.time, fontSize: 15 }}>
          {svg(ICON.smile, 22, WA.time)}<span style={{ flex: 1 }}>Message</span>{svg(ICON.clip, 21, WA.time)}{svg(ICON.camera, 21, WA.time)}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: '50%', background: WA.send, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{svg(ICON.mic, 21)}</div>
      </div>}
    </div>
  )
}
