import { resolvePathParams } from '../../../../shared/routePath'
import { RouteTree, RouteTreeNode, RouteTreeRoute } from '../../../../framework/types/routeTree.type'
import type {
  ResolvedRouteMetadata,
  ResolvedRouteMetadataEntry,
} from '../../../chassis/contracts/compiled/compiledFunctions.type'
import { StoredRouteTree, StoredRouteTreeNode, StoredRouteTreeRoute } from '../contracts/routeTree.type'

/**
 * Hydrates the stored route hierarchy for one request: resolves `:param`
 * placeholders to concrete paths, marks the active branch for the current step,
 * and merges the per-request resolved route metadata onto each node by node ID.
 */
export function hydrateRouteTree(
  routeTree: StoredRouteTree,
  currentStepPath: string,
  params: Record<string, string>,
  routeMetadata: ResolvedRouteMetadata,
): RouteTree {
  return routeTree.map(node => toRouteTreeNode(node, currentStepPath, params, routeMetadata))
}

function toRouteTreeNode(
  stored: StoredRouteTreeNode,
  currentStepPath: string,
  params: Record<string, string>,
  routeMetadata: ResolvedRouteMetadata,
): RouteTreeNode {
  const children = stored.children.map(child => toRouteTreeNode(child, currentStepPath, params, routeMetadata))
  const entry = stored.route ? routeMetadata[stored.route.nodeId] : undefined

  return {
    segment: stored.segment,
    path: resolvePathParams(stored.templatePath, params),
    templatePath: stored.templatePath,
    active: stored.templatePath === currentStepPath || children.some(child => child.active),
    metadata: entry?.metadata,
    route: stored.route ? toRouteTreeRoute(stored.route, entry) : undefined,
    children,
  }
}

function toRouteTreeRoute(stored: StoredRouteTreeRoute, entry: ResolvedRouteMetadataEntry | undefined): RouteTreeRoute {
  return {
    kind: stored.kind,
    nodeId: stored.nodeId,
    title: entry?.title,
    description: entry?.description,
    metadata: entry?.metadata,
  }
}
