import { z } from 'zod'
import { ComponentCallType } from '../shared/taxonomy'
import type { BlockDefinition } from './types/structures.type'

/**
 * A block leaf for composing renderer-specific `blocksSchema` declarations.
 * Forge's DSL validator remains responsible for validating the block's full
 * authoring shape; this schema identifies where content begins in a layout.
 */
export const blockSchema: z.ZodType<BlockDefinition> = z.custom<BlockDefinition>(value => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const block = value as { _forge?: unknown; variant?: unknown }

  return (block._forge === ComponentCallType.BASIC || block._forge === ComponentCallType.FIELD) &&
    typeof block.variant === 'string'
}, 'Expected a Forge block definition')
