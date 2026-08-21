import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import type { Logger } from '../../../../framework/types/adapter.type'
import type { RegisteredForgePackage } from '../../../../authoring/types/package.type'
import type { FunctionRegistryBuilder } from '../../../../authoring/types/functions.type'

export type { ASTNode, AstNodeId, NodeId, TemplateNodeId } from './ast.type'

export interface ForgeDependencies {
  logger: Logger | Console
}

export interface PackageDependencies {
  functionRegistry: FunctionRegistry
  componentRegistry: ComponentRegistry
}

export type ForgePackageFunctions<TDeps> = FunctionRegistryBuilder<TDeps> | FunctionRegistryBuilder<TDeps>[]

/**
 * A package accepted by `Forge.registerPackage()`: the branded output of
 * `createForgePackage()`. Raw package literals are rejected at registration.
 */
export type ForgePackageRegistration<TDeps = Record<string, never>> = RegisteredForgePackage<TDeps>
