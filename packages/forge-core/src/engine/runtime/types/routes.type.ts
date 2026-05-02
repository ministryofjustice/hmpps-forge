import { NodeId } from '../../types/ast.type'
import type { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import type { RouteTreeRoute } from '../../../framework/rendering/types'

export type RouteMethod = 'GET' | 'POST'

export interface JourneyRouteTemplateCatalog {
  routeTemplatePathByStepId: Map<NodeId, string>
  stepIdByRouteTemplatePath: Map<string, NodeId>
}

export type StoredRouteTreeRoute =
  | (RouteTreeRoute & {
      kind: 'journey'
      journeyNode: JourneyASTNode
    })
  | (RouteTreeRoute & {
      kind: 'step'
      stepNode: StepASTNode
    })

export interface StoredRouteTreeNode {
  segment: string
  templatePath: string
  metadata?: Record<string, unknown>
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
  journeyNode: JourneyASTNode
  templatePath: string
  mountPath: string
  parentTemplatePath?: string
}

export interface StepRouteContext {
  stepId: NodeId
  stepNode: StepASTNode
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
