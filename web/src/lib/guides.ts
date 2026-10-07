import { ActivityIcon, CheckCircleIcon, LockIcon, RadioIcon, SearchIcon, ShieldIcon, UsersIcon, type IconComponent } from '@razorpay/blade/components'

// Product guides, in the shape of Razorpay's own (Smart Collect, Checkout Rewards): a hero slide, then "What makes X great?" with three cards.
// To add a guide, add an entry here. The page at /guides/:id and the cards on the home screen read this list. Copy rules: web/DESIGN.md section 16.
export type Guide = {
  id: string
  title: string
  to: string
  icon: IconComponent
  tagline: string
  description: string
  benefits: { icon: IconComponent; title: string; text: string }[]
}

export const GUIDES: Guide[] = [
  {
    id: 'blindspot',
    title: 'Blindspot',
    to: '/setup',
    icon: ActivityIcon,
    tagline: 'Find every customer a payment problem touched',
    description: "Blindspot looks at what happens before and after a payment, where other tools stop looking. It works out whose side the fault is on, fixes it for everyone affected, and asks you only to approve.",
    benefits: [
      { icon: UsersIcon, title: 'From one complaint to everyone', text: 'One customer writes in. Blindspot finds every other customer the same problem hit, including the ones who stayed silent.' },
      { icon: ShieldIcon, title: 'Whose side, with evidence', text: 'Each incident says whether the cause is on your side, Razorpay’s or the bank’s, and shows the records behind it.' },
      { icon: CheckCircleIcon, title: 'You approve, it does the rest', text: 'Fixes, customer messages and checks run in stages. You choose how much it does on its own.' },
    ],
  },
  {
    id: 'incidents',
    title: 'Incidents',
    to: '/incidents',
    icon: ActivityIcon,
    tagline: 'Every customer one payment problem touched, in one place',
    description: 'Complaints and payment signals are grouped into incidents. Each one shows who is affected, how much money is at risk, and what to do about it.',
    benefits: [
      { icon: SearchIcon, title: 'Grouped by where it broke', text: 'Before Razorpay, inside the payment, or after the payment. You see the zone first, then the cause.' },
      { icon: UsersIcon, title: 'Money at risk, not just counts', text: 'How many customers complained, how many did not, and the amount at risk.' },
      { icon: CheckCircleIcon, title: 'A fix you can check', text: 'A dry run first, then the first five customers, then the rest. Each step is checked against your records.' },
    ],
  },
  {
    id: 'conversations',
    title: 'Conversations',
    to: '/threads',
    icon: UsersIcon,
    tagline: 'Customers get help, and you see every thread',
    description: 'The agent talks to customers on the channels they already use, finds the payment behind each complaint, and hands over to you when a person is needed.',
    benefits: [
      { icon: SearchIcon, title: 'Finds the payment', text: 'It asks a few simple questions and matches the answers to Razorpay’s records.' },
      { icon: LockIcon, title: 'Never asks for credentials', text: 'It never asks for card details, OTPs or passwords.' },
      { icon: UsersIcon, title: 'Hands over cleanly', text: 'When a person is needed, you get the whole thread and the case, so nobody asks the customer twice.' },
    ],
  },
  {
    id: 'channels',
    title: 'Channels',
    to: '/channels',
    icon: RadioIcon,
    tagline: 'Choose where customers can reach the agent',
    description: 'WhatsApp, email and the help button on Razorpay pages. The agent says it is an AI, speaks as your business with Razorpay, and can be switched off at any moment.',
    benefits: [
      { icon: RadioIcon, title: 'Only where you allow', text: 'Each channel is off until you connect it, and you can see what the agent may read on each one.' },
      { icon: UsersIcon, title: 'Your name, with Razorpay', text: 'Replies read “Your business payment help, powered by Razorpay”, and the agent always says it is an AI.' },
      { icon: ShieldIcon, title: 'One switch stops it', text: 'Switch a channel off and the agent stops on it at once.' },
    ],
  },
  {
    id: 'scan',
    title: 'Day-0 scan',
    to: '/scan',
    icon: SearchIcon,
    tagline: 'See what is already stuck, the day you connect',
    description: 'Blindspot compares Razorpay’s records with your access records and lists customers who paid and were never restored. Nothing is changed.',
    benefits: [
      { icon: SearchIcon, title: 'Paid and not restored', text: 'The customers who paid you and still have no access, with the amount.' },
      { icon: LockIcon, title: 'Read only', text: 'The scan only looks. It does not message anyone or change any access.' },
      { icon: ActivityIcon, title: 'Straight to the cause', text: 'Each group links to the incident that explains it.' },
    ],
  },
]

export const guideById = (id?: string) => GUIDES.find((g) => g.id === id)
