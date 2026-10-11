import { useState } from 'react'
import { Badge, Box, Button, ChartCartesianGrid, ChartLegend, ChartLine, ChartLineWrapper, ChartTooltip, ChartXAxis, ChartYAxis, Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableHeaderRow, TableRow, Text, Skeleton } from '@razorpay/blade/components'
import { PageHeader } from '../components/PageHeader'
import { Panel } from '../components/Panel'
import { send, useGet, type Schemas } from '../lib/api'
import { when } from '../lib/format'

const NAME: Record<string, string> = { order_dip_p_threshold: 'Order-dip alert strictness', complaint_spike_p_threshold: 'Complaint-spike alert strictness', message_variant: 'Default message language' }
const LANG: Record<string, string> = { en: 'English', hi_latn: 'Hinglish' }
const MISSED = [['order_volume_dip', 'Orders dropped and nothing alerted'], ['complaint_spike', 'Customers wrote in and nothing alerted']] as const
const ARM_TITLE = { off: 'No tuning', baseline: 'Weekly baseline only', loop: 'With tuning' } as const

// A strictness is a chance: how often noise alone would look this bad. 0.01 is 1 in 100.
const show = (key: string, v: unknown) => (key === 'message_variant' ? LANG[String(v)] ?? String(v) : `1 in ${Math.round(1 / Number(v)).toLocaleString('en-IN')}`)
const num = (n: number) => (Math.round(n * 10) / 10).toString()

// S-18. What Blindspot changed about itself this week, what is in force, and a simulated six weeks showing whether the idea works.
export default function Learning() {
  const [version, setVersion] = useState(0)
  const [busy, setBusy] = useState<string>()
  const [note, setNote] = useState<string>()
  const [error, setError] = useState<string>()
  const weekly = useGet<Schemas['LearningWeekly']>('/api/learning/weekly', version)
  const params = useGet<Schemas['LearningParam'][]>('/api/learning/params', version)
  const replay = useGet<Schemas['LearningReplay']>('/api/learning/replay')

  const act = async (id: string, fn: () => Promise<void>) => {
    setBusy(id)
    setError(undefined)
    try {
      await fn()
      setVersion((n) => n + 1)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(undefined)
    }
  }
  const review = () => act('review', async () => { await send('POST', '/api/learning/run'); setNote(undefined) })
  const missed = (monitor: string) => act(monitor, async () => {
    await send('POST', '/api/feedback', { subject_type: 'merchant', subject_id: 'founder', kind: 'missed_incident', payload: { monitors: [monitor] } })
    setNote('Noted. It is counted at the next review.')
  })

  const withId = (p: Schemas['LearningParam']) => ({ ...p, id: `${p.key}-${p.version}` })
  const current = (params.data ?? []).reduce<Record<string, Schemas['LearningParam']>>((m, p) => (!m[p.key] || p.version > m[p.key].version ? { ...m, [p.key]: p } : m), {})
  const history = (params.data ?? []).filter((p) => p.version > 0).sort((a, b) => b.updated_at.localeCompare(a.updated_at)).map(withId)
  const changes = weekly.data?.changes.length ?? 0
  const weeks = [...new Set((replay.data?.rows ?? []).map((r) => r.week))]
  const cell = (week: number, arm: keyof typeof ARM_TITLE) => (replay.data?.rows ?? []).find((r) => r.week === week && r.arm === arm)
  const total = (arm: keyof typeof ARM_TITLE, f: 'false_alerts' | 'missed') => (replay.data?.rows ?? []).filter((r) => r.arm === arm).reduce((a, r) => a + r[f], 0)

  return (
    <Box display="flex" flexDirection="column" gap="spacing.6">
      <PageHeader guide="learning" title="Alert tuning" description="Tell Blindspot when an alert was wrong. Once a week it moves one alert setting by one step, inside fixed limits, and says why. Every change is in the audit trail."
        actions={<Button isLoading={busy === 'review'} isDisabled={!!busy} onClick={review}>Review this week now</Button>} />
      {(error || weekly.error) && <Text color="feedback.text.negative.intense">Could not do that: {error ?? weekly.error}</Text>}

      <Panel title={changes ? `${changes} ${changes === 1 ? 'change' : 'changes'} this week` : 'No changes this week'} subtitle="Worked out from the feedback you gave in the last 7 days">
        {weekly.data ? weekly.data.lines.map((l) => <Text key={l}>{l}</Text>) : <Skeleton height="20px" width="min(420px, 80%)" borderRadius="medium" />}
        <Box display="flex" flexDirection="column" gap="spacing.3" paddingTop="spacing.4" borderTopWidth="thin" borderTopColor="surface.border.gray.subtle">
          <Text size="small" color="surface.text.gray.muted">Did Blindspot miss something? Tell it what happened.</Text>
          <Box display="flex" gap="spacing.3" flexWrap="wrap">
            {MISSED.map(([m, t]) => <Button key={m} variant="secondary" isLoading={busy === m} isDisabled={!!busy} onClick={() => missed(m)}>{t}</Button>)}
          </Box>
          {note && <Text color="feedback.text.positive.intense">{note}</Text>}
        </Box>
      </Panel>

      <Panel title="In force now" subtitle="Strictness is how unusual something must be before Blindspot alerts you. It starts at 1 in 100 and never goes past 1 in 1,000." pad={false}>
        <Table data={{ nodes: Object.values(current).map(withId) }} gridTemplateColumns="minmax(220px, 2fr) minmax(120px, 1fr) minmax(80px, 0.6fr) minmax(260px, 3fr)" isHeaderSticky={false}>
          {(items) => (
            <>
              <TableHeader><TableHeaderRow><TableHeaderCell>Setting</TableHeaderCell><TableHeaderCell>Now</TableHeaderCell><TableHeaderCell>Version</TableHeaderCell><TableHeaderCell>Why</TableHeaderCell></TableHeaderRow></TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} item={p}>
                    <TableCell><Text>{NAME[p.key] ?? p.key}</Text></TableCell>
                    <TableCell><Text weight="semibold">{show(p.key, p.value)}</Text></TableCell>
                    <TableCell><Badge size="medium" color={p.version ? 'information' : 'neutral'}>{p.version ? `v${p.version}` : 'Default'}</Badge></TableCell>
                    <TableCell><Text size="small" color="surface.text.gray.muted">{p.version ? `${p.reason} · ${when(p.updated_at)}` : 'Not changed yet'}</Text></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </>
          )}
        </Table>
      </Panel>

      <Panel title="History" subtitle="Every version of every setting, newest first" pad={false}>
        {history.length === 0 ? (
          <Box padding="spacing.6"><Text color="surface.text.gray.muted">Nothing has changed yet. Mark a payment issue as a false alarm, then press Review this week now.</Text></Box>
        ) : (
          <Table data={{ nodes: history }} gridTemplateColumns="minmax(120px, 1fr) minmax(220px, 2fr) minmax(160px, 1.4fr) minmax(260px, 3fr)" isHeaderSticky={false}>
            {(items) => (
              <>
                <TableHeader><TableHeaderRow><TableHeaderCell>When</TableHeaderCell><TableHeaderCell>Setting</TableHeaderCell><TableHeaderCell>Version</TableHeaderCell><TableHeaderCell>Why</TableHeaderCell></TableHeaderRow></TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id} item={p}>
                      <TableCell><Text size="small">{when(p.updated_at)}</Text></TableCell>
                      <TableCell><Text>{NAME[p.key] ?? p.key}</Text></TableCell>
                      <TableCell><Text>{`v${p.version}: ${show(p.key, p.value)}`}</Text></TableCell>
                      <TableCell><Text size="small" color="surface.text.gray.muted">{p.reason}</Text></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </>
            )}
          </Table>
        )}
      </Panel>

      <Panel title="Does it help? Six simulated weeks" subtitle="False alerts per week on an invented merchant, averaged over 5 replays. The founder in it calls every alert that is not a real outage false. The three match until week 3, so only the green line shows there."
        trailing={<Badge color="notice" size="medium">Simulated</Badge>} pad={false}>
        {weeks.length === 0 ? (
          <Box padding="spacing.6"><Text color="surface.text.gray.muted">The replay has not been run. Run make eval.</Text></Box>
        ) : (
          <>
            {/* A line per way of running it, so the drop is visible at a glance. Hover a week to read the three figures. */}
            <Box padding="spacing.6" height="300px" testID="learning-chart">
              <ChartLineWrapper height="100%" data={weeks.map((w) => ({ week: `W${w}`, off: cell(w, 'off')?.false_alerts ?? 0, baseline: cell(w, 'baseline')?.false_alerts ?? 0, loop: cell(w, 'loop')?.false_alerts ?? 0 }))}>
                <ChartCartesianGrid />
                <ChartXAxis dataKey="week" label="Week" />
                <ChartYAxis />
                <ChartTooltip />
                <ChartLegend />
                <ChartLine type="linear" dataKey="off" name={ARM_TITLE.off} color="data.background.categorical.gray.intense" strokeStyle="dashed" />
                <ChartLine type="linear" dataKey="baseline" name={ARM_TITLE.baseline} color="data.background.categorical.gold.intense" />
                <ChartLine type="linear" dataKey="loop" name={ARM_TITLE.loop} color="data.background.categorical.green.intense" />
              </ChartLineWrapper>
            </Box>
            <Box padding="spacing.6" display="flex" flexDirection="column" gap="spacing.2">
              <Text>{`Over six weeks: ${num(total('off', 'false_alerts'))} false alerts with no tuning, ${num(total('baseline', 'false_alerts'))} with only the weekly baseline, ${num(total('loop', 'false_alerts'))} with tuning.`}</Text>
              <Text>{`Real outages missed: ${num(total('off', 'missed'))} with no tuning, ${num(total('loop', 'missed'))} with tuning. Stricter alerts can miss a weak outage; a missed alert you report makes them looser again.`}</Text>
              <Text size="small" color="surface.text.gray.muted">{replay.data?.note}</Text>
            </Box>
          </>
        )}
      </Panel>
    </Box>
  )
}
