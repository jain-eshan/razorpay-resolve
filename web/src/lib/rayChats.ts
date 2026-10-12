// Ray's chats on the Overview, kept in this browser only (the prototype has no server side for them). A chat is a list of questions; the answer to each is read
// from the data again when the chat is opened, so a saved chat never shows a figure that has gone out of date.
// They are also held in memory, so a browser that refuses storage (a private window) still keeps the chat for as long as the tab is open.
export type Kind = 'scan' | 'incidents' | 'unknown'
export type Chat = { id: string; at: string; turns: { q: string; kind: Kind }[] }
const KEY = 'blindspot.rayChats'
const MAX = 30

// Ray's chat here is not a model. A question about customers who paid and have no access gets the scan answer, a question about a pipe or a screen goes to that screen,
// a question about what is broken gets the payment issues answer. Anything else is said not to be understood, with the questions Ray can answer: it never makes
// up an answer. Every figure in an answer is read from the data.
const SCAN = /scan|stuck|no access|paid/i
const ISSUES = /issue|problem|broken|wrong|incident|fail|affect|\bhit\b|money|amount|involved|happen|right now|status|webhook|refund|charged|twice|renewal|summary|overview|how many|worst|biggest|urgent/i
const JUMP: [RegExp, string][] = [
  [/channel|whatsapp|email|instagram/i, '/channels'],
  [/customer|complain|chat|conversation|thread/i, '/threads'],
  [/audit|log|history/i, '/audit'],
]
export const route = (q: string): { to?: string; kind: Kind } => ({ to: JUMP.find(([re]) => re.test(q))?.[1], kind: SCAN.test(q) ? 'scan' : ISSUES.test(q) ? 'incidents' : 'unknown' })

let memory: Chat[] | undefined
function load(): Chat[] {
  if (memory) return memory
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '[]') as Chat[]
    memory = Array.isArray(all) ? all : []
  } catch { memory = [] }
  return memory
}
function save(all: Chat[]) {
  memory = all.sort((a, b) => b.at.localeCompare(a.at)).slice(0, MAX)
  try { localStorage.setItem(KEY, JSON.stringify(memory)) } catch { /* private window: the chat lives in memory until the tab closes */ }
}

export const chats = (): Chat[] => [...load()].sort((a, b) => b.at.localeCompare(a.at))
export const getChat = (id?: string) => (id ? load().find((c) => c.id === id) : undefined)
export const clearChats = () => save([])

// Adds a question to a chat, or starts a new chat when there is none. Returns the chat's id.
export function addTurn(id: string | undefined, q: string, kind: Kind): string {
  const all = load()
  const chat = all.find((c) => c.id === id) ?? { id: Date.now().toString(36), at: new Date().toISOString(), turns: [] }
  chat.turns.push({ q, kind })
  chat.at = new Date().toISOString()
  save([chat, ...all.filter((c) => c.id !== chat.id)])
  return chat.id
}
