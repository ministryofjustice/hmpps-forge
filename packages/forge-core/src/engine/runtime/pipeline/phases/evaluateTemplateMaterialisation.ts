import type {
  CompiledTemplateMaterialisationRoot,
  MaterialisedTemplateNode,
  TemplateMaterialisationPlan,
} from '../../../contracts/plans/materialisationArtefacts.type'
import type { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'
import type TraceRecorder from '../trace/TraceRecorder'
import { measureAsyncFrom } from '../trace/TraceRecorder'

export async function evaluateTemplateMaterialisation(
  plan: TemplateMaterialisationPlan,
  ctx: BasePhaseContext,
  trace?: TraceRecorder,
): Promise<MaterialisedTemplateNode[]> {
  const allNodes: MaterialisedTemplateNode[] = []

  for (const root of plan.roots) {
    const nodes = await materialiseRoot(root, ctx, trace)

    allNodes.push(...nodes)
  }

  return allNodes
}

async function materialiseRoot(
  root: CompiledTemplateMaterialisationRoot,
  ctx: BasePhaseContext,
  trace: TraceRecorder | undefined,
): Promise<MaterialisedTemplateNode[]> {
  return measureAsyncFrom(
    trace,
    nodes => ({
      kind: 'template-materialisation',
      nodeId: root.nodeId,
      itemCount: countDistinctItems(nodes),
      nodeCount: nodes.length,
    }),
    () => root.materialise(ctx, root.templateFunctions),
  )
}

function countDistinctItems(nodes: MaterialisedTemplateNode[]): number {
  const seen = new Set<number>()

  nodes.forEach(node => seen.add(node.origin.itemIndex))

  return seen.size
}
