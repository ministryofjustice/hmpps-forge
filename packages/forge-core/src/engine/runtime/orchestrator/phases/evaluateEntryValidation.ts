import type { EntryValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * Selects which validation groups apply when a step is entered via GET by evaluating
 * each rule's predicate against the request context. A rule with no `evaluate` predicate
 * is always active. Predicates are read-only so they run concurrently, but verdicts are
 * folded in declared rule order: group identifiers are de-duplicated preserving the order
 * in which active rules declare them, and when a trace recorder is supplied one decision
 * is recorded per rule — active or not — with the groups the rule contributes.
 */
export async function evaluateEntryValidation(
  plan: EntryValidationPlan,
  ctx: BasePhaseContext,
  trace?: TraceRecorder,
): Promise<string[]> {
  const verdicts = await Promise.all(
    plan.entryValidationRules.map(async rule => {
      const startedAt = performance.now()
      const active = rule.evaluate ? await rule.evaluate(ctx) : true

      return { rule, active, durationMs: performance.now() - startedAt }
    }),
  )

  const seen = new Set<string>()
  const groups: string[] = []

  verdicts.forEach(({ rule, active, durationMs }) => {
    trace?.record({
      kind: 'entry-validation-rule',
      nodeId: rule.nodeId,
      active,
      groups: rule.groups,
      durationMs,
    })

    if (!active) {
      return
    }

    rule.groups.forEach(group => {
      if (!seen.has(group)) {
        seen.add(group)
        groups.push(group)
      }
    })
  })

  return groups
}
