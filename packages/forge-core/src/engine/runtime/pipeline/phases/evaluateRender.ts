import type { CompiledRenderBlock, RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type {
  CompiledRenderResult,
  EvaluateChildFunction,
  IteratorItemScope,
} from '../../../contracts/compiled/compiledFunctions.type'
import type { MaterialisedTemplateNode } from '../../../contracts/plans/materialisationArtefacts.type'
import type { RenderCompilationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { RenderBlock } from '../../../../framework/rendering/types'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsyncFrom } from '../trace/TraceRecorder'

/**
 * Runs a RenderPlan to produce one step's render output. Materialised template
 * nodes are rendered first and grouped by iterator node ID; the grouped results
 * are attached to the render context so static block compiled code can look them
 * up via `ctx.materialisedBlocks.get(iteratorNodeId)`. Static blocks then run
 * with the enriched context — their property-value MAP iterators read the
 * pre-rendered materialised blocks instead of inline-rendering.
 */
export async function evaluateRender(
  plan: RenderPlan,
  ctx: RenderCompilationContext,
  trace?: TraceRecorder,
  materialisedNodes?: MaterialisedTemplateNode[],
): Promise<CompiledRenderResult> {
  const materialisedBlocksByIterator = await renderAndGroupMaterialisedBlocks(materialisedNodes ?? [], plan, ctx, trace)

  const enrichedCtx: RenderCompilationContext =
    materialisedBlocksByIterator.size > 0 ? { ...ctx, materialisedBlocks: materialisedBlocksByIterator } : ctx

  const [step, ancestors, staticBlocks] = await Promise.all([
    plan.compiledStepMetadata?.(enrichedCtx) ?? {},
    plan.compiledAncestorMetadata?.(enrichedCtx) ?? [],
    Promise.all(plan.renderBlocks.map(entry => evaluateStaticBlock(entry, plan, enrichedCtx, trace))),
  ])

  return {
    blocks: staticBlocks,
    materialisedBlocks: materialisedBlocksByIterator,
    step,
    ancestors,
  }
}

/**
 * Evaluates one plain block's compiled render function, recording the
 * evaluation against the entry's identity. Nested child blocks are traced as
 * scoped child units within the parent.
 */
async function evaluateStaticBlock(
  entry: CompiledRenderBlock,
  plan: RenderPlan,
  ctx: RenderCompilationContext,
  trace: TraceRecorder | undefined,
): Promise<RenderBlock> {
  const evaluateChild = createEvaluateChild(plan, ctx, undefined, trace)

  return measureAsyncFrom(
    trace,
    block => ({ kind: 'block-evaluation', nodeId: entry.nodeId, variant: entry.variant, properties: block.properties }),
    () => entry.render(ctx, evaluateChild),
  )
}

/**
 * Renders all materialised template nodes that carry a render closure and
 * groups the resulting RenderBlocks by iterator node ID. Nodes without a
 * render closure are skipped (they belong to non-render phases only).
 * Ordering is preserved: the materialiser produces nodes in collection order.
 */
async function renderAndGroupMaterialisedBlocks(
  nodes: MaterialisedTemplateNode[],
  plan: RenderPlan,
  ctx: RenderCompilationContext,
  trace: TraceRecorder | undefined,
): Promise<ReadonlyMap<string, RenderBlock[]>> {
  const grouped = new Map<string, RenderBlock[]>()

  for (const node of nodes) {
    if (node.render === undefined) {
      continue
    }

    const evaluateChild = createEvaluateChild(plan, ctx, undefined, trace)

    const block = await measureAsyncFrom(
      trace,
      b => ({
        kind: 'block-evaluation',
        nodeId: node.sourceNodeId,
        itemIndex: node.origin.itemIndex,
        properties: b.properties,
      }),
      () => node.render!(ctx, evaluateChild),
    )

    const iteratorId = node.origin.iteratorNodeId
    const list = grouped.get(iteratorId)

    if (list !== undefined) {
      list.push(block)
    } else {
      grouped.set(iteratorId, [block])
    }
  }

  return grouped
}

/**
 * Creates the evaluateChild callback that a compiled block function calls to
 * delegate nested child block evaluation. The callback looks up the child in
 * the plan's nestedBlocks map, calls its compiled function, and traces it as
 * a scoped child unit.
 *
 * When the parent passes additionalScopes (from an inline iterator loop), the
 * runtime appends them to the parent's scope stack so the child receives its
 * full iterator context.
 */
function createEvaluateChild(
  plan: RenderPlan,
  ctx: RenderCompilationContext,
  scopeStack: readonly IteratorItemScope[] | undefined,
  trace: TraceRecorder | undefined,
): EvaluateChildFunction {
  return (childId: string, additionalScopes?: IteratorItemScope[]): Promise<RenderBlock> => {
    const child = plan.nestedBlocks.get(childId)

    if (child === undefined) {
      throw new Error(`Nested block "${childId}" not found in render plan`)
    }

    const childScopeStack = additionalScopes ? [...(scopeStack ?? []), ...additionalScopes] : scopeStack

    const childEvaluateChild = createEvaluateChild(plan, ctx, childScopeStack, trace)

    return measureAsyncFrom(
      trace,
      block => ({
        kind: 'block-evaluation',
        nodeId: child.nodeId,
        variant: child.variant,
        properties: block.properties,
      }),
      () => child.render(ctx, childScopeStack, childEvaluateChild),
    )
  }
}
