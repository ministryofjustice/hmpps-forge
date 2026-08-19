import type { JourneyASTNode, StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { JourneyRouteIndex, StepRouteIndex } from '../contracts/routeDescriptors.type'

/**
 * Builds the static route indexes for a compiled package: one descriptor per
 * step and journey, keyed by NodeId, carrying the authored path and the chain
 * of ancestor journey IDs derived from AST `parent` links. The mount registry
 * later joins these against the compiled artifacts to mount URLs.
 */
export default class RouteIndexBuilder {
  buildJourneyRouteIndex(journeyNodes: JourneyASTNode[]): JourneyRouteIndex {
    return new Map(
      journeyNodes.map(node => [
        node.id,
        {
          nodeId: node.id,
          path: node.properties.path,
          ancestorJourneyIds: this.ancestorJourneyIds(node),
        },
      ]),
    )
  }

  buildStepRouteIndex(stepNodes: StepASTNode[]): StepRouteIndex {
    return new Map(
      stepNodes.map(node => [
        node.id,
        {
          nodeId: node.id,
          path: node.properties.path,
          ancestorJourneyIds: this.ancestorJourneyIds(node.parent),
        },
      ]),
    )
  }

  /** Journey NodeIds from the outermost ancestor down, walking `parent` from `start`. */
  private ancestorJourneyIds(start: ASTNode | undefined): NodeId[] {
    const ids: NodeId[] = []
    let current = start

    while (current !== undefined) {
      ids.push(current.id)
      current = current.parent
    }

    ids.reverse()

    return ids
  }
}
