import type { ArtId } from './art'
import { ActivityIcon, CodeSnippetIcon, FileTextIcon, RadioIcon, SearchIcon, SlidersIcon, TrendingUpIcon, UnlockIcon, UsersIcon, type IconComponent } from '@razorpay/blade/components'

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
  // One line for the Explore card on the home. It must fit two lines there and be true of the product today.
  summary?: string
  benefits: { art: ArtId; title: string; text: string }[]
  links: { label: string; to: string }[]
  // Slide 3, "How to use X": three plain steps, in the order a merchant does them.
  steps: { art: ArtId; title: string; text: string }[]
  // Shown under the figures. The figures come from the synthetic merchant, and a guide says so.
  note: string
  // Slide 2 and 3 headings. Without them: "Why it helps" and "How to use it".
  why?: string
  how?: string
}

const DEMO = 'Figures are from the demo merchant, Kaksha. All data is simulated.'

export const GUIDES: Guide[] = [
  {
    id: 'blindspot',
    title: 'Blindspot',
    // Razorpay's own guide headings, for the product name (Smart Collect: "What makes Smart Collect great?"). Pages named with a plain noun use the defaults.
    why: 'What makes Blindspot great?',
    how: 'How to use Blindspot',
    to: '/setup',
    icon: ActivityIcon,
    tagline: 'Find every customer a payment problem hit, and win them back',
    description:
      'A customer pays and your app gives them nothing, or your pay page breaks and they cannot pay at all. You find out days later, if at all. Razorpay sees the payment. Blindspot covers what breaks around it: it finds every customer hit, says whose side the cause is on, and fixes it and wins them back once you approve.',
    benefits: [
      { art: 'crowd', title: 'From one complaint to everyone', text: 'One customer writes in. Blindspot finds every other customer the same problem hit, including the ones who never wrote in.' },
      { art: 'proof', title: 'Whose side, with proof', text: 'Each payment issue says whether the cause is your code, your settings, Razorpay or the bank, and shows the records behind it.' },
      { art: 'approve', title: 'You approve, it does the rest', text: 'Fixes and messages go out in small steps, and you choose how much happens without asking. It never takes anyone’s access away.' },
    ],
    steps: [
      { art: 'stairs', title: 'Answer three setup questions', text: 'Choose where customers can reach you, decide how much it does on its own, and see what is already broken. It never asks for a password, card details or an OTP.' },
      { art: 'alert', title: 'Open a payment issue', text: 'When something breaks, Blindspot lists it: who was hit, the amount involved and whose side the cause is on.' },
      { art: 'approve', title: 'Approve the fix', text: 'Check a test run first, then fix the first 5 customers, then the rest. You approve each step.' },
    ],
    links: [{ label: 'See a payment issue', to: '/incidents/INC-1' }, { label: 'How accurate it is', to: '/how' }],
    note: DEMO,
  },
  {
    id: 'incidents',
    title: 'Payment issues',
    to: '/incidents',
    icon: ActivityIcon,
    tagline: 'Every customer hit by a payment problem, in one place',
    summary: 'Who was hit, the amount involved and whose side the cause is on, biggest first.',
    description:
      'A payment can break before it starts (your pay page or checkout does not open), during it (the bank or UPI fails) or after it (the customer paid and your app never gave them what they bought). Razorpay already shows failures during a payment. Blindspot covers before and after, and shows who was hit, the amount and what to do.',
    benefits: [
      { art: 'zones', title: 'Before, during or after payment', text: 'You see where it broke first, then the cause. Blindspot covers before and after, where Razorpay cannot see.' },
      { art: 'inferred', title: '“Estimated” means no payment exists', text: 'When customers could not reach a payment, there is nothing to look up. Blindspot says the figures are estimates, shows the evidence, and never moves money on them.' },
      { art: 'stairs', title: 'Fix in small steps, with undo', text: 'A test run, then the first 5 customers, then the rest, each checked against your records. You can undo until customers have been told.' },
    ],
    steps: [
      { art: 'alert', title: 'Open a payment issue', text: 'Pick one from the list. The page shows what broke, who was hit and the amount involved.' },
      { art: 'proof', title: 'Check the evidence', text: 'Read whose side the cause is on and the records behind it. If no payment existed, it says the figures are estimates.' },
      { art: 'stairs', title: 'Fix it in small steps', text: 'A test run, the first 5 customers, then the rest. After that you tell the customers, then check it held and close it.' },
    ],
    links: [{ label: 'Open the biggest one', to: '/incidents/INC-1' }, { label: 'How accurate it is', to: '/how' }],
    note: DEMO,
  },
  {
    id: 'conversations',
    title: 'Customer complaints',
    to: '/threads',
    icon: UsersIcon,
    tagline: 'Customers get answers, and you see every complaint',
    summary: 'Finds the payment a customer means, then hands over when you are needed.',
    description:
      'When a customer writes about a payment, the assistant says it is an AI, asks for a reference, finds the payment in Razorpay’s records and tells them what happened. You see every complaint, and it hands over to you when a person is needed.',
    benefits: [
      { art: 'search', title: 'Finds the payment', text: 'It asks up to three simple questions, in English or Hinglish, and matches the answer to an exact reference. It never guesses.' },
      { art: 'lock', title: 'Never asks for credentials', text: 'No OTP, PIN, CVV or card number. Every reply is checked before it is sent, and anything that fails is held for you.' },
      { art: 'handover', title: 'Hands over cleanly', text: 'Money, access, abuse and legal threats come to you with the whole thread and a short brief, so nobody asks the customer twice.' },
    ],
    steps: [
      { art: 'chat', title: 'A customer writes in', text: 'On WhatsApp, by email or from the help button on a Razorpay page. The assistant says it is an AI.' },
      { art: 'search', title: 'It finds the payment', text: 'It asks up to three simple questions and matches the answers to an exact payment in Razorpay’s records.' },
      { art: 'handover', title: 'You see the thread', text: 'Every complaint is listed here. When a person is needed, it hands over to you with the whole thread.' },
    ],
    links: [{ label: 'Try it as a customer', to: '/chat-demo' }, { label: 'Where customers can write', to: '/channels' }],
    note: `${DEMO} The conversations are scripted.`,
  },
  {
    id: 'channels',
    title: 'Connectors',
    to: '/channels',
    icon: RadioIcon,
    tagline: 'Choose where customers can reach you',
    summary: 'WhatsApp, email and the help button: what it may read there, and an off switch.',
    description:
      'Customers write where they already are: the help button on Razorpay pages, a payments WhatsApp number, email, Instagram and Messenger. Each connector is off until you switch it on, and you can see what the assistant may read there.',
    benefits: [
      { art: 'channels', title: 'Only where you allow', text: 'Each connector needs your consent. Only messages about a payment are kept. Everything else is dropped.' },
      { art: 'chat', title: 'Your name, with Razorpay', text: 'Replies read “Your business payment help, powered by Razorpay”, and the assistant always says it is an AI.' },
      { art: 'lock', title: 'Public posts stay private', text: 'A public post gets one reply that says nothing about the payment and invites the person to message privately. Switch a connector off and it stops at once.' },
    ],
    steps: [
      { art: 'channels', title: 'Pick where to listen', text: 'Start with the help button on Razorpay pages, a payments WhatsApp number or email. Instagram and Messenger are there too. Each is off until you switch it on.' },
      { art: 'proof', title: 'Check what it may read', text: 'You see what the assistant may read and who it replies as before it starts. Only messages about a payment are kept.' },
      { art: 'switch', title: 'Switch it off any time', text: 'Disconnect one and the assistant stops there at once.' },
    ],
    links: [{ label: 'Instagram handover', to: '/ig-demo' }, { label: 'A public post', to: '/public-demo' }],
    note: 'Every connector is simulated in this prototype. No real message is sent.',
  },
  {
    id: 'scan',
    title: 'First check',
    why: 'What the first check gives you',
    how: 'How the first check works',
    to: '/scan',
    icon: SearchIcon,
    tagline: 'See what is already broken, the day you connect',
    summary: 'Compares Razorpay’s records with yours for the last 30 days.',
    description:
      'The first time you connect, Blindspot compares the last 30 days of Razorpay’s records with your access records and lists the customers who paid and were never given access. It only looks. It changes nothing and messages no one.',
    benefits: [
      { art: 'stuck', title: 'Paid, no access', text: 'The customers who paid you and still have no access, with the amount.' },
      { art: 'search', title: 'Read only', text: 'The first check does not message anyone and does not change any access.' },
      { art: 'alert', title: 'Straight to the cause', text: 'Each group links to the payment issue that explains it.' },
    ],
    steps: [
      { art: 'search', title: 'It runs once, on its own', text: 'Blindspot compares Razorpay’s payment records with your access records. You do not have to enter anything.' },
      { art: 'stuck', title: 'See who is stuck', text: 'The customers who paid you and never got access, with the amount.' },
      { art: 'alert', title: 'Follow it to the cause', text: 'Each group links to the payment issue that explains it. Nothing is changed and no one is messaged.' },
    ],
    links: [{ label: 'See the first check', to: '/scan' }, { label: 'See a payment issue', to: '/incidents/INC-1' }],
    note: DEMO,
  },
  {
    id: 'autonomy',
    title: 'Settings',
    why: 'Three levels, and you pick',
    how: 'How to set it',
    to: '/settings',
    icon: SlidersIcon,
    tagline: 'You decide how much it does on its own',
    summary: 'It starts on Review first, where nothing happens until you approve.',
    description:
      'Blindspot starts on Review first, where nothing happens until you approve it. Move it up in Settings when you trust it. A few things are never allowed at any level: taking access away, refunding to a new account, changing Razorpay settings and writing to your database.',
    benefits: [
      { art: 'approve', title: 'Review first', text: 'You approve every step: the test run, the first 5, the rest, and every message to a customer. This is where it starts.' },
      { art: 'stairs', title: 'Approve once', text: 'You approve a fix once. It then goes out in steps by itself and stops if anything fails. Messages still need you.' },
      { art: 'gate', title: 'Full automation', text: 'Fixes and messages go out on their own within your limits, and fixes can be undone. Refunds and payment links always need you.' },
    ],
    steps: [
      { art: 'approve', title: 'Start on Review first', text: 'Nothing happens until you approve it. Every step and every message waits for you.' },
      { art: 'stairs', title: 'Move up when you trust it', text: 'On Approve once, you approve a fix once and it goes out in steps. On Full automation, fixes and messages go out within your limits.' },
      { art: 'gate', title: 'Set the limits', text: 'Cap how many customers one action can touch, and hold back a few payment links to measure what they add.' },
    ],
    links: [{ label: 'Open Settings', to: '/settings' }, { label: 'Audit trail', to: '/audit' }],
    note: DEMO,
  },
  {
    id: 'learning',
    title: 'Alert tuning',
    why: 'Why alerts get better',
    how: 'How to tune alerts',
    to: '/learning',
    icon: TrendingUpIcon,
    tagline: 'Fewer false alarms, one small step a week',
    summary: 'Mark a false alarm or a miss, and it adjusts one alert setting once a week.',
    description:
      'Tell Blindspot when an alert was a false alarm, or when it missed something. Once a week it moves one alert setting by one step, inside fixed limits, and writes down why. Every change is in the audit trail.',
    benefits: [
      { art: 'chat', title: 'You say when it was wrong', text: 'Mark a payment issue as a false alarm, or say that customers wrote in and nothing alerted.' },
      { art: 'sliders', title: 'One step, inside limits', text: 'Each setting moves one notch on a fixed scale, once a week. It cannot jump.' },
      { art: 'log', title: 'Every change is written down', text: 'You see what changed, why, and its version, here and in the audit trail.' },
    ],
    steps: [
      { art: 'chat', title: 'Say when it was wrong', text: 'Mark a payment issue as a false alarm, or say that customers wrote in and nothing alerted.' },
      { art: 'calendar', title: 'It reviews once a week', text: 'At the weekly review it moves one alert setting one step, inside fixed limits.' },
      { art: 'log', title: 'Read what changed', text: 'Each change shows what moved, why, and its version, here and in the audit trail.' },
    ],
    links: [{ label: 'Open Alert tuning', to: '/learning' }, { label: 'Audit trail', to: '/audit' }],
    note: 'Six simulated weeks on invented data. It shows the idea working as designed, not a result about real merchants.',
  },
  {
    id: 'how',
    title: 'Accuracy',
    why: 'Why you can trust the numbers',
    how: 'How to check it yourself',
    to: '/how',
    icon: FileTextIcon,
    tagline: 'Every number is checked against known answers',
    summary: 'Every figure is tested against a made-up merchant whose real problems are known.',
    description:
      'Blindspot is tested on a made-up merchant whose real problems are written in a separate file the product never reads. Each check compares what it found with those answers. The made-up merchant is tidy, so high scores show the logic works, not how often it would be wrong on real traffic.',
    benefits: [
      { art: 'lock', title: 'The product never sees the answers', text: 'A test fails the build if any product code opens the file with the answers.' },
      { art: 'report', title: 'Numbers come from SQL or Python', text: 'No number on screen is written by a language model. Messages are filled from templates.' },
      { art: 'inferred', title: 'Read the caveats', text: 'The conversations are scripted and friendly to the rules. Real founders’ messages are the next test.' },
    ],
    steps: [
      { art: 'report', title: 'Read the checks', text: 'Each one compares what Blindspot found with answers it never sees.' },
      { art: 'inferred', title: 'Read the caveats', text: 'The made-up merchant is tidy. High scores show the logic works, not how often it would be wrong on real traffic.' },
      { art: 'search', title: 'Check one yourself', text: 'Open a payment issue and compare it with the records it shows.' },
    ],
    links: [{ label: 'Open the checks', to: '/how' }, { label: 'See a payment issue', to: '/incidents/INC-1' }],
    note: 'Made-up merchant, fixed random seed. Near-perfect scores are expected here.',
  },
  {
    id: 'access',
    title: 'Unpaid access',
    why: 'What the list gives you',
    how: 'How to use the list',
    to: '/access',
    icon: UnlockIcon,
    tagline: 'Customers who stopped paying but kept access',
    summary: 'Renewals that failed on the customer’s side, still on after your grace period.',
    description:
      'When a UPI AutoPay renewal fails because the customer’s account had no money, your app should end access once your grace period runs out. Sometimes it does not. Blindspot lists those customers and the amount unpaid. It never takes access away itself.',
    benefits: [
      { art: 'door', title: 'Only past your own rule', text: 'A customer joins the list only after your grace period has run out. The ones still inside it are shown separately.' },
      { art: 'proof', title: 'Only their side', text: 'Renewals that failed on the bank’s or Razorpay’s side are left out: the customer owes nothing for those.' },
      { art: 'lock', title: 'Nothing is changed', text: 'It is a list for you to act on. Blindspot never ends anyone’s access.' },
    ],
    steps: [
      { art: 'door', title: 'Open the list', text: 'Each row shows the customer, the failed renewal, how long past your rule they are and when their access runs out.' },
      { art: 'search', title: 'Check the ones left out', text: 'The page says who was left out and why, so you can trust what is on it.' },
      { art: 'approve', title: 'Act in your own system', text: 'End access there, or send the customer your own payment link.' },
    ],
    links: [{ label: 'Open Unpaid access', to: '/access' }, { label: 'How accurate it is', to: '/how' }],
    note: DEMO,
  },
  {
    id: 'integration',
    title: 'Integration',
    why: 'Why it helps',
    how: 'How to use it',
    to: '/connect',
    icon: CodeSnippetIcon,
    tagline: 'Set up your webhook right, and check it before every release',
    summary: 'One prompt for your coding agent, then a go-live check before each release.',
    description:
      'Most of the problems Blindspot finds start with a webhook that was set up wrong or broken by a release. Paste one prompt into your coding agent to set it up properly, then run the go-live check before every release, so a break shows up before a customer finds it.',
    benefits: [
      { art: 'release', title: 'Stops a bad release', text: 'The check sends your webhook a test payment and opens your pay page. If either fails, it tells you to hold the release.' },
      { art: 'lock', title: 'Never asks for your secret', text: 'The prompt keeps your webhook secret in your own settings. A test payment never gives a real customer anything.' },
      { art: 'proof', title: 'Each rule has a reason', text: 'Every line of the prompt closes a failure Blindspot has seen, and the page says which one.' },
    ],
    steps: [
      { art: 'search', title: 'Build with AI', text: 'Copy the prompt into Claude Code, Cursor or any coding agent. It sets up your webhook and writes the tests.' },
      { art: 'release', title: 'Run the go-live check', text: 'It sends a test payment to your webhook and opens your pay page, and says pass or fail for each step.' },
      { art: 'approve', title: 'Add it to your release', text: 'One line in your release script stops the release by itself when the check fails.' },
    ],
    links: [{ label: 'Build with AI', to: '/connect' }, { label: 'Go-live check', to: '/release-check' }],
    note: 'Your server and pay page are simulated in this prototype.',
  },
]

export const guideById = (id?: string) => GUIDES.find((g) => g.id === id)
