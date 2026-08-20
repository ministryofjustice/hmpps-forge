import type { NodeId } from '../../../chassis/contracts/ast/ast.type'

export interface JourneyRouteDescriptor {
  readonly nodeId: NodeId
  readonly path: string
  readonly ancestorJourneyIds: readonly NodeId[]
}

export interface StepRouteDescriptor {
  readonly nodeId: NodeId
  readonly path: string
  readonly ancestorJourneyIds: readonly NodeId[]
}

export type StepRouteIndex = Map<NodeId, StepRouteDescriptor>

export type JourneyRouteIndex = Map<NodeId, JourneyRouteDescriptor>
