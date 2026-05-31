import type { NodeId } from '../ast/ast.type'

export interface JourneyRouteDescriptor {
  readonly nodeId: NodeId
  readonly path: string
  readonly title?: string
  readonly description?: string
  readonly metadata?: Record<string, unknown>
  readonly ancestorJourneyIds: readonly NodeId[]
}

export interface StepRouteDescriptor {
  readonly nodeId: NodeId
  readonly path: string
  readonly title?: string
  readonly description?: string
  readonly metadata?: Record<string, unknown>
  readonly ancestorJourneyIds: readonly NodeId[]
}

export type StepRouteIndex = Map<NodeId, StepRouteDescriptor>

export type JourneyRouteIndex = Map<NodeId, JourneyRouteDescriptor>
