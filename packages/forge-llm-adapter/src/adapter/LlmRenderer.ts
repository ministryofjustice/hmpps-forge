import type { ForgeRenderer } from '@ministryofjustice/hmpps-forge/core/framework'

/** Preserves structured component outputs for an LLM turn renderer. */
export class LlmRenderer implements ForgeRenderer<unknown> {
  wrapNestedBlock(_block: unknown, output: unknown): unknown {
    return output
  }

  assemblePage(): never {
    throw new Error('LLM journeys require an LlmTurn renderer')
  }
}
