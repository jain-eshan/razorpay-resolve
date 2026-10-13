import { rupees, useGet, type Schemas } from './api'

export type Stat = { value: string; label: string }

type Incident = Schemas['IncidentSummary'] & { would_have_alerted_at?: string | null; onset_at?: string | null }
type Metric = { name: string; value: number; status: string }

const minutes = (a?: string | null, b?: string | null) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 60000) : undefined)
const num = (n: number) => n.toLocaleString('en-IN')

// The figures on a guide's hero slide. Each one is read from the same endpoints the screens use, so it moves when the data does.
// A guide with no fitting figure returns nothing and the row is left out. Hooks are called in the same order every time; a path of null fetches nothing.
export function useGuideStats(id: string): Stat[] | undefined {
  const needs = (...ids: string[]) => ids.includes(id)
  const incidents = useGet<Incident[]>(needs('blindspot', 'incidents') ? '/api/incidents' : null)
  const evalReport = useGet<{ metrics: Metric[] }>(needs('conversations', 'how') ? '/api/eval/report' : null)
  const scan = useGet<Schemas['ScanResult']>(needs('scan') ? '/api/scan/day0' : null)
  const replay = useGet<Schemas['LearningReplay']>(needs('learning') ? '/api/learning/replay' : null)
  const settings = useGet<Schemas['Settings']>(needs('autonomy') ? '/api/settings' : null)
  const access = useGet<Schemas['LeakageReport']>(needs('access') ? '/api/leakage' : null)

  const metric = (name: string) => evalReport.data?.metrics.find((m) => m.name === name)?.value

  if (id === 'access' && access.data) {
    return [
      { value: num(access.data.customers), label: 'customers past your grace period, still with access' },
      { value: rupees(access.data.owed_paise), label: 'in renewals not paid' },
      { value: `${access.data.grace_hours} hours`, label: 'your grace period' },
    ]
  }
  if (id === 'blindspot' && incidents.data) {
    const hero = incidents.data.find((i) => i.id === 'INC-1')
    const mins = minutes(hero?.onset_at, hero?.would_have_alerted_at)
    if (!hero) return undefined
    return [
      { value: num(hero.affected), label: 'customers paid and got nothing in the biggest payment issue' },
      { value: num(hero.silent), label: 'of them never wrote in' },
      ...(mins === undefined ? [] : [{ value: `${mins} min`, label: 'from the release to the first alert' }]),
    ]
  }
  if (id === 'incidents' && incidents.data) {
    const largest = incidents.data.reduce((a, b) => (b.at_risk_paise > a.at_risk_paise ? b : a))
    const noPayment = incidents.data.filter((i) => i.inferred).length
    return [
      { value: rupees(largest.at_risk_paise), label: 'involved in the biggest payment issue' },
      ...(largest.complained ? [{ value: `${Math.round(largest.silent / largest.complained)}x`, label: 'as many customers stayed quiet as wrote in' }] : []),
      { value: String(noPayment), label: 'issues where customers never reached a payment' },
    ]
  }
  if (id === 'conversations' && evalReport.data) {
    const never = metric('never_ask_violations_in_agent_replies')
    const inj = metric('prompt_injection_threads_ignored')
    const wrong = metric('customers_shown_a_payment_that_is_not_theirs')
    if (never === undefined || inj === undefined || wrong === undefined) return undefined
    return [
      { value: String(never), label: 'requests for an OTP, PIN or card number' },
      { value: `${inj} of ${inj}`, label: 'attempts to give it instructions were ignored' },
      { value: String(wrong), label: 'payments shown to the wrong customer' },
    ]
  }
  if (id === 'scan' && scan.data) {
    return [
      { value: num(scan.data.leaked_customers), label: 'customers paid and did not get access' },
      { value: rupees(scan.data.leaked_paise), label: 'paid by those customers' },
    ]
  }
  if (id === 'autonomy' && settings.data) {
    return [
      { value: num(settings.data.max_bulk_customers), label: 'customers at most in one action' },
      { value: `${settings.data.holdout_percent}%`, label: 'of payment links held back to measure what they add' },
    ]
  }
  if (id === 'learning' && replay.data) {
    const total = (arm: string) => replay.data!.rows.filter((r) => r.arm === arm).reduce((a, r) => a + r.false_alerts, 0)
    const off = total('off')
    const loop = total('loop')
    return [
      { value: off.toFixed(1), label: 'false alerts over six weeks with no tuning' },
      { value: loop.toFixed(1), label: 'false alerts with the weekly review' },
      { value: '1', label: 'change per setting, per week' },
    ]
  }
  if (id === 'how' && evalReport.data) {
    const ms = evalReport.data.metrics
    return [
      { value: String(ms.filter((m) => m.status === 'pass').length), label: 'checks pass' },
      { value: String(ms.filter((m) => m.status === 'fail').length), label: 'checks fail' },
      { value: String(ms.filter((m) => m.status === 'report').length), label: 'figures reported, not graded' },
    ]
  }
  return undefined
}
