import { Crumbs } from '../components/Crumbs'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Box, Button, Divider, Heading, RayIcon, Text } from '@razorpay/blade/components'
import { ChatSteps } from '../components/ChatSteps'
import { CustomerChat } from '../components/CustomerChat'
import { GuideArt } from '../components/GuideArt'
import { Panel } from '../components/Panel'
import { ThreadView } from '../components/ThreadView'
import { isLive, useGet, type Schemas } from '../lib/api'
import { demoOpeners } from '../lib/demo'
import { useLiveThread } from '../lib/live'
import { PageHeader } from '../components/PageHeader'

type Thread = Schemas['ThreadDetail']
type Msg = Thread['messages'][number]

// The recorded conversations, by scenario id (lib/demo.ts). 'whatsapp' is the main story; the others are the side cases, in this order.
const MAIN = 'whatsapp'
const CASES: [string, string][] = [['unrelated', 'Not about a payment'], ['injection', 'A message that tries to trick it'], ['page', 'Could not pay']]
const LEVEL: Record<string, string> = { suggest: 'Review first', assist: 'Approve once', autopilot_reversible: 'Full automation' }

const said = (t: Thread) => t.messages.filter((m) => m.direction === 'outbound' && m.sender_role !== 'system')
const held = (t: Thread) => said(t).find((m) => m.policy.status === 'draft')
const told = (t: Thread) => said(t).find((m) => m.policy.class === 'status_reply' && m.policy.status === 'sent')
const slots = (m?: Msg) => (m?.policy.slots ?? {}) as Record<string, string | undefined>
// Where the main story is: 0 nobody has written, 1 Blindspot asked for the reference, 2 a reply waits for you, 4 the customer has it (every step done).
const stageOf = (t?: Thread) => (!t ? 0 : held(t) ? 2 : told(t) ? 4 : 1)

// What just happened and why, in one line, read from the conversation: its state, what it is about, and the amount and plan in the reply.
function outcome(t: Thread): { title: string; line: string } {
  const draft = held(t)
  const sent = told(t)
  const s = slots(draft ?? sent)
  const amount = s.amount ? `₹${Number(s.amount).toLocaleString('en-IN')}` : undefined
  if (t.state === 'pass_back') return { title: 'Not about a payment, so passed back', line: "Blindspot only takes payment problems. It told the customer Kaksha's team will answer, and kept nothing." }
  if (t.state === 'handoff' || t.state === 'human') {
    const why = t.founder_brief?.split('\n')[0].replace(/^Why this needs you:\s*/, '') ?? ''
    return {
      title: 'Sent to you. Nothing was refunded.',
      line: `${/instructions/i.test(why) ? 'The message tried to give Blindspot orders, so it was not followed.' : why} The customer was told Kaksha's team has it.`,
    }
  }
  if (t.claim === 'page_error') {
    return draft ? { title: 'No payment to find', line: "Kaksha's pay page was broken, so the payment never started. The reply is waiting for your approval." }
      : { title: 'Reply sent', line: "The customer knows the page broke on Kaksha's side and no money should have left." }
  }
  if (draft && t.claim === 'debited_no_access') return { title: amount ? `Found the ${amount} payment` : 'Found the payment', line: `Your records show ${s.plan ?? 'their purchase'} is not on, so the reply is waiting for your approval.` }
  if (draft) return { title: 'A reply is waiting for you', line: 'Read it and approve it, or write your own.' }
  if (sent) return { title: 'Reply sent', line: `The customer knows ${amount ? `the ${amount}` : 'the payment'} reached Kaksha, it is being fixed, and not to pay again.` }
  return { title: 'Asked for the UPI ref', line: 'The message had no payment reference. Blindspot said it is an AI and asked for the UPI ref, never an OTP or PIN.' }
}

// S-14: the customer's WhatsApp on the left, the founder's view of the same conversation on the right, with the main story in four steps above both.
export default function ChatDemo() {
  const [tid, setTid] = useState<string>()
  const [mainTid, setMainTid] = useState<string>()
  const [active, setActive] = useState<string>()  // the case on the phone now (scenario id), in the hosted demo
  const [v, setV] = useState(0)
  const t = useLiveThread(tid, v)
  const recorded = useLiveThread(mainTid, v)
  const main = isLive ? t : recorded  // live, any message can start the story, so it follows the conversation on screen
  const [openers, setOpeners] = useState<{ id: string; text: string; next?: string }[]>([])
  useEffect(() => {
    if (!isLive) demoOpeners('whatsapp_payments').then(setOpeners)
  }, [])
  const { data: settings } = useGet<Schemas['Settings']>('/api/settings')
  const level = settings?.autonomy ?? 'suggest'
  const at = stageOf(main)
  const aside = !isLive && active !== undefined && active !== MAIN
  const story = openers.find((o) => o.id === MAIN)
  const founder = useRef<HTMLDivElement>(null)

  const steps = [
    { title: 'The customer writes', note: 'On WhatsApp, about a payment' },
    { title: 'Blindspot checks', note: "Finds the payment, then Kaksha's records" },
    { title: 'You approve the reply', note: level === 'suggest' ? 'It waits for you on Review first' : `Your approval level: ${LEVEL[level] ?? level}` },
    { title: 'The customer is told', note: 'On WhatsApp, in their language' },
  ]

  const controls = (send: (text: string) => Promise<string | undefined>, busy: boolean) => {
    const go = async (id: string, text: string) => {
      const thread = await send(text)
      if (!thread) return
      setActive(id)
      if (id === MAIN) setMainTid(thread)
    }
    const waiting = t ? held(t) !== undefined : false  // a reply on screen waits for approval: that is the blue button then
    // The main story's next message: the opening, then the reference Blindspot asks for. While a reply waits, there is nothing for the customer to send.
    const next = at === 1 && story?.next ? story.next : at === 0 ? story?.text : undefined
    const say = next ? (at === 0 ? 'Start here. Send this as the customer:' : aside ? 'The main story waits for the UPI ref. Send it as the customer:' : 'Blindspot asked for the UPI ref. Send it as the customer:')
      : at === 4 ? (aside ? 'The main story is done. Play it again:' : 'Done. The customer has the reply.')
      : aside ? 'The main story is paused. Start it again from the top:' : 'Your turn: approve the reply in your Blindspot view.'
    const above = story && (
      <Box display="flex" flexDirection="column" gap="spacing.3" testID="next-message">
        <Text size="small" weight="semibold">{say}</Text>
        {next ? (
          <Box display="flex" gap="spacing.4" alignItems="center">
            <Box flex="1" minWidth="spacing.0" padding="spacing.3" borderRadius="medium" backgroundColor="surface.background.gray.intense"><Text size="small">{next}</Text></Box>
            <Button variant={waiting ? 'secondary' : 'primary'} isDisabled={busy} onClick={() => go(MAIN, next)} accessibilityLabel={`Send: ${next}`}>Send</Button>
          </Box>
        ) : (at === 4 || aside) && <Box><Button variant="secondary" isDisabled={busy} onClick={() => go(MAIN, story.text)}>Start the main story again</Button></Box>}
        {/* Stacked (below xl), your view sits under the phone and the cases, out of sight: one tap takes you to it. */}
        {t && <Box display={{ base: 'block', xl: 'none' }}><Button variant="tertiary" onClick={() => founder.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>See your Blindspot view</Button></Box>}
      </Box>
    )
    const below = (
      <Box display="flex" flexDirection="column" gap="spacing.5">
        <Divider />
        <Box display="flex" flexDirection="column" gap="spacing.4" testID="other-cases">
          <Text size="small" weight="semibold">Try other cases</Text>
          {CASES.flatMap(([id, label]) => {
            const o = openers.find((x) => x.id === id)
            return o ? [(
              <Box key={id} display="flex" gap="spacing.4" alignItems="center">
                <Box flex="1" minWidth="spacing.0" display="flex" flexDirection="column" gap="spacing.1">
                  <Box display="flex" gap="spacing.2" alignItems="center" flexWrap="wrap"><Text size="small" weight="semibold">{label}</Text>{active === id && <Badge size="small" color="neutral">On the phone</Badge>}</Box>
                  <Text size="small" color="surface.text.gray.muted">“{o.text}”</Text>
                </Box>
                <Button variant="secondary" isDisabled={busy} onClick={() => go(id, o.text)} accessibilityLabel={`Send: ${label}`}>Send</Button>
              </Box>
            )] : []
          })}
        </Box>
        <Text size="small" color="surface.text.gray.muted">In this demo you pick the customer's messages. The live version reads whatever they type.</Text>
      </Box>
    )
    return { above, below }
  }

  const o = t && outcome(t)
  return (
    <Box display="flex" flexDirection="column" gap="spacing.7">
      <Crumbs items={[{ label: 'Customer complaints', to: '/threads' }, { label: 'Try it: WhatsApp', to: '/chat-demo' }]} />
      <PageHeader title="Try it: WhatsApp" description="Send a customer's messages on WhatsApp, and see what you see in Blindspot as Kaksha's founder." />
      <Panel title="The main story" subtitle={!aside ? 'A customer paid, got nothing, and writes to Kaksha. Four steps.'
        : at === 4 ? 'Done. You are trying another case now.' : at === 0 ? 'Not started. You are trying another case.' : 'Paused while you try another case.'}>
        <ChatSteps steps={steps} at={at} />
      </Panel>
      {/* Side by side from xl: the phone column needs 448px, and the view beside it needs room for its messages. Stacked below that, the phone first. */}
      <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', xl: 'minmax(360px, 448px) minmax(0, 1fr)' }} gap="spacing.7" alignItems="start">
        <Panel title="Your customer's WhatsApp" subtitle="Chatting with Kaksha payment help, powered by Razorpay" testID="customer-side">
          <CustomerChat bare channel="whatsapp_payments" who="+919800012345" title="Kaksha payment help" onThread={setTid} controls={controls} />
        </Panel>
        <Box minWidth="0px" ref={founder}>
          <Panel title="Your Blindspot view" subtitle="What you see as Kaksha's founder" testID="founder-side">
            <Box display="flex" gap="spacing.3" alignItems="flex-start" testID="chat-outcome">
              <Box flexShrink={0} display="flex"><RayIcon size="large" color="surface.icon.onSea.onSubtle" /></Box>
              <Box display="flex" flexDirection="column" gap="spacing.1" minWidth="spacing.0">
                <Heading as="h3" size="small">{o ? o.title : "Waiting for the customer's first message"}</Heading>
                <Text color="surface.text.gray.muted">{o ? o.line : "Send it from the customer's WhatsApp. Then this view shows, in order:"}</Text>
                {t?.incident_id && (
                  <Link to={`/incidents/${t.incident_id}`} style={{ textDecoration: 'none' }}><Text size="small" weight="semibold" color="interactive.text.primary.normal">Open payment issue {t.incident_id}</Text></Link>
                )}
              </Box>
            </Box>
            <Divider />
            {t ? <ThreadView thread={t} onChanged={() => setV((n) => n + 1)} /> : (
              // Holds the founder's side from the start: what will appear here, so the page is never half empty.
              <Box display="flex" flexDirection="column" gap="spacing.5" testID="view-waiting">
                <Box display="flex" flexDirection="column" gap="spacing.3">
                  {['The payment Blindspot finds for this customer', "What Kaksha's records say they got", 'The reply, held until you approve it'].map((x, i) => (
                    <Box key={x} display="flex" gap="spacing.3" alignItems="center">
                      <Box width="spacing.6" height="spacing.6" flexShrink={0} borderRadius="max" display="flex" alignItems="center" justifyContent="center" borderWidth="thin" borderColor="surface.border.gray.normal">
                        <Text size="xsmall" weight="semibold" color="surface.text.gray.muted">{i + 1}</Text>
                      </Box>
                      <Text>{x}</Text>
                    </Box>
                  ))}
                </Box>
                <GuideArt art="search" height="152px" />
              </Box>
            )}
          </Panel>
        </Box>
      </Box>
    </Box>
  )
}
