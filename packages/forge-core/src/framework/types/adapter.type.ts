import type { ComponentRegistryEntry } from '../../components/types/components.type'
import type { BlockDefinition } from '../../components/types/structures.type'

/**
 * A minimal logger interface compatible with pino, bunyan, console, and most logging libraries.
 */
export interface Logger {
  info(...args: unknown[]): void
  error(...args: unknown[]): void
  warn(...args: unknown[]): void
  debug(...args: unknown[]): void
}

/**
 * Read-only view of the components an adapter can render, keyed by variant.
 */
export interface ComponentRegistry {
  get<T extends BlockDefinition, TRenderOutput = unknown>(
    variant: string,
  ): ComponentRegistryEntry<T, TRenderOutput> | undefined
  getAll(): ReadonlyMap<string, ComponentRegistryEntry<BlockDefinition, unknown>>
}
