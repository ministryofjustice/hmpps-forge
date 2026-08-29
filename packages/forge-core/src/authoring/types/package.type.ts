import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BaseFunctionRegistry } from '../registries/BaseFunctionRegistry'
import type { FunctionEntry, FunctionRegistryBuilder } from './functions.type'
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
  /**
   * The root journey definition this package mounts, compiled at registration.
   * Accepts a JSON string, which {@link createForgePackage} parses.
   */
  journey: string | JourneyDefinition

  /**
   * Custom functions visible only to this package's journey. Accepts a
   * function registry or an array of registries and function entries. The dependencies
   * supplied by package registration and the active framework request are
   * resolved for each registry's `build()` and entry's `factory` during
   * request context preparation.
   *
   * Listed entries register under their author name, which serves journey
   * definitions that reference functions by name only (e.g. plain JSON).
   * Entries embedded in the journey itself register automatically and need
   * no listing here.
   *
   * A registry that needs no dependencies can be listed on any package,
   * whatever that package's own dependencies are.
   *
   * @see {@link BaseFunctionRegistry}
   */
  functions?:
    | BaseFunctionRegistry<TDeps>
    | BaseFunctionRegistry
    | (BaseFunctionRegistry<TDeps> | BaseFunctionRegistry | FunctionEntry<TDeps>)[]

  /**
   * Custom components visible only to this package's journey.
   *
   * @see {@link ComponentRegistryEntry}
   */
  components?: ComponentRegistryEntry<object, unknown>[]

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

/**
 * A forge package that has been finalised by {@link createForgePackage}.
 *
 * The journey is guaranteed to be a parsed, builder-free definition, and the
 * `forgePackage` brand marks the package as safe for `Forge.registerPackage()`,
 * which rejects packages that have not passed through `createForgePackage()`.
 *
 * @typeParam TDeps - Dependencies required to create the function registries
 */
export interface RegisteredForgePackage<TDeps = Record<string, never>> extends Omit<
  ForgePackage<TDeps>,
  'journey' | 'functions'
> {
  /** The parsed, finalised journey definition this package mounts. */
  journey: JourneyDefinition

  /**
   * The package's function registries. `createForgePackage()` assembles any
   * function entries - listed or embedded in the journey - into a registry, so
   * a finalised package carries registries only and the engine never sees
   * entries.
   */
  functions?: FunctionRegistryBuilder<TDeps> | FunctionRegistryBuilder<TDeps>[]

  /** Brand stamped by {@link createForgePackage}; registration requires it. */
  forgePackage: true
}
