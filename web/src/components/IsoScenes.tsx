import { arrow, block, isoSvg, onTop, person, tile, TOP as T, useIsoPalette, type Item } from './iso'

// One isometric scene per product guide, drawn with the kit in iso.tsx and shown on the left of the guide's hero (GuideHero.tsx).
// Colour means the same thing everywhere: blue is a person or a thing that acts, orange is the problem, grey is quiet or unseen, green is a check that passed. No text, so the picture reads before anyone reads.
// Every scene says one thing about its guide. The aria-label says it in words.

// Incidents: one cause (orange), the incident card it becomes (blue on top), and every customer it touched, a few who complained (blue) and the rest who did not (grey).
export function IncidentsScene() {
  const { white, grey, muted, blue, soft, orange, edge } = useIsoPalette()
  const items: Item[] = [tile('base', -7, -7, 14, 14, white, edge), block('cause', -5.5, -5.5, T, 2, 2, 1.6, orange, edge)]
  ;[0, 1, 2].forEach((k) => items.push(block(`card${k}`, 0.5, -5.5, T + k * 0.75, 3.4, 3.4, 0.65, k === 2 ? blue : soft, edge)))
  for (let k = 0; k < 18; k++) {
    const lit = [3, 10, 16].includes(k)
    items.push(...person(`c${k}`, -5.5 + (k % 6) * 1.8, 0.8 + Math.floor(k / 6) * 1.8, T, lit ? blue : grey, lit ? edge : muted))
  }
  return isoSvg({ label: 'An incident: one cause, and every customer it touched. A few customers wrote in. Most did not.', items })
}

// Conversations: a customer with a phone, the assistant in the middle (the green block: AI), and the founder, who steps in when a person is needed.
export function ConversationsScene() {
  const { white, grey, muted, blue, soft, orange, green, edge } = useIsoPalette()
  const tiles = [{ x: 0, y: 12 }, { x: 6, y: 6 }, { x: 12, y: 0 }]
  const items: Item[] = tiles.map((t, i) => tile(`t${i}`, t.x, t.y, 5, 5, i === 1 ? grey : white, edge))
  const [A, B, C] = tiles
  items.push(...person('cust', A.x + 1, A.y + 2.6, T, orange, edge, 1.2), block('phone', A.x + 2.6, A.y + 1.6, T, 0.9, 0.35, 1.9, white, muted), block('bubble', A.x + 0.7, A.y + 0.7, T + 2.6, 2, 0.3, 1, white, muted))
  items.push(block('ray', B.x + 1.2, B.y + 1.2, T, 2.4, 2.4, 1.5, green, edge), block('rayTop', B.x + 2, B.y + 2, T + 1.5, 0.8, 0.8, 0.6, white, edge))
  ;[0, 1, 2].forEach((k) => items.push(block(`rec${k}`, B.x + 0.3, B.y + 3.9, T + k * 0.3, 1.8, 0.8, 0.25, k === 0 ? white : soft, muted)))
  items.push(...person('you', C.x + 1.2, C.y + 2.2, T, blue, edge, 1.3), block('desk', C.x + 0.5, C.y + 3.4, T, 3.6, 1.1, 0.7, grey, muted), block('thread', C.x + 2.7, C.y + 1, T, 1.8, 0.4, 1.4, white, muted))
  return isoSvg({ viewBox: '-345 -110 690 400', label: 'A conversation: a customer writes, the assistant looks up the payment and answers, and you step in when a person is needed.', items, over: [arrow('a1', 5.5, 11.5, blue), arrow('a2', 11.5, 5.5, blue)] })
}

// Channels: Blindspot in the middle, four channels connected to it by a line, and one grey channel that is not connected and so is not listening.
export function ChannelsScene() {
  const { white, grey, muted, blue, soft, edge } = useIsoPalette()
  const items: Item[] = [tile('base', -7, -7, 14, 14, white, edge), block('hub', -1.5, -1.5, T, 3, 3, 1.6, blue, edge), block('hubTop', -0.8, -0.8, T + 1.6, 1.6, 1.6, 0.35, soft, edge)]
  const on = [[-6.2, -1], [4.2, -1], [-1, -6.2], [-1, 4.2]]
  on.forEach(([x, y], k) => items.push(block(`ch${k}`, x, y, T, 2, 2, 1.2, white, muted), block(`chTop${k}`, x + 0.5, y + 0.5, T + 1.2, 1, 1, 0.3, soft, muted)))
  items.push(block('off', 4.2, 4.2, T, 2, 2, 1.2, grey, muted))
  items.push(block('p0', -4.2, -0.25, T, 2.7, 0.5, 0.08, blue, edge), block('p1', 1.5, -0.25, T, 2.7, 0.5, 0.08, blue, edge), block('p2', -0.25, -4.2, T, 0.5, 2.7, 0.08, blue, edge), block('p3', -0.25, 1.5, T, 0.5, 2.7, 0.08, blue, edge))
  return isoSvg({ label: 'Channels: Blindspot in the middle, connected to the places customers write from. One channel is not connected, so it is not listening.', items })
}

// Day-0 scan: a field of customers who paid, most fine (grey), a few with no access (orange), and a line sweeping across. It only looks.
export function ScanScene() {
  const { white, grey, muted, blue, orange, edge } = useIsoPalette()
  const items: Item[] = [tile('base', -7, -7, 14, 14, white, edge)]
  for (let k = 0; k < 24; k++) {
    const stuck = [4, 9, 14, 20].includes(k)
    items.push(...person(`c${k}`, -5.5 + (k % 6) * 1.8, -4.5 + Math.floor(k / 6) * 1.9, T, stuck ? orange : grey, stuck ? edge : muted))
  }
  items.push(block('sweep', -6.4, -1.9, T, 12.8, 0.55, 0.06, blue, edge, 0.7), block('sweepEnd', -6.4, -2.15, T, 0.35, 1.05, 0.5, blue, edge))
  return isoSvg({ label: 'The Day-0 scan: customers who paid, most with access and a few without. A line sweeps across and only looks.', items })
}

// Autonomy: three steps up. On the first you approve everything. On the second the assistant (green) works inside a plan you approved. On the third it works alone, behind an orange gate that never opens.
export function AutonomyScene() {
  const { white, muted, blue, orange, green, edge } = useIsoPalette()
  const items: Item[] = [tile('base', -7, -4.5, 14, 9, white, edge)]
  ;[0, 1, 2].forEach((k) => items.push(block(`step${k}`, 2.2 - k * 4.4, -3.5, T, 4.4, 7, 0.9 + k * 0.9, white, muted)))
  items.push(...onTop(person('you', 3.6, -0.6, T + 0.9, blue, edge, 1.3)))
  items.push(...onTop(block('ray1', -0.6, -1.4, T + 1.8, 1.8, 1.8, 1.2, green, edge)))
  items.push(...onTop([block('ray2', -4.8, -2.6, T + 2.7, 1.8, 1.8, 1.2, green, edge), block('g1', -6.5, -3.4, T + 2.7, 0.4, 0.4, 1.8, orange, edge), block('g2', -6.5, 2.6, T + 2.7, 0.4, 0.4, 1.8, orange, edge), block('g3', -6.5, -3.4, T + 4.1, 0.4, 6.4, 0.4, orange, edge)]))
  return isoSvg({ viewBox: '-345 -250 690 400', label: 'Autonomy in three steps. First you approve everything. Then the assistant works inside a plan you approved. Then it works alone, behind a gate it can never open.', items })
}

// Learning: three settings as sliders. Each marker moves one notch at a time (the faint copy is where it could go next), never two.
export function LearningScene() {
  const { white, grey, muted, blue, edge } = useIsoPalette()
  const items: Item[] = [tile('base', -7, -6, 14, 12, white, edge)]
  ;[[-4.2, 2], [-0.6, 4], [3, 1]].forEach(([y, at], r) => {
    items.push(block(`track${r}`, -6, y, T, 12, 0.9, 0.2, grey, muted))
    for (let k = 0; k < 6; k++) items.push(block(`n${r}${k}`, -5.6 + k * 2.2, y - 0.1, T + 0.2, 0.5, 1.1, 0.15, muted, edge))
    items.push(block(`m${r}`, -5.85 + at * 2.2, y - 0.1, T + 0.2, 1, 1.1, 1, blue, edge), block(`g${r}`, -5.85 + (at + 1) * 2.2, y - 0.1, T + 0.2, 1, 1.1, 1, blue, edge, 0.28))
  })
  return isoSvg({ label: 'Learning: each setting is a slider that moves one notch at a time, once a week, and never jumps.', items })
}

// How we know: the answers sit in a locked black box the product never opens. Beside it, the product and a row of checks that passed (green).
export function HowScene() {
  const { white, grey, muted, blue, orange, green, ink, edge } = useIsoPalette()
  const items: Item[] = [tile('a', 0, 8, 6, 6, grey, edge), tile('b', 8, 0, 6, 6, white, edge)]
  items.push(block('vault', 1, 9, T, 4, 4, 3, ink, edge), block('lock', 2.4, 13, T + 1.2, 1.2, 0.3, 1, orange, edge))
  items.push(block('prod', 8.6, 0.8, T, 2.8, 2.8, 0.8, white, muted), block('prodTop', 9.2, 1.4, T + 0.8, 1.6, 1.6, 0.35, blue, edge))
  for (let k = 0; k < 5; k++) items.push(block(`ok${k}`, 12.2, 0.6 + k * 1, T, 0.8, 0.8, 0.5, green, edge))
  return isoSvg({ viewBox: '-345 -50 690 400', label: 'How we know: the true answers are locked in a box the product never opens. Beside it, the product is checked against them, and the checks pass.', items })
}
