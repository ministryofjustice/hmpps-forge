import ComponentRegistry from '../registries/ComponentRegistry'
import FunctionRegistry from '../registries/FunctionRegistry'
import type { FrameworkAdapter, Logger } from '../../framework/types/adapter.type'
import type { ForgeInstrumentation } from '../../instrumentation/ForgeInstrumentation'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition } from '../../components/types/structures.type'
import type { FunctionEvaluator } from '../../authoring/types/functions.type'

export type { ASTNode, AstNodeId, CompiledNodeId, CompileAstNodeId, NodeId, TemplateNodeId } from './ast.type'

export interface ForgeDependencies {
  logger: Logger | Console
  frameworkAdapter: FrameworkAdapter<any, any, any>
  instrumentation?: ForgeInstrumentation
}

export interface PackageDependencies {
  functionRegistry: FunctionRegistry
  componentRegistry: ComponentRegistry
}

export type ForgeFunctionImplementations<TDeps> = Record<string, (deps: TDeps) => FunctionEvaluator<unknown>>

export interface ForgePackageRegistration<TDeps = Record<string, never>> {
  journey: string | JourneyDefinition
  functions?: ForgeFunctionImplementations<TDeps>
  components?: ComponentRegistryEntry<BlockDefinition>[]
  enabled?: boolean
}
