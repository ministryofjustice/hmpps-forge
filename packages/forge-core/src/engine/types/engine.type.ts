import ComponentRegistry from '../../components/ComponentRegistry'
import FunctionRegistry from '../FunctionRegistry'
import type { FrameworkAdapter, Logger } from '../../framework/types/adapter.type'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { FunctionImplementations, FunctionShapeMap } from '../../authoring/utils/defineFunction.type'
import { ComponentRegistryEntry } from '../../components/types/components.type'

export type {
  ASTNode,
  AstNodeId,
  CompileAstNodeId,
  CompilePseudoNodeId,
  NodeId,
  PseudoNodeId,
  RuntimeAstNodeId,
  RuntimePseudoNodeId,
  TemplateNodeId,
} from './ast.type'

export interface JourneyInstanceDependencies {
  componentRegistry: ComponentRegistry
  functionRegistry: FunctionRegistry
  logger: Logger | Console
  frameworkAdapter: FrameworkAdapter<any, any, any>
}

/**
 * A forge package bundles a journey definition with its custom registries.
 *
 * Use this to export journeys as self-contained packages that include their
 * effects, transformers, conditions, and components alongside the journey definition.
 *
 * @typeParam TDeps - Dependencies required to create the function registries
 *
 * @see {@link createForgePackage} for the recommended way to create forge packages
 */
export interface ForgePackage<TDeps = Record<string, never>> {
  journey: JourneyDefinition
  functions?: FunctionImplementations<FunctionShapeMap, TDeps>
  components?: ComponentRegistryEntry<any>[]

  /**
   * Whether this package should be registered. Default: true
   *
   * When set to false, registerPackage() will skip registration entirely.
   * Useful for disabling journeys via configuration or feature flags.
   *
   * @example
   * ```typescript
   * createForgePackage({
   *   enabled: config.featureFlags.myFormEnabled,
   *   journey: myJourney,
   * })
   * ```
   */
  enabled?: boolean
}
