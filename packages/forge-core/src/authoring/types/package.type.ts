import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition } from '../../components/types/structures.type'
import type { FunctionImplementations, FunctionShapeMap } from '../utils/defineFunction.type'
import type { BaseFunctionRegistry } from '../registries/BaseFunctionRegistry'
import type { JourneyDefinition } from './structures.type'

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
  functions?:
    | FunctionImplementations<FunctionShapeMap, TDeps>
    | BaseFunctionRegistry<TDeps>
    | BaseFunctionRegistry<TDeps>[]
  components?: ComponentRegistryEntry<BlockDefinition, unknown>[]

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
