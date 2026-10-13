// Every picture in the product. Drawn by an image model from briefs in Razorpay's illustration style (flat isometric, Razorpay blue, one orange
// accent for the problem, no text), supplied by Eshan on 11 Oct 2026, and saved as WebP at display size in public/art. web/DESIGN.md section 16.
// Heroes are 4:3 and lead a guide or the welcome pop-up. Spots are 2:1 and sit in a card's picture panel. A card names its picture by idea (lib/guides.ts),
// so one picture serves every card about that idea. The alt text says the picture in words, because the picture has none.
// `tall` marks a 4:3 hero used in a 2:1 panel: it is shown whole (contain) on the wash rather than cropped.
const A = (file: string, alt: string) => ({ src: `/art/${file}.webp`, alt, tall: /^(0[1-8]|1[78])-/.test(file) })

export const HERO = {
  blindspot: A('01-overview', 'A payment path: a shop page, a Razorpay payment, and an app with a locked door. A beam of light finds the customer stuck at the door.'),
  incidents: A('02-incidents', 'One broken pipe, with a crowd of customers linked to it. Two raise a hand; the rest stay quiet.'),
  conversations: A('03-conversations', 'Messages from a phone, an email and a help button flow into one inbox, where one message matches a receipt.'),
  channels: A('04-channels', 'A hub joined to a phone, an email, a help button and a camera, each with its own on and off switch. One is off.'),
  scan: A('05-first-scan', 'A scanner sweeps a long list of customers. Three rows are marked orange.'),
  autonomy: A('06-control', 'A dial set to its lowest level beside a hand pressing an approve button.'),
  learning: A('07-alert-tuning', 'An alert bell, a slider nudged one notch, and a weekly calendar.'),
  how: A('08-accuracy', 'Two lists with every row matched by a line, under a large tick.'),
  access: A('18-unpaid-access', 'A customer walks through an open door past an unpaid bill.'),
  integration: A('17-prevent-breaks', 'A parcel on a conveyor stopped at a checkpoint gate: two checks pass, one fails.'),
}

export const ART = {
  crowd: A('09-one-to-many', 'One customer speaks up, and the many quiet ones behind them light up.'),
  proof: A('10-whose-side', 'A path forks towards the business and towards Razorpay. A magnifying glass picks one lane.'),
  approve: A('11-approve', 'A hand presses a large approve button and a green tick appears.'),
  stairs: A('12-in-stages', 'Three steps with a few customers on the first and more on each step up.'),
  search: A('13-find-the-payment', 'A chat message and a receipt click together like puzzle pieces.'),
  lock: A('14-no-credentials', 'A shield in front of a crossed-out code field.'),
  handover: A('15-handover', 'The assistant hands a stack of messages to a person.'),
  switch: A('16-off-switch', 'A large switch turned off beside quiet channel icons.'),
  chat: A('03-conversations', 'Messages from a phone, an email and a help button flow into one inbox.'),
  channels: A('04-channels', 'A hub joined to each place customers write, each with its own switch.'),
  alert: A('02-incidents', 'One broken pipe, with every customer it reached.'),
  zones: A('01-overview', 'A payment path with three stops: before, during and after the payment.'),
  stuck: A('01-overview', 'A customer who paid, stuck at a locked door.'),
  inferred: A('10-whose-side', 'A magnifying glass over a fork in the path.'),
  gate: A('06-control', 'A dial with limits, beside an approve button.'),
  sliders: A('07-alert-tuning', 'A slider nudged one notch.'),
  calendar: A('07-alert-tuning', 'A weekly calendar beside an alert bell.'),
  log: A('08-accuracy', 'Two lists with every row accounted for.'),
  report: A('08-accuracy', 'Two lists matched row by row under a tick.'),
  release: A('17-prevent-breaks', 'A release stopped at a checkpoint when one check fails.'),
  door: A('18-unpaid-access', 'An open door and an unpaid bill.'),
  // The engine's last step on "How Resolve works" reuses an existing picture under the idea it shows there.
  winback: A('12-in-stages', 'Steps with a few customers on the first and more on each step up: customers coming back.'),
}

export type ArtId = keyof typeof ART
export type HeroId = keyof typeof HERO
