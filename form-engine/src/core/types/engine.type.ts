import type Logger from 'bunyan'
import { ASTNodeType } from '@form-engine/core/types/enums'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import { FrameworkAdapter } from '@form-engine/core/runtime/routes/types'
import { JourneyDefinition } from '@form-engine/form/types/structures.type'
import { FunctionRegistryObject } from '@form-engine/registry/types/functions.type'
import { ComponentRegistryEntry } from '@form-engine/registry/types/components.type'

export interface FormInstanceDependencies {
  componentRegistry: ComponentRegistry
  functionRegistry: FunctionRegistry
  logger: Logger | Console
  frameworkAdapter: FrameworkAdapter<any, any, any>
}

/**
 * Base AST node interface that all nodes extend
 */
export interface ASTNode {
  type: ASTNodeType
  id: AstNodeId
  properties?: Record<string, any>
  raw?: any
}

/**
 * Template literal types for enforcing NodeID structure
 */
export type CompileAstNodeId = `compile_ast:${number}`
export type CompilePseudoNodeId = `compile_pseudo:${number}`
export type RuntimeAstNodeId = `runtime_ast:${number}`
export type RuntimePseudoNodeId = `runtime_pseudo:${number}`

/**
 * Union of all valid NodeId formats
 */
export type NodeId = CompileAstNodeId | CompilePseudoNodeId | RuntimeAstNodeId | RuntimePseudoNodeId

/**
 * NodeIds categorized by AST vs Pseudo node type
 */
export type AstNodeId = CompileAstNodeId | RuntimeAstNodeId
export type PseudoNodeId = CompilePseudoNodeId | RuntimePseudoNodeId

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
