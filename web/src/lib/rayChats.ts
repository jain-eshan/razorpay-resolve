// Ray's chats on the Overview, kept in this browser only (the prototype has no server side for them). A chat is a list of questions; the answer to each is read
// from the data again when the chat is opened, so a saved chat never shows a figure that has gone out of date.
export type Kind = 'scan' | 'incidents'
export type Chat = { id: string; at: string; turns: { q: string; kind: Kind }[] }
const KEY = 'blindspot.rayChats'

// Ray's chat here is not a model. A question about customers who paid and have no access gets the scan answer, a question about a pipe or a screen goes to that screen,
// anything else gets the incidents answer. Every figure in an answer is read from the data.
const SCAN = /scan|stuck|no access|paid/i
const JUMP: [RegExp, string][] = [
  [/channel|whatsapp|email|instagram/i, '/channels'],
  [/customer|complain|chat|conversation|thread/i, '/threads'],
  [/audit|log|history/i, '/audit'],
]
export const route = (q: string): { to?: string; kind: Kind } => ({ to: JUMP.find(([re]) => re.test(q))?.[1], kind: SCAN.test(q) ? 'scan' : 'incidents' })

export function chats(): Chat[] {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Chat[]
    return Array.isArray(all) ? all.sort((a, b) => b.at.localeCompare(a.at)) : []
  } catch { return [] }
}
export const getChat = (id?: string) => (id ? chats().find((c) => c.id === id) : undefined)

// Adds a question to a chat, or starts a new chat when there is none. Returns the chat's id.
export function addTurn(id: string | undefined, q: string, kind: Kind): string {
  const all = chats()
  const chat = all.find((c) => c.id === id) ?? { id: Date.now().toString(36), at: new Date().toISOString(), turns: [] }
  chat.turns.push({ q, kind })
  chat.at = new Date().toISOString()
  try { localStorage.setItem(KEY, JSON.stringify([chat, ...all.filter((c) => c.id !== chat.id)].slice(0, 30))) } catch { /* private window: the chat is not kept */ }
  return chat.id
}
