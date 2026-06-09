import type {
  AnswerPreparationPlan,
  IteratorAnswerPreparationGroup,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import { buildCompiledAnswerPreparationContext } from '../../context/compiledEvaluationContext'

export async function evaluateAnswerPreparation(
  plan: AnswerPreparationPlan,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
): Promise<void> {
  const ctx = buildCompiledAnswerPreparationContext(context, functionRegistry)

  await Promise.all(plan.fields.map(entry => entry.prepare(ctx)))
  await evaluateIteratorGroups(plan.iteratorGroups, ctx)
}

async function evaluateIteratorGroups(
  groups: readonly IteratorAnswerPreparationGroup[],
  ctx: AnswerPreparationContext,
): Promise<void> {
  if (groups.length === 0) {
    return
  }

  await Promise.all(groups.map(group => evaluateSingleIteratorGroup(group, ctx)))
}

async function evaluateSingleIteratorGroup(
  group: IteratorAnswerPreparationGroup,
  ctx: AnswerPreparationContext,
): Promise<void> {
  const items = await group.evaluateInput(ctx)

  if (items.length === 0) {
    return
  }

  await Promise.all(items.flatMap(itemScope => group.fields.map(field => field.prepare(ctx, itemScope))))
}
