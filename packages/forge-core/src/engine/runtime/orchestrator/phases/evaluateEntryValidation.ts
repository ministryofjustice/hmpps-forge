import type { EntryValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'

/**
 * Selects which validation groups apply when a step is entered via GET by evaluating
 * each rule's predicate against the request context. A rule with no `evaluate` predicate
 * is always active. Predicates run concurrently (rule order is not a precedence concern),
 * but the returned group identifiers are de-duplicated while preserving the order in which
 * active rules first contribute them.
 */
export async function evaluateEntryValidation(plan: EntryValidationPlan, ctx: BasePhaseContext): Promise<string[]> {
  const seen = new Set<string>()
  const groups: string[] = []

  await Promise.all(
    plan.rules.map(async rule => {
      const active = rule.evaluate ? await rule.evaluate(ctx) : true

      if (active) {
        rule.groups.forEach(group => {
          if (!seen.has(group)) {
            seen.add(group)
            groups.push(group)
          }
        })
      }
    }),
  )

  return groups
}
