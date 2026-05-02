import type { ValidationContext } from '../compilation/codegen/phase-compilers/validation/StepValidationCompiler'
import type { StepValidityResult } from '../runtime/types/StepValidityResult.type'
import type {
  RenderCompilationContext,
  CompiledBlock,
} from '../compilation/codegen/phase-compilers/rendering/StepRenderCompiler'
import type { AnswerPreparationContext } from '../compilation/codegen/phase-compilers/answer-preparation/StepAnswerPreparationCompiler'

export type CompiledValidationFunction = (
  ctx: ValidationContext,
  isSubmission: boolean,
  groups?: string[],
) => StepValidityResult | Promise<StepValidityResult>

export type CompiledEntryValidationFunction = (ctx: ValidationContext) => string[] | Promise<string[]>

export interface CompiledRenderResult {
  blocks: CompiledBlock[]
  step: Record<string, unknown>
  ancestors: Record<string, unknown>[]
}

export type CompiledRenderFunction = (
  ctx: RenderCompilationContext,
) => CompiledRenderResult | Promise<CompiledRenderResult>

export type CompiledAnswerPreparationFunction = (ctx: AnswerPreparationContext) => void | Promise<void>
