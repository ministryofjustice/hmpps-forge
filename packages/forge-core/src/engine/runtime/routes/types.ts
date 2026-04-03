import { NodeId } from '../../types/engine.type'
import { CompilationArtefact, CompiledStep } from '../../compilation/CompilationFactory'
import { StepASTNode } from '../../types/structures.type'
export type StepResolver = () => Promise<CompiledStep>

export interface RouteMapEntry {
  stepId: NodeId
  resolveCompiledStep: StepResolver
}

export interface StepMountContext {
  stepId: NodeId
  stepNode: StepASTNode
  sharedArtefact: CompilationArtefact
  resolveCompiledStep: StepResolver
}
