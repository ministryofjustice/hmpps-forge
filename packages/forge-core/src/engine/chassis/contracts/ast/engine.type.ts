import ComponentRegistry from '../../registries/ComponentRegistry'
import type { Logger } from '../../../../framework/types/adapter.type'
import type { RegisteredForgePackage } from '../../../../authoring/types/package.type'
import type { FunctionRegistryBuilder } from '../../../../authoring/types/functions.type'

export type {
  ASTNode,
  AstNodeId,
  BaseASTNode,
  MaterialisedASTNode,
  NodeId,
  TemplateASTNode,
  TemplateNodeId,
} from './ast.type'

export interface ForgeDependencies {
  logger: Logger | Console
}

export interface PackageDependencies {
  readonly functionBuilders: readonly FunctionRegistryBuilder[]
  readonly packageDependencies: unknown
  readonly componentRegistry: ComponentRegistry
}

export type ForgePackageFunctions<TDeps> = FunctionRegistryBuilder<TDeps> | FunctionRegistryBuilder<TDeps>[]

/**
 * A package accepted by `Forge.registerPackage()`: the branded output of
 * `createForgePackage()`. Raw package literals are rejected at registration.
 */
export type ForgePackageRegistration<TDeps = Record<string, never>> = RegisteredForgePackage<TDeps>
