import { useNavigate } from 'react-router-dom'
import { Box, Heading, Text } from '@razorpay/blade/components'
import { WhatsAppChat, type WaMessage } from '../components/WhatsAppChat'
import { rupees, useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'
import { waTime } from '../lib/whatsapp'

// Simulated WhatsApp. RAY is Razorpay's product; this shows what its message could carry.
export default function Ray() {
  const nav = useNavigate()
  const { data: incs, error } = useGet<Schemas['IncidentSummary'][]>('/api/incidents')
  const inc = incs?.find((i) => i.id === 'INC-1') ?? incs?.find((i) => i.zone === 'after' && i.mismatch_type !== 'G')    // Hero A: paid, and no access
  const incB = incs?.find((i) => i.zone === 'before' && i.id === 'INC-4') ?? incs?.find((i) => i.zone === 'before')   // Hero B: could not pay at all
  const incC = incs?.find((i) => i.mismatch_type === 'G')    // Razorpay's side: card renewals failed in its gateway
  const id = inc?.id
  const { data: card } = useGet<Schemas['RayCard']>(id ? `/api/incidents/${id}/ray_card` : null)
  const { data: cardB } = useGet<Schemas['RayCard']>(incB ? `/api/incidents/${incB.id}/ray_card` : null)
  const { data: cardC } = useGet<Schemas['RayCard']>(incC ? `/api/incidents/${incC.id}/ray_card` : null)
  const { data: members } = useGet<Schemas['Member'][]>(id ? `/api/incidents/${id}/members` : null)
  const atAlert = inc?.would_have_alerted_at && members ? members.filter((m) => m.captured_at <= inc.would_have_alerted_at!).length : null

  const go = (c: Schemas['RayCard'], label: string) => nav(label === c.buttons[1] ? `/incidents/${c.incident_id}/dev` : `/incidents/${c.incident_id}`)
  const chats: { key: string; caption: string; cardOf: Schemas['RayCard']; messages: WaMessage[] }[] = []
  if (inc && card) chats.push({ key: 'A', caption: 'Paid, and no access', cardOf: card, messages: [
    { from: 'business', day: when(inc.would_have_alerted_at!), time: waTime(inc.would_have_alerted_at!), text: `Heads up · ${card.owner_chip}\n\nYour webhook is failing. Your server is answering Razorpay with an error, so paid customers are not getting access.\n\n${atAlert} customer affected so far. I'll keep watching.` },
    { from: 'business', day: 'Friday, after a complaint', text: `${card.owner_chip}\n\n${card.cause_line}\n\n${card.affected} customers paid and have no access. ${card.complained} complained, ${card.silent} did not. ${rupees(card.at_risk_paise)} at risk.`, buttons: card.buttons.slice(0, 2) },
  ] })
  if (incB && cardB) chats.push({ key: 'B', caption: 'Could not pay at all', cardOf: cardB, messages: [
    { from: 'business', day: `${when(incB.would_have_alerted_at ?? incB.onset_at)}, minutes after a deploy`, time: waTime(incB.would_have_alerted_at ?? incB.onset_at), text: `Heads up · ${cardB.owner_chip}\n\nYour pay page is not answering. A change went live a few minutes before. Razorpay cannot see this, so I am telling you.\n\nI'll keep watching.` },
    { from: 'business', day: 'The next morning', text: `${cardB.owner_chip}\n\n${cardB.cause_line}\n\n${cardB.affected} orders lost, about. ${cardB.at_risk_paise ? `${rupees(cardB.at_risk_paise)} from customers who can still be reached.` : ''}`, buttons: cardB.buttons.slice(0, 2) },
  ] })
  if (incC && cardC) chats.push({ key: 'C', caption: "Razorpay's side", cardOf: cardC, messages: [
    { from: 'business', day: `${when(incC.would_have_alerted_at ?? incC.onset_at)}, before anyone wrote`, time: waTime(incC.would_have_alerted_at ?? incC.onset_at), text: `Heads up · ${cardC.owner_chip}\n\nCard renewals are failing with the same gateway error, while UPI AutoPay renewals go through. Nothing changed on your side, so this looks like Razorpay's.\n\nI'll keep watching.` },
    { from: 'business', day: 'The picture so far', text: `${cardC.owner_chip}\n\n${cardC.cause_line}\n\n${cardC.affected} renewals failed. ${cardC.complained} customers wrote in, ${cardC.silent} did not. ${rupees(cardC.at_risk_paise)} still to collect.`, buttons: cardC.buttons.slice(0, 2) },
  ] })

  return (
    <Box display="flex" flexDirection="column" gap="spacing.5">
      <Box display="flex" flexDirection="column" gap="spacing.2">
        <Heading size="large">RAY on WhatsApp</Heading>
        <Text color="surface.text.gray.muted">Simulated. Blindspot gives RAY something to say before the founder hears it from a customer.</Text>
      </Box>
      {error && <Text color="feedback.text.negative.intense">Could not load: {error}</Text>}
      <Box display="grid" gridTemplateColumns="repeat(auto-fit, minmax(min(100%, 300px), 1fr))" gap="spacing.6" justifyItems="center">
        {chats.map((c) => (
          <Box key={c.key} display="flex" flexDirection="column" gap="spacing.3" width="100%" alignItems="center">
            <Text size="small" weight="semibold" color="surface.text.gray.muted">{c.caption}</Text>
            <WhatsAppChat name="Ray by Razorpay" messages={c.messages} notice={false} day="Today" onButton={(label) => go(c.cardOf, label)} />
          </Box>
        ))}
      </Box>
      {!inc && !error && <Text color="surface.text.gray.muted">Nothing to report. No mismatches found.</Text>}
    </Box>
  )
}
