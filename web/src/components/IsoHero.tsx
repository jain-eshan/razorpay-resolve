import { arrow, block, isoSvg, person, tile, TOP as T, useIsoPalette, type Item } from './iso'

// The overview guide's hero: the three places a payment can break, as three isometric tiles in a row.
// Left: before Razorpay (a pay page, and a broken link). Middle: inside the payment, greyed because Razorpay already sees it. Right: after the payment (the merchant's system), with a crowd of customers, a few lit (they complained) and most grey (they never said a word).
// Drawn in code, with Blade colours, so it follows dark mode and carries no text. web/DESIGN.md section 16.
export function IsoHero() {
  const { white, grey, muted, blue, soft, orange, edge } = useIsoPalette()

  const tiles = [
    { x: 0, y: 12, fill: white },
    { x: 6, y: 6, fill: grey },
    { x: 12, y: 0, fill: white },
  ]
  const items: Item[] = tiles.map((t, i) => tile(`tile${i}`, t.x, t.y, 5, 5, t.fill, edge))

  // Before Razorpay: a pay page that does not load. A browser-like slab with a blue bar, and an orange block where the link breaks.
  const A = tiles[0]
  items.push(block('page', A.x + 0.8, A.y + 0.6, T, 3.2, 0.4, 3, white, muted))
  items.push(block('bar', A.x + 0.8, A.y + 0.6, T + 2.45, 3.2, 0.4, 0.55, blue, edge))
  items.push(block('broken', A.x + 3.3, A.y + 2.6, T, 1.1, 1.1, 1.1, orange, edge))
  items.push(...person('a1', A.x + 0.7, A.y + 3.5, T, soft, muted), ...person('a2', A.x + 1.7, A.y + 3.9, T, grey, muted))

  // Inside the payment: Razorpay already sees this, so it is grey and quiet.
  const B = tiles[1]
  items.push(block('rzp', B.x + 1, B.y + 1, T, 3, 3, 0.8, grey, muted))
  items.push(block('rzpTop', B.x + 1.8, B.y + 1.8, T + 0.8, 1.4, 1.4, 0.35, soft, muted))

  // After the payment: the merchant's system as three stacked units, and the customers it let down.
  const C = tiles[2]
  ;[0, 1, 2].forEach((k) => items.push(block(`srv${k}`, C.x + 0.8, C.y + 0.7, T + k * 0.95, 2.3, 2.3, 0.85, k === 2 ? blue : soft, edge)))
  items.push(block('srvLight', C.x + 3.4, C.y + 0.9, T, 0.8, 0.8, 0.8, orange, edge))
  // Ten customers. Two lit blue (they complained), eight grey (they never said a word): the ratio in the demo incident.
  for (let k = 0; k < 10; k++) items.push(...person(`c${k}`, C.x + 0.35 + (k % 5) * 0.9, C.y + 3.2 + Math.floor(k / 5) * 0.95, T, k < 2 ? blue : grey, k < 2 ? edge : muted))

  // Small arrows in the gaps between the tiles: a payment moves left to right.
  return isoSvg({ viewBox: '-335 -105 670 365', label: 'Three places a payment can break: before Razorpay, inside the payment, and after it. Razorpay sees the middle one. Blindspot covers the first and the last.', items, over: [arrow('ar1', 5.5, 11.5, blue), arrow('ar2', 11.5, 5.5, blue)] })
}
