import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { m } from 'framer-motion'
import { Box, Card, CardBody, CheckCircleIcon, CircleIcon, Heading, Text } from '@razorpay/blade/components'
import { WhatsAppChat } from '../components/WhatsAppChat'
import { rupees, useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'
import { waTime } from '../lib/whatsapp'
import { prefersReducedMotion } from '../razorsense'

type RayCard = Schemas['RayCard']
type Chat = { key: string; caption: string; line: string; card: RayCard; day: string; time: string; text: string }

// Simulated WhatsApp. Ray is Razorpay's product; this shows what its first message could carry. One short clip at a time: pick a problem on the
// left and its heads-up shows on the right (Eshan's call, 10 Oct). The full story is on the incident page, one tap away. Every figure is read from the data.
export default function Ray() {
  const nav = useNavigate()
  const [pick, setPick] = useState('A')
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  const inc = incs?.find((i) => i.id === 'INC-1') ?? incs?.find((i) => i.zone === 'after' && i.mismatch_type !== 'G' && i.mismatch_type !== 'E')    // Hero A: paid, and no access
  const incB = incs?.find((i) => i.zone === 'before' && i.id === 'INC-4') ?? incs?.find((i) => i.zone === 'before')   // Hero B: could not pay at all
  const incC = incs?.find((i) => i.mismatch_type === 'G')    // Razorpay's side: card renewals failed in its gateway
  const incD = incs?.find((i) => i.mismatch_type === 'E')    // Charged twice: the second charge is the problem
  const id = inc?.id
  const { data: card } = useGet<RayCard>(id ? `/api/incidents/${id}/ray_card` : null)
  const { data: cardB } = useGet<RayCard>(incB ? `/api/incidents/${incB.id}/ray_card` : null)
  const { data: cardC } = useGet<RayCard>(incC ? `/api/incidents/${incC.id}/ray_card` : null)
  const { data: cardD } = useGet<RayCard>(incD ? `/api/incidents/${incD.id}/ray_card` : null)
  const { data: members } = useGet<Schemas['Member'][]>(id ? `/api/incidents/${id}/members` : null)
  const atAlert = inc?.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  const chats: Chat[] = []
  const at = (i: Schemas['IncidentSummary']) => i.would_have_alerted_at ?? i.onset_at
  if (inc && card) chats.push({ key: 'A', caption: 'Paid, and no access', card, line: `${card.affected} customers · ${rupees(card.at_risk_paise)} at risk`, day: when(at(inc)), time: waTime(at(inc)),
    text: `Heads up · ${card.owner_chip}\n\nYour webhook is failing, so paid customers are not getting access.${atAlert === null ? '' : ` ${atAlert} customer${atAlert === 1 ? '' : 's'} affected so far.`}` })
  if (incB && cardB) chats.push({ key: 'B', caption: 'Could not pay at all', card: cardB, line: `About ${cardB.affected} orders lost${cardB.at_risk_paise ? ` · ${rupees(cardB.at_risk_paise)} still reachable` : ''}`, day: when(at(incB)), time: waTime(at(incB)),
    text: `Heads up · ${cardB.owner_chip}\n\nYour pay page stopped answering minutes after a deploy. Razorpay cannot see this, so I am telling you.` })
  if (incC && cardC) chats.push({ key: 'C', caption: "Razorpay's side", card: cardC, line: `${cardC.affected} renewals failed · ${rupees(cardC.at_risk_paise)} to collect`, day: when(at(incC)), time: waTime(at(incC)),
    text: `Heads up · ${cardC.owner_chip}\n\nCard renewals are failing with a gateway error. Nothing changed on your side.` })
  if (incD && cardD) chats.push({ key: 'D', caption: 'Charged twice', card: cardD, line: `${cardD.affected} customers · ${rupees(cardD.at_risk_paise)} to refund`, day: when(at(incD)), time: waTime(at(incD)),
    text: `Heads up · ${cardD.owner_chip}\n\nCustomers are being charged twice, all from one Android release. Your webhook is fine.` })
  const shown = chats.find((c) => c.key === pick) ?? chats[0]
  const go = (c: RayCard, label: string) => nav(label === c.buttons[1] ? `/incidents/${c.incident_id}/dev` : `/incidents/${c.incident_id}`)

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5" testID="ray-whatsapp">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="large">Ray on WhatsApp</Heading>
        <Text color="surface.text.gray.muted">Simulated. The first message you would get, before a customer tells you. Pick a problem to see it.</Text>
      </Box>
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      {shown && (
        <Box display="grid" gridTemplateColumns={{ base: 'minmax(0, 1fr)', l: 'minmax(0, 1fr) minmax(0, 1fr)' }} gap="spacing.5">
          <Box display="flex" flexDirection="column" justifyContent="space-between" gap="spacing.3" order={{ base: 2, l: 1 }}>
            {chats.map((c) => {
              const on = c.key === shown.key
              return (
                <Card key={c.key} isSelected={on} onClick={() => setPick(c.key)} accessibilityLabel={`${c.caption}. ${c.line}${on ? ', shown' : ''}`} padding="spacing.5">
                  <CardBody>
                    <Box display="flex" justifyContent="space-between" alignItems="center" gap="spacing.4">
                      <Box display="flex" flexDirection="column" gap="spacing.1">
                        <Heading size="small">{c.caption}</Heading>
                        <Text size="small" color="surface.text.gray.muted">{c.line}</Text>
                      </Box>
                      {on ? <CheckCircleIcon size="large" color="surface.icon.primary.normal" /> : <CircleIcon size="large" color="surface.icon.gray.muted" />}
                    </Box>
                  </CardBody>
                </Card>
              )
            })}
          </Box>
          {/* Below l the clip comes first, so picking a problem changes what is on screen, not something below it. */}
          <Box order={{ base: 1, l: 2 }}><Card height="100%" padding="spacing.5"><CardBody><Box display="flex" alignItems="center" justifyContent="center" height="100%">
            <m.div key={shown.key} initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0, 0, 0.2, 1] }} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
              <WhatsAppChat name="Ray by Razorpay" avatar="razorpay" compact notice={false} testID={`ray-chat-${shown.key}`}
                messages={[{ from: 'business', day: shown.day, time: shown.time, text: shown.text, buttons: shown.card.buttons.slice(0, 2) }]}
                onButton={(label) => go(shown.card, label)} />
            </m.div>
          </Box></CardBody></Card></Box>
        </Box>
      )}
      {!inc && !error && incs && <Text color="surface.text.gray.muted">Nothing to report. No mismatches found.</Text>}
    </Box>
  )
}
