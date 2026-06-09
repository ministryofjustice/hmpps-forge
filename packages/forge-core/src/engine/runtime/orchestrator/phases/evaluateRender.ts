import type { IteratorRenderBlockGroup, RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledRenderResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { RenderCompilationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { RenderBlock } from '../../../../framework/rendering/types'

/**
 * Runs a RenderPlan to produce one step's render output. The step/ancestor
 * metadata functions and all static and iterator block renderers run
 * concurrently; iterator blocks (each of which may yield arrays) are flattened
 * into a single ordered RenderBlock[], with static blocks placed before iterator
 * blocks. Absent metadata functions default to an empty step bag and no
 * ancestors.
 */
export async function evaluateRender(plan: RenderPlan, ctx: RenderCompilationContext): Promise<CompiledRenderResult> {
  const [step, ancestors, staticBlocks, iteratorBlocks] = await Promise.all([
    plan.compiledStepMetadata?.(ctx) ?? {},
    plan.compiledAncestorMetadata?.(ctx) ?? [],
    Promise.all(plan.blocks.map(entry => entry.render(ctx))),
    evaluateIteratorGroups(plan.iteratorGroups, ctx),
  ])

  return {
    blocks: [...staticBlocks, ...iteratorBlocks],
    step,
    ancestors,
  }
}

/**
 * Renders every iterator group concurrently and flattens their per-group block
 * arrays into one list. Returns an empty array when there are no groups.
 */
async function evaluateIteratorGroups(
  groups: readonly IteratorRenderBlockGroup[],
  ctx: RenderCompilationContext,
): Promise<RenderBlock[]> {
  if (groups.length === 0) {
    return []
  }

  const results = await Promise.all(groups.map(group => evaluateSingleIteratorGroup(group, ctx)))

  return results.flat()
}

/**
 * Expands one MAP iterator's collection into item scopes and renders every block
 * once per scope, concurrently. Each block may yield a single RenderBlock or an
 * array (e.g. a nested iterator level), so results are flattened. Returns an
 * empty array when the collection expands to no items.
 */
async function evaluateSingleIteratorGroup(
  group: IteratorRenderBlockGroup,
  ctx: RenderCompilationContext,
): Promise<RenderBlock[]> {
  const items = await group.evaluateInput(ctx)

  if (items.length === 0) {
    return []
  }

  const results = await Promise.all(items.flatMap(itemScope => group.blocks.map(block => block.render(ctx, itemScope))))

  return results.flat()
}
