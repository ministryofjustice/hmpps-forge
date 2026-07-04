import type { JourneyASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import type { RouteMetadataCompilationInputs } from '../../../contracts/plans/compilationPlan.type'

/**
 * Collects the authored route metadata (title/description/metadata) from a step or
 * journey node. Steps and journeys carry the same metadata shape, so a single
 * analyzer serves both — the package-level route-metadata function later lowers
 * every collected entry into one compiled function.
 */
export default class RouteMetadataInputAnalyzer {
  buildInputs(node: StepASTNode | JourneyASTNode): RouteMetadataCompilationInputs {
    return {
      nodeId: node.id,
      title: node.properties.title,
      description: node.properties.description,
      metadata: node.properties.metadata,
    }
  }
}
