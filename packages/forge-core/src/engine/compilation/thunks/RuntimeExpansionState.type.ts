import { NodeId } from '../../types/engine.type'

export interface PreparedIteratorItem {
  itemScope: Record<string, unknown>
  yieldValue: unknown
}

export interface PreparedIteratorExpansion {
  items: PreparedIteratorItem[]
}

export interface RuntimeExpansionState {
  preparedIterators: Map<NodeId, PreparedIteratorExpansion>
  expandedIteratorIds: Set<NodeId>
}

export function createRuntimeExpansionState(): RuntimeExpansionState {
  return {
    preparedIterators: new Map<NodeId, PreparedIteratorExpansion>(),
    expandedIteratorIds: new Set<NodeId>(),
  }
}
