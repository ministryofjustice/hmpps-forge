import type { NodeId } from '../../engine/chassis/contracts/ast/ast.type'

export type RouteTreeRouteKind = 'journey' | 'step'

export interface RouteTreeRoute {
  kind: RouteTreeRouteKind
  nodeId: NodeId
  title?: string
  description?: string
  metadata?: Record<string, unknown>
}

export interface RouteTreeNode {
  segment: string
  path: string
  templatePath: string
  active: boolean
  metadata?: Record<string, unknown>
  route?: RouteTreeRoute
  children: RouteTreeNode[]
}

export type RouteTree = RouteTreeNode[]
