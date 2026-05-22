import ComponentRegistry from '../registries/ComponentRegistry'
import FunctionRegistry from '../registries/FunctionRegistry'
import type { FrameworkAdapter, Logger } from '../../framework/types/adapter.type'

export type { ASTNode, AstNodeId, CompiledNodeId, CompileAstNodeId, NodeId, TemplateNodeId } from './ast.type'

export interface ForgeDependencies {
  logger: Logger | Console
  frameworkAdapter: FrameworkAdapter<any, any, any>
}

export interface PackageDependencies {
  functionRegistry: FunctionRegistry
  componentRegistry: ComponentRegistry
}
