// WhatsApp's own look, copied so a preview reads as WhatsApp and not as "a chat". These are Meta's colours, not Razorpay's, so they are the one place a hex lives
// outside Blade tokens. Values are WhatsApp for Android (light mode, 2024): header, wallpaper, bubbles, ticks, the green send button.
export const WA = {
  header: '#008069',
  headerText: '#FFFFFF',
  wallpaper: '#EFEAE2',
  bubbleIn: '#FFFFFF',
  bubbleOut: '#D9FDD3',
  text: '#111B21',
  time: '#667781',
  tick: '#53BDEB',
  link: '#00A5F4',
  chip: '#FFFFFF',
  chipText: '#54656F',
  notice: '#FFEECD',
  noticeText: '#54656F',
  send: '#00A884',
  verified: '#1DA1F2',
  shadow: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
  font: "'Segoe UI', Helvetica Neue, Helvetica, Arial, sans-serif",
} as const

// "10:42 am", the way WhatsApp prints a message time.
export const waTime = (d: Date | string = new Date()) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()
