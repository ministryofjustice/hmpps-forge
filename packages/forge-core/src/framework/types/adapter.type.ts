import type { ComponentRegistryEntry } from '../../components/types/components.type'

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
  get(variant: string): ComponentRegistryEntry<object, unknown> | undefined
  getAll(): ReadonlyMap<string, ComponentRegistryEntry<object, unknown>>
}
