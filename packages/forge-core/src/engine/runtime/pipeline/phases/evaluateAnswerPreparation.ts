import type {
  AnswerPreparationPlan,
  CompiledFieldAnswerPreparation,
  IteratorAnswerPreparationGroup,
  CompiledIteratorFieldAnswerPreparation,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { IteratorItemScope } from '../../../contracts/compiled/compiledFunctions.type'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsync, measureAsyncFrom } from '../trace/TraceRecorder'

/**
 * Runs the answer-preparation walk: invokes every per-field prepare function
 * and every iterator-group prepare function against the supplied compiled
 * context. Each prepare formats one field's submitted or default answer and
 * mutates `ctx.answers` in place, so all later phases (hooks, validation,
 * render) observe the same answer history.
 *
 * Everything runs sequentially in plan (declared) order: a later field's
 * defaultValue or dependentWhen may read an earlier field's answer, so
 * preparing concurrently would race on the shared answer history. When a trace
 * recorder is supplied, one decision is recorded per prepare plus each iterator
 * expansion's item count.
 */
export async function evaluateAnswerPreparation(
  plan: AnswerPreparationPlan,
  ctx: AnswerPreparationContext,
  trace?: TraceRecorder,
): Promise<void> {
  for (const entry of plan.fieldAnswerPreparations) {
    await prepareField(entry, ctx, trace)
  }

  for (const group of plan.iteratorAnswerPreparationGroups) {
    await evaluateSingleIteratorGroup(group, ctx, trace)
  }
}

/**
 * Prepares one plain field, recording the prepare against the entry's identity.
 */
async function prepareField(
  entry: CompiledFieldAnswerPreparation,
  ctx: AnswerPreparationContext,
  trace: TraceRecorder | undefined,
): Promise<void> {
  await measureAsync(trace, { kind: 'answer-preparation-field', nodeId: entry.nodeId }, () => entry.prepare(ctx))
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
  const items = await measureAsyncFrom(
    trace,
    i => ({ kind: 'iterator-input', nodeId: group.nodeId, itemCount: i.length }),
    () => group.evaluateInput(ctx),
  )

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
  field: CompiledIteratorFieldAnswerPreparation,
  ctx: AnswerPreparationContext,
  itemScope: IteratorItemScope,
  trace: TraceRecorder | undefined,
): Promise<void> {
  await measureAsync(
    trace,
    { kind: 'answer-preparation-field', nodeId: field.nodeId, itemIndex: itemScope.index },
    () => field.prepare(ctx, itemScope),
  )
}
