import type { IteratorRenderBlockGroup, RenderPlan } from '../../../contracts/plans/compilationArtefacts.type'
import type { CompiledRenderResult } from '../../../contracts/compiled/compiledFunctions.type'
import type { RenderCompilationContext } from '../../../contracts/compiled/phaseContexts.type'
import type { RenderBlock } from '../../../../framework/rendering/types'

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

async function evaluateSingleIteratorGroup(
  group: IteratorRenderBlockGroup,
  ctx: RenderCompilationContext,
): Promise<RenderBlock[]> {
  const items = await group.evaluateInput(ctx)

  if (items.length === 0) {
    return []
  }

  return Promise.all(items.flatMap(itemScope => group.blocks.map(block => block.render(ctx, itemScope))))
}
