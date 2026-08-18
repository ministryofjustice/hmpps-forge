import type FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import type { StepFieldInventory } from './stepFieldInventory.type'

/**
 * Context passed to the compiled field inventory function. Field codes are
 * resolved at journey scope from the same request snapshot every other compiled
 * function sees; the iterator scope the MAP templates need is created inside the
 * generated source.
 */
export interface FieldInventoryContext {
  answers: Record<string, { current: unknown }>
  data: Record<string, unknown>
  session: Record<string, unknown>
  params: Record<string, unknown>
  query: Record<string, unknown>
  request: Record<string, unknown>
  conditions: FunctionRegistry
}

/**
 * Evaluates every step's possible field codes for one request. Answer cleardown
 * matches the answers it clears against this inventory, and the reachability
 * projection reports it per step.
 */
export type CompiledFieldInventoryFunction = (
  ctx: FieldInventoryContext,
) => StepFieldInventory[] | Promise<StepFieldInventory[]>
