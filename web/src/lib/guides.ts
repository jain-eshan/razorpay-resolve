import type { ArtId } from '../components/FlatArt'
import { ActivityIcon, FileTextIcon, RadioIcon, SearchIcon, SlidersIcon, TrendingUpIcon, UsersIcon, type IconComponent } from '@razorpay/blade/components'

// Product guides, in the shape of Razorpay's own (Smart Collect, Checkout Rewards, the agent pages): a hero slide, then "What makes X great?" with three cards. Copy rules and the pattern: web/DESIGN.md section 16.
// To add a guide, add an entry here. The page at /guides/:id, the "How it works" button on a page and the Explore cards on the home read this list.
// Every sentence must be true of the product today, in plain words, for someone who has never heard of Blindspot. Every figure on a guide is read from the data (lib/guideStats.ts), never typed here.
export type Guide = {
  id: string
  title: string
  to: string
  icon: IconComponent
  tagline: string
  description: string
  benefits: { art: ArtId; title: string; text: string }[]
  links: { label: string; to: string }[]
  // Slide 3, "How to use X": three plain steps, in the order a merchant does them.
  steps: { art: ArtId; title: string; text: string }[]
  // Shown under the figures. The figures come from the synthetic merchant, and a guide says so.
  note: string
}

const DEMO = 'Figures are from the demo merchant, Kaksha. All data is simulated.'

export const GUIDES: Guide[] = [
  {
    id: 'blindspot',
    title: 'Blindspot',
    to: '/setup',
    icon: ActivityIcon,
    tagline: 'Find every customer a payment problem touched',
    description:
      "A customer pays and your app gives them nothing. You find out days later, if at all. Razorpay sees a payment while it happens. Blindspot watches what comes before it and what your app does after it, finds everyone the problem hit, says whose side the cause is on, and fixes it once you approve.",
    benefits: [
      { art: 'crowd', title: 'From one complaint to everyone', text: 'One customer writes in. Blindspot finds every other customer the same problem hit, including the ones who stayed silent.' },
      { art: 'proof', title: 'Whose side, with proof', text: 'Each incident says whether the cause is your code, your setup, Razorpay or the bank, and shows the records behind it.' },
      { art: 'approve', title: 'You approve, it does the rest', text: 'Fixes and messages run in stages, and you choose how much happens without asking. It never switches anyone’s access off.' },
    ],
    steps: [
      { art: 'stairs', title: 'Answer three setup questions', text: 'Choose where customers can reach it, how much it does on its own, and run your first scan. It never asks for a password, card details or an OTP.' },
      { art: 'alert', title: 'Open an incident', text: 'When something breaks, Blindspot opens an incident: who is affected, how much money is at risk, and whose side the cause is on.' },
      { art: 'approve', title: 'Approve the fix', text: 'Check the dry run, then let it fix the first 5 customers and then the rest. You approve each step.' },
    ],
    links: [{ label: 'See an incident', to: '/incidents/INC-1' }, { label: 'How we know it works', to: '/how' }],
    note: DEMO,
  },
  {
    id: 'incidents',
    title: 'Incidents',
    to: '/incidents',
    icon: ActivityIcon,
    tagline: 'Every customer one payment problem touched, in one place',
    description:
      'A payment can break in three places: before it reaches Razorpay, inside the payment, or after it. Blindspot covers the first and the last, where Razorpay’s own tools stop looking. Each incident shows who is affected, how much money is at risk, and what to do.',
    benefits: [
      { art: 'zones', title: 'Three places a payment breaks', text: 'Before Razorpay, inside the payment, or after it. You see the place first, then the cause.' },
      { art: 'inferred', title: '“Inferred” means no payment exists', text: 'No payment exists to look up, so Blindspot says it is an inference, shows the evidence, and never moves money on it.' },
      { art: 'stairs', title: 'Fix in stages, with undo', text: 'A dry run, then the first 5 customers, then the rest, each checked against your records. You can undo until customers have been told.' },
    ],
    steps: [
      { art: 'alert', title: 'Open an incident', text: 'Pick one from the list. The page shows what broke, who is affected and the amount at risk.' },
      { art: 'proof', title: 'Check the evidence', text: 'Read whose side the cause is on and the records behind it. If no payment existed, it says the finding is an inference.' },
      { art: 'stairs', title: 'Fix it in stages', text: 'A dry run, the first 5 customers, then the rest. After that you tell the customers, then verify and close.' },
    ],
    links: [{ label: 'Open an incident', to: '/incidents/INC-1' }, { label: 'How we know it works', to: '/how' }],
    note: DEMO,
  },
  {
    id: 'conversations',
    title: 'Conversations',
    to: '/threads',
    icon: UsersIcon,
    tagline: 'Customers get help, and you see every thread',
    description:
      'When a customer writes about a payment, the assistant says it is an AI, asks for a reference, finds the payment in Razorpay’s records and tells them what happened. You see every thread, and it hands over to you when a person is needed.',
    benefits: [
      { art: 'search', title: 'Finds the payment', text: 'It asks up to three simple questions, in English or Hinglish, and matches the answer to an exact reference. It never guesses.' },
      { art: 'lock', title: 'Never asks for credentials', text: 'No OTP, PIN, CVV or card number. Every reply is checked before it is sent, and anything that fails is held for you.' },
      { art: 'handover', title: 'Hands over cleanly', text: 'Money, access, abuse and legal threats come to you with the whole thread and a short brief, so nobody asks the customer twice.' },
    ],
    steps: [
      { art: 'chat', title: 'A customer writes in', text: 'On WhatsApp, by email or from the help button on a Razorpay page. The assistant says it is an AI.' },
      { art: 'search', title: 'It finds the payment', text: 'It asks up to three simple questions and matches the answers to an exact payment in Razorpay’s records.' },
      { art: 'handover', title: 'You see the thread', text: 'Every conversation is listed here. When a person is needed, it hands over to you with the whole thread.' },
    ],
    links: [{ label: 'Try a conversation', to: '/chat-demo' }, { label: 'Where customers can write', to: '/channels' }],
    note: `${DEMO} The conversations are scripted.`,
  },
  {
    id: 'channels',
    title: 'Channels',
    to: '/channels',
    icon: RadioIcon,
    tagline: 'Choose where customers can reach it',
    description:
      'Customers write where they already are: the help button on Razorpay pages, a payments WhatsApp number, email, Instagram and Messenger. Each channel is off until you connect it, and you can see what the assistant may read on it.',
    benefits: [
      { art: 'channels', title: 'Only where you allow', text: 'Each channel needs your consent. Only messages about a payment are kept. Everything else is dropped.' },
      { art: 'chat', title: 'Your name, with Razorpay', text: 'Replies read “Your business payment help, powered by Razorpay”, and the assistant always says it is an AI.' },
      { art: 'lock', title: 'Public posts stay private', text: 'A public post gets one reply that says nothing about the payment and invites the person to message privately. Switch a channel off and it stops at once.' },
    ],
    steps: [
      { art: 'channels', title: 'Pick a channel', text: 'Start with the help button on Razorpay pages, a payments WhatsApp number or email. Instagram and Messenger are there too. Each is off until you connect it.' },
      { art: 'proof', title: 'Check what it may read', text: 'You see what the assistant may read and who it replies as before it starts. Only messages about a payment are kept.' },
      { art: 'switch', title: 'Switch it off any time', text: 'Disconnect a channel and the assistant stops on it at once.' },
    ],
    links: [{ label: 'Instagram handover', to: '/ig-demo' }, { label: 'A public post', to: '/public-demo' }],
    note: 'Every channel is simulated in this prototype. No real message is sent.',
  },
  {
    id: 'scan',
    title: 'Day-0 scan',
    to: '/scan',
    icon: SearchIcon,
    tagline: 'See what is already stuck, the day you connect',
    description:
      'The first time you connect, Blindspot compares Razorpay’s records with your access records and lists the customers who paid and were never given access. It only looks. It changes nothing and messages no one.',
    benefits: [
      { art: 'stuck', title: 'Paid and not restored', text: 'The customers who paid you and still have no access, with the amount.' },
      { art: 'search', title: 'Read only', text: 'The scan does not message anyone and does not change any access.' },
      { art: 'alert', title: 'Straight to the cause', text: 'Each group links to the incident that explains it.' },
    ],
    steps: [
      { art: 'search', title: 'Run it once', text: 'Blindspot compares Razorpay’s payment records with your access records. You do not have to enter anything.' },
      { art: 'stuck', title: 'See who is stuck', text: 'The customers who paid you and never got access, with the amount.' },
      { art: 'alert', title: 'Follow it to the cause', text: 'Each group links to the incident that explains it. Nothing is changed and no one is messaged.' },
    ],
    links: [{ label: 'Run the scan', to: '/scan' }, { label: 'See an incident', to: '/incidents/INC-1' }],
    note: DEMO,
  },
  {
    id: 'autonomy',
    title: 'Autonomy',
    to: '/settings',
    icon: SlidersIcon,
    tagline: 'You decide how much it does on its own',
    description:
      'Blindspot starts on Suggest, where nothing happens until you approve it. Raise the level in Settings when you trust the wording. A few things are never available at any level: switching access off, refunding to a new destination, changing Razorpay settings and writing to your database.',
    benefits: [
      { art: 'approve', title: 'Suggest', text: 'You approve every step: the dry run, the first 5, the rest, and every message to a customer. This is where it starts.' },
      { art: 'stairs', title: 'Assist', text: 'You approve a fix once. It then runs in stages by itself and stops if anything fails. Messages still need you.' },
      { art: 'gate', title: 'Autopilot', text: 'Fixes and messages run on their own within your limits, and fixes can be undone. Refunds and recovery links always need you.' },
    ],
    steps: [
      { art: 'approve', title: 'Start on Suggest', text: 'Nothing happens until you approve it. Every step and every message waits for you.' },
      { art: 'stairs', title: 'Raise it when you trust it', text: 'On Assist, you approve a fix once and it runs in stages. On Autopilot, fixes and messages run within your limits.' },
      { art: 'gate', title: 'Set the limits', text: 'Cap how many customers one action can touch, and hold back a share of recovery links to measure their effect.' },
    ],
    links: [{ label: 'Open Settings', to: '/settings' }, { label: 'Audit log', to: '/audit' }],
    note: DEMO,
  },
  {
    id: 'learning',
    title: 'Learning',
    to: '/learning',
    icon: TrendingUpIcon,
    tagline: 'It tunes itself one step a week, and tells you why',
    description:
      'Tell Blindspot an alert was a false alarm, or that it missed something. At the weekly review it moves one alert setting one step. A setting can change once a week, inside fixed limits, and every change is in the audit log.',
    benefits: [
      { art: 'chat', title: 'You give feedback', text: 'Mark an incident a false alarm, or say that customers wrote in and nothing alerted.' },
      { art: 'sliders', title: 'One step, inside limits', text: 'Each setting moves one rung on a fixed ladder, once a week. It cannot jump.' },
      { art: 'log', title: 'Every change is logged', text: 'You see what changed, why, and its version, here and in the audit log.' },
    ],
    steps: [
      { art: 'chat', title: 'Say when it was wrong', text: 'Mark an incident as a false alarm, or say that customers wrote in and nothing alerted.' },
      { art: 'calendar', title: 'It reviews once a week', text: 'At the weekly review it moves one alert setting one step, inside fixed limits.' },
      { art: 'log', title: 'Read what changed', text: 'Each change shows what moved, why, and its version, here and in the audit log.' },
    ],
    links: [{ label: 'Open Learning', to: '/learning' }, { label: 'Audit log', to: '/audit' }],
    note: 'Six simulated weeks on invented data. It shows the idea working as designed, not a result about real merchants.',
  },
  {
    id: 'how',
    title: 'How we know',
    to: '/how',
    icon: FileTextIcon,
    tagline: 'Every number is checked against hidden answers',
    description:
      'Blindspot is tested on a made-up merchant whose real problems are written in a separate file the product never reads. Each check compares what it found with those answers. The made-up world is clean, so high scores show the logic works, not how often it would be wrong on real traffic.',
    benefits: [
      { art: 'lock', title: 'The product never sees the answers', text: 'A test fails the build if any product code opens the file with the answers.' },
      { art: 'report', title: 'Numbers come from SQL or Python', text: 'No number on screen is written by a language model. Messages are filled from templates.' },
      { art: 'inferred', title: 'Read the caveats', text: 'The conversations are scripted and friendly to the rules. Real founders’ messages are the next test.' },
    ],
    steps: [
      { art: 'report', title: 'Read the checks', text: 'Each one compares what Blindspot found with answers it never sees.' },
      { art: 'inferred', title: 'Read the caveats', text: 'The made-up world is clean. High scores show the logic works, not how often it would be wrong on real traffic.' },
      { art: 'search', title: 'Check one yourself', text: 'Open an incident and compare it with the records it shows.' },
    ],
    links: [{ label: 'Open the checks', to: '/how' }, { label: 'See an incident', to: '/incidents/INC-1' }],
    note: 'Synthetic world, fixed random seed. Near-perfect scores are expected here.',
  },
]

export const guideById = (id?: string) => GUIDES.find((g) => g.id === id)
