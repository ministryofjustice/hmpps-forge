import { NodeId } from '../../types/engine.type'
import { CompilationArtefact, CompiledStep } from '../../compilation/FormCompilationFactory'
import { StepASTNode } from '../../types/structures.type'
import type { StepController } from '../../../framework/types/adapter.type'

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

export type { StepController }
