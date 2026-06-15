import type {
  AnswerPreparationPlan,
  CompiledFieldAnswerPreparation,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { MaterialisedTemplateNode } from '../../../contracts/plans/materialisationArtefacts.type'
import type { AnswerPreparationContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsync } from '../trace/TraceRecorder'
import { evaluateTemplateMaterialisation } from './evaluateTemplateMaterialisation'

/**
 * Runs the answer-preparation walk: invokes every per-field prepare function
 * and every materialised node's prepare function against the supplied compiled
 * context. Each prepare formats one field's submitted or default answer and
 * mutates `ctx.answers` in place, so all later phases (hooks, validation,
 * render) observe the same answer history.
 *
 * Everything runs sequentially in plan (declared) order: a later field's
 * defaultValue or dependentWhen may read an earlier field's answer, so
 * preparing concurrently would race on the shared answer history. When a trace
 * recorder is supplied, one decision is recorded per prepare.
 */
export async function evaluateAnswerPreparation(
  plan: AnswerPreparationPlan,
  ctx: AnswerPreparationContext,
  trace?: TraceRecorder,
): Promise<MaterialisedTemplateNode[]> {
  const materialisedNodes: MaterialisedTemplateNode[] = []

  for (const item of plan.items) {
    if (item.kind === 'field') {
      await prepareField(item.entry, ctx, trace)

      continue
    }

    const nodes = await evaluateTemplateMaterialisation({ roots: [item.root] }, ctx, trace)

    materialisedNodes.push(...nodes)
    await evaluateMaterialisedPreparations(nodes, ctx, trace)
  }

  return materialisedNodes
}

/**
 * Prepares materialised template nodes sequentially by calling each node's
 * scope-bound prepare closure directly. Nodes without a prepare function are
 * skipped. Sequential order is critical: later fields may read earlier fields'
 * answers.
 */
async function evaluateMaterialisedPreparations(
  nodes: MaterialisedTemplateNode[],
  ctx: AnswerPreparationContext,
  trace: TraceRecorder | undefined,
): Promise<void> {
  for (const node of nodes) {
    if (node.prepare === undefined) {
      continue
    }

    await measureAsync(
      trace,
      { kind: 'answer-preparation-field', nodeId: node.sourceNodeId, itemIndex: node.origin.itemIndex },
      () => node.prepare!(ctx),
    )
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
