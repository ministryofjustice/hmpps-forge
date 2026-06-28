import { resolvePathParams } from '../../../../../framework/path/routePath'
import { RouteTree, RouteTreeNode, RouteTreeRoute } from '../../../../../framework/rendering/types'
import {
  StoredRouteTree,
  StoredRouteTreeNode,
  StoredRouteTreeRoute,
} from '../../../../contracts/routing/routeTree.type'

/**
 * Hydrates the stored route hierarchy for one request: resolves `:param`
 * placeholders to concrete paths and marks the active branch for the current step.
 */
export function hydrateRouteTree(
  routeTree: StoredRouteTree,
  currentStepPath: string,
  params: Record<string, string>,
): RouteTree {
  return routeTree.map(node => toRouteTreeNode(node, currentStepPath, params))
}

function toRouteTreeNode(
  stored: StoredRouteTreeNode,
  currentStepPath: string,
  params: Record<string, string>,
): RouteTreeNode {
  const children = stored.children.map(child => toRouteTreeNode(child, currentStepPath, params))

  return {
    segment: stored.segment,
    path: resolvePathParams(stored.templatePath, params),
    templatePath: stored.templatePath,
    active: stored.templatePath === currentStepPath || children.some(child => child.active),
    metadata: stored.metadata,
    route: stored.route ? toRouteTreeRoute(stored.route) : undefined,
    children,
  }
}

function toRouteTreeRoute(stored: StoredRouteTreeRoute): RouteTreeRoute {
  return {
    title: stored.title,
    description: stored.description,
    kind: stored.kind,
    nodeId: stored.nodeId,
    metadata: stored.metadata,
  }
}
