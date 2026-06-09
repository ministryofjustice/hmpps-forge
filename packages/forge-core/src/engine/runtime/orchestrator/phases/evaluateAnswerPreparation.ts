import type {
  AnswerPreparationPlan,
  FieldAnswerPreparationEntry,
  IteratorAnswerPreparationGroup,
  IteratorFieldAnswerPreparationEntry,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { IteratorItemScope } from '../../../contracts/compiled/compiledFunctions.type'
import type FunctionRegistry from '../../../registries/FunctionRegistry'
import type RuntimeEvaluationContext from '../../context/RuntimeEvaluationContext'
import { buildCompiledAnswerPreparationContext } from '../../context/compiledEvaluationContext'
import type TraceRecorder from '../trace/TraceRecorder'

/**
 * Runs the answer-preparation phase: builds the compiled answer-preparation
 * context from the request, then invokes every per-field prepare function and
 * every iterator-group prepare function. Each prepare formats one field's
 * submitted or default answer and mutates `ctx.answers` in place, so all later
 * phases (hooks, validation, render) observe the same answer history.
 *
 * Everything runs sequentially in plan (declared) order: a later field's
 * defaultValue or dependentWhen may read an earlier field's answer, so
 * preparing concurrently would race on the shared answer history. When a trace
 * recorder is supplied, one decision is recorded per prepare plus each iterator
 * expansion's item count.
 */
export async function evaluateAnswerPreparation(
  plan: AnswerPreparationPlan,
  context: RuntimeEvaluationContext,
  functionRegistry: FunctionRegistry,
  trace?: TraceRecorder,
): Promise<void> {
  const ctx = buildCompiledAnswerPreparationContext(context, functionRegistry)

  for (const entry of plan.fields) {
    await prepareField(entry, ctx, trace)
  }

  for (const group of plan.iteratorGroups) {
    await evaluateSingleIteratorGroup(group, ctx, trace)
  }
}

/**
 * Prepares one plain field, recording the prepare against the entry's identity.
 */
async function prepareField(
  entry: FieldAnswerPreparationEntry,
  ctx: AnswerPreparationContext,
  trace: TraceRecorder | undefined,
): Promise<void> {
  const startedAt = performance.now()

  await entry.prepare(ctx)

  trace?.record({
    kind: 'answer-preparation',
    nodeId: entry.nodeId,
    durationMs: performance.now() - startedAt,
  })
}

/**
 * Expands the group's collection into per-item scopes via `evaluateInput`,
 * recording the item count, then prepares each item's fields in declared order,
 * one at a time — iterator fields read and mutate the same shared answer
 * history as plain fields. An empty collection yields no work.
 */
async function evaluateSingleIteratorGroup(
  group: IteratorAnswerPreparationGroup,
  ctx: AnswerPreparationContext,
  trace: TraceRecorder | undefined,
): Promise<void> {
  const inputStartedAt = performance.now()
  const items = await group.evaluateInput(ctx)

  trace?.record({
    kind: 'iterator-input',
    nodeId: group.nodeId,
    itemCount: items.length,
    durationMs: performance.now() - inputStartedAt,
  })

  for (const itemScope of items) {
    for (const field of group.fields) {
      await prepareIteratorField(field, ctx, itemScope, trace)
    }
  }
}

/**
 * Prepares one iterator field for one item scope, recording the prepare with
 * the item index so per-item decisions stay distinguishable.
 */
async function prepareIteratorField(
  field: IteratorFieldAnswerPreparationEntry,
  ctx: AnswerPreparationContext,
  itemScope: IteratorItemScope,
  trace: TraceRecorder | undefined,
): Promise<void> {
  const startedAt = performance.now()

  await field.prepare(ctx, itemScope)

  trace?.record({
    kind: 'answer-preparation',
    nodeId: field.nodeId,
    itemIndex: itemScope.index,
    durationMs: performance.now() - startedAt,
  })
}
