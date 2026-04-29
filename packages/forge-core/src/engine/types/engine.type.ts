import ComponentRegistry from '../registries/ComponentRegistry'
import FunctionRegistry from '../registries/FunctionRegistry'
import type { FrameworkAdapter, Logger } from '../../framework/types/adapter.type'

export type { ASTNode, AstNodeId, CompileAstNodeId, NodeId, TemplateNodeId } from './ast.type'

export interface JourneyInstanceDependencies {
  componentRegistry: ComponentRegistry
  functionRegistry: FunctionRegistry
  logger: Logger | Console
  frameworkAdapter: FrameworkAdapter<any, any, any>
}
