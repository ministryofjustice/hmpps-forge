import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import type { Logger } from '../../../../framework/types/adapter.type'
import type { RegisteredForgePackage } from '../../../../authoring/types/package.type'
import type { FunctionEvaluator } from '../../../../authoring/types/functions.type'
import type { BaseFunctionRegistry } from '../../../../authoring/registries/BaseFunctionRegistry'
import type {
  FunctionImplementations,
  FunctionShapeMap,
} from '../../../../authoring/utils/deprecated/defineFunction.type'

export type { ASTNode, AstNodeId, NodeId, TemplateNodeId } from './ast.type'

export interface ForgeDependencies {
  logger: Logger | Console
}

export interface PackageDependencies {
  functionRegistry: FunctionRegistry
  componentRegistry: ComponentRegistry
}

/** @deprecated Use BaseFunctionRegistry subclasses instead */
export type ForgeFunctionImplementations<TDeps> = Record<string, (deps: TDeps) => FunctionEvaluator<unknown>>

export type ForgePackageFunctions<TDeps> =
  | FunctionImplementations<FunctionShapeMap, TDeps>
  | BaseFunctionRegistry<TDeps>
  | BaseFunctionRegistry<TDeps>[]

/**
 * A package accepted by `Forge.registerPackage()`: the branded output of
 * `createForgePackage()`. Raw package literals are rejected at registration.
 */
export type ForgePackageRegistration<TDeps = Record<string, never>> = RegisteredForgePackage<TDeps>
