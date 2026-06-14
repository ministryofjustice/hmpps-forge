import type {
  CompiledIteratorRenderBlock,
  CompiledRenderBlock,
  IteratorRenderBlockGroup,
  RenderPlan,
} from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledRenderResult, IteratorItemScope } from '../../../contracts/compiled/compiledFunctions.type'
import type { RenderCompilationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { RenderBlock } from '../../../../framework/rendering/types'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsync, measureAsyncFrom } from '../trace/TraceRecorder'

/**
 * Runs a RenderPlan to produce one step's render output. The step/ancestor
 * metadata functions and all static and iterator block renderers run
 * concurrently; iterator blocks (each of which may yield arrays) are flattened
 * into a single ordered RenderBlock[], with static blocks placed before iterator
 * blocks. Absent metadata functions default to an empty step bag and no
 * ancestors. When a trace recorder is supplied, records one decision per block
 * evaluation and iterator expansion.
 */
export async function evaluateRender(
  plan: RenderPlan,
  ctx: RenderCompilationContext,
  trace?: TraceRecorder,
): Promise<CompiledRenderResult> {
  const [step, ancestors, staticBlocks, iteratorBlocks] = await Promise.all([
    plan.compiledStepMetadata?.(ctx) ?? {},
    plan.compiledAncestorMetadata?.(ctx) ?? [],
    Promise.all(plan.renderBlocks.map(entry => evaluateStaticBlock(entry, ctx, trace))),
    evaluateIteratorGroups(plan.iteratorRenderBlockGroups, ctx, trace),
  ])

  return {
    blocks: [...staticBlocks, ...iteratorBlocks],
    step,
    ancestors,
  }
}

/**
 * Evaluates one plain block's compiled render function, recording the
 * evaluation against the entry's identity.
 */
async function evaluateStaticBlock(
  entry: CompiledRenderBlock,
  ctx: RenderCompilationContext,
  trace: TraceRecorder | undefined,
): Promise<RenderBlock> {
  return measureAsync(trace, { kind: 'block-evaluation', nodeId: entry.nodeId, variant: entry.variant }, () =>
    entry.render(ctx),
  )
}

/**
 * Renders every iterator group concurrently and flattens their per-group block
 * arrays into one list. Returns an empty array when there are no groups.
 */
async function evaluateIteratorGroups(
  groups: readonly IteratorRenderBlockGroup[],
  ctx: RenderCompilationContext,
  trace: TraceRecorder | undefined,
): Promise<RenderBlock[]> {
  if (groups.length === 0) {
    return []
  }

  const results = await Promise.all(groups.map(group => evaluateSingleIteratorGroup(group, ctx, trace)))

  return results.flat()
}

/**
 * Expands one MAP iterator's collection into item scopes and renders every block
 * once per scope, concurrently. Each block may yield a single RenderBlock or an
 * array (e.g. a nested iterator level), so results are flattened. Records the
 * expansion's item count and one evaluation per block per item. Returns an
 * empty array when the collection expands to no items.
 */
async function evaluateSingleIteratorGroup(
  group: IteratorRenderBlockGroup,
  ctx: RenderCompilationContext,
  trace: TraceRecorder | undefined,
): Promise<RenderBlock[]> {
  const items = await measureAsyncFrom(
    trace,
    i => ({ kind: 'iterator-input', nodeId: group.nodeId, itemCount: i.length }),
    () => group.evaluateInput(ctx),
  )

  if (items.length === 0) {
    return []
  }

  const results = await Promise.all(
    items.flatMap(itemScope => group.blocks.map(block => evaluateIteratorBlock(block, ctx, itemScope, trace))),
  )

  return results.flat()
}

/**
 * Evaluates one iterator block's compiled render function for one item scope,
 * recording the evaluation with the item index so per-item decisions stay
 * distinguishable. One evaluation may yield several blocks (a nested iterator
 * level); it is still one recorded decision.
 */
async function evaluateIteratorBlock(
  block: CompiledIteratorRenderBlock,
  ctx: RenderCompilationContext,
  itemScope: IteratorItemScope,
  trace: TraceRecorder | undefined,
): Promise<RenderBlock | RenderBlock[]> {
  return measureAsync(
    trace,
    { kind: 'block-evaluation', nodeId: block.nodeId, variant: block.variant, itemIndex: itemScope.index },
    () => block.render(ctx, itemScope),
  )
}
