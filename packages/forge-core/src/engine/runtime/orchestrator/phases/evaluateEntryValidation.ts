import type { EntryValidationPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'

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
