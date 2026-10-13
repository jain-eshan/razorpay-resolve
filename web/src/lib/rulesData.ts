import type { Schemas } from './api'

type Metric = Schemas['EvalMetric']
// How many messages a figure is out of, as the report says it ("Both issues of 5 two-in-one messages").
const outOf = (m?: Metric) => Number(m?.target.match(/Only the (\d+) tagged/)?.[1] ?? m?.target.match(/of (?:the )?(\d+)/)?.[1] ?? 0)

// What "Why an AI agent" needs from the eval report, or nothing when the report has no messy-complaints run (the page then leaves the section out).
export type RulesData = { total: number; wrong: number; twoN: number; partial: number; twoBoth: number; misses: string[][] }
export function rulesData(metrics: Metric[]): RulesData | null {
  const by = (n: string) => metrics.find((m) => m.name === n)
  const total = by('messy_complaints_total')?.value
  const overall = by('messy_main_claim_found')?.value
  if (!total || overall == null) return null
  const two = by('messy_both_issues_found')
  const twoN = outOf(two)
  const twoBoth = Math.round((two?.value ?? 0) * twoN)
  // Read right as the main problem but with the second one missed: not among the misreads, so counted on their own.
  const twoMain = by('messy_main_claim_found_two_issues')?.value
  const partial = Math.max(0, (twoMain == null ? twoN : Math.round(twoMain * twoN)) - twoBoth)
  const misses = [1, 2, 3].map((i) => by(`messy_miss_${i}`)?.target.split(' | ')).filter((x): x is string[] => !!x && x.length === 4)
  return { total, wrong: Math.round(total * (1 - overall)), twoN, partial, twoBoth, misses }
}
