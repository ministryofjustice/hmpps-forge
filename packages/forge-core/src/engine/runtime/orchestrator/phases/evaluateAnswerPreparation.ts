import type {
  AnswerPreparationPlan,
  IteratorAnswerPreparationGroup,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import { buildCompiledAnswerPreparationContext } from '../../context/compiledEvaluationContext'

/**
 * Runs the answer-preparation phase: builds the compiled answer-preparation
 * context from the request, then invokes every per-field prepare function and
 * every iterator-group prepare function. Each prepare formats one field's
 * submitted or default answer and mutates `ctx.answers` in place, so all later
 * phases (hooks, validation, render) observe the same answer history.
 *
 * Plain fields are prepared concurrently and awaited before the iterator groups
 * run. Within each batch ordering is not guaranteed, since each prepare writes
 * only its own field's answer.
 */
export async function evaluateAnswerPreparation(
  plan: AnswerPreparationPlan,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
): Promise<void> {
  const ctx = buildCompiledAnswerPreparationContext(context, functionRegistry)

  await Promise.all(plan.fields.map(entry => entry.prepare(ctx)))
  await evaluateIteratorGroups(plan.iteratorGroups, ctx)
}

/**
 * Prepares answers for every iterator group concurrently. Short-circuits when
 * there are no groups to avoid spinning up an empty Promise.all.
 */
async function evaluateIteratorGroups(
  groups: readonly IteratorAnswerPreparationGroup[],
  ctx: AnswerPreparationContext,
): Promise<void> {
  if (groups.length === 0) {
    return
  }

  await Promise.all(groups.map(group => evaluateSingleIteratorGroup(group, ctx)))
}

/**
 * Expands the group's collection into per-item scopes via `evaluateInput`, then
 * runs each field's prepare once per item scope, mutating `ctx.answers` in
 * place. An empty collection yields no work.
 */
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
