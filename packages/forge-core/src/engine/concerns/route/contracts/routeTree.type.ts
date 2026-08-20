import { NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { RouteTreeRouteKind } from '../../../../framework/types/routeTree.type'

export interface JourneyRouteTemplateCatalog {
  routeTemplatePathByStepId: Map<NodeId, string>
  stepIdByRouteTemplatePath: Map<string, NodeId>
}

export interface StoredRouteTreeRoute {
  kind: RouteTreeRouteKind
  nodeId: NodeId
}

export interface StoredRouteTreeNode {
  segment: string
  templatePath: string
  route?: StoredRouteTreeRoute
  children: StoredRouteTreeNode[]
}

export type StoredRouteTree = StoredRouteTreeNode[]

export interface RouteTreeIndex {
  roots: StoredRouteTree
  nodesByTemplatePath: Map<string, StoredRouteTreeNode>
  journeyNodesById: Map<NodeId, StoredRouteTreeNode>
  stepNodesById: Map<NodeId, StoredRouteTreeNode>
}

export interface JourneyRouteContext {
  journeyId: NodeId
  templatePath: string
  mountPath: string
  parentTemplatePath?: string
}

export interface StepRouteContext {
  stepId: NodeId
  path: string
  routeTemplatePath: string
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  journeyBasePath: string
}

export interface RouteTreeBuildResult {
  journeyContexts: JourneyRouteContext[]
  stepContexts: StepRouteContext[]
  catalogsByBasePath: Map<string, JourneyRouteTemplateCatalog>
}

export function createRouteTreeIndex(): RouteTreeIndex {
  return {
    roots: [],
    nodesByTemplatePath: new Map<string, StoredRouteTreeNode>(),
    journeyNodesById: new Map<NodeId, StoredRouteTreeNode>(),
    stepNodesById: new Map<NodeId, StoredRouteTreeNode>(),
  }
}
