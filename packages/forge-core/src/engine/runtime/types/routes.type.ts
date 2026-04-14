import { NodeId } from '../../types/ast.type'
import { CompilationArtefact, CompiledStep } from '../../compilation/CompilationFactory'
import { StepASTNode } from '../../types/structures.type'
import { JourneyInstanceDependencies } from '../../types/engine.type'

export type StepResolver = () => CompiledStep

export interface JourneyRouteTemplateCatalog {
  routeTemplatePathByStepId: Map<NodeId, string>
  stepIdByRouteTemplatePath: Map<string, NodeId>
}

export interface RouteMapEntry {
  stepId: NodeId
  resolveCompiledStep: StepResolver
}

export interface StepMountContext {
  stepId: NodeId
  stepNode: StepASTNode
  sharedArtefact: CompilationArtefact
  resolveCompiledStep: StepResolver
  routeTemplatePath: string
  routeTemplateCatalog: JourneyRouteTemplateCatalog
  dependencies: JourneyInstanceDependencies
}
