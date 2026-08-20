import type { NodeId } from '../ast/ast.type'

/**
 * The plain-data payload that survives compilation into runtime: the node's
 * identity and normalized route path, read by `MountRegistry` when mounting a
 * compiled artefact. Everything else on a compiled step or journey is a
 * compiled function.
 */
export interface StepMountInfo {
  stepId: NodeId
  path: string
}

export interface JourneyMountInfo {
  journeyId: NodeId
  path: string
}
