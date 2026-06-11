import type { NodeId } from '../ast/ast.type'

export interface RouteDescriptor {
  readonly nodeId: NodeId
  readonly path: string
  readonly title?: string
  readonly description?: string
  readonly metadata?: Record<string, unknown>
  readonly ancestorJourneyNodeIds: readonly NodeId[]
}

export type StepRouteIndex = Map<NodeId, RouteDescriptor>

export type JourneyRouteIndex = Map<NodeId, RouteDescriptor>
