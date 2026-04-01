import ComponentRegistry from '../../components/ComponentRegistry'
import FunctionRegistry from '../FunctionRegistry'
import type { FrameworkAdapter, Logger } from '../../framework/types/adapter.type'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import { FunctionRegistryObject } from '../../authoring/types/functions.type'
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

export interface FormInstanceDependencies {
  componentRegistry: ComponentRegistry
  functionRegistry: FunctionRegistry
  logger: Logger | Console
  frameworkAdapter: FrameworkAdapter<any, any, any>
}

/**
 * A form package bundles a journey definition with its custom registries.
 *
 * Use this to export forms as self-contained packages that include their
 * effects, transformers, conditions, and components alongside the journey definition.
 *
 * @typeParam TDeps - Dependencies required to create the function registries
 *
 * @see {@link createFormPackage} for the recommended way to create form packages
 */
export interface FormPackage<TDeps = void> {
  journey: JourneyDefinition
  createRegistries?: (deps?: TDeps) => FunctionRegistryObject
  components?: ComponentRegistryEntry<any>[]

  /**
   * Whether this form package should be registered. Default: true
   *
   * When set to false, registerFormPackage() will skip registration entirely.
   * Useful for disabling forms via configuration or feature flags.
   *
   * @example
   * ```typescript
   * createFormPackage({
   *   enabled: config.featureFlags.myFormEnabled,
   *   journey: myJourney,
   * })
   * ```
   */
  enabled?: boolean
}
