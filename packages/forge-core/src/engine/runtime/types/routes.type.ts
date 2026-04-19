import { NodeId } from '../../types/ast.type'
import { CompiledStep } from '../../compilation/CompilationFactory'

export type StepResolver = () => CompiledStep

export interface JourneyRouteTemplateCatalog {
  routeTemplatePathByStepId: Map<NodeId, string>
  stepIdByRouteTemplatePath: Map<string, NodeId>
}

export interface RouteMapEntry {
  stepId: NodeId
  resolveCompiledStep: StepResolver
}
