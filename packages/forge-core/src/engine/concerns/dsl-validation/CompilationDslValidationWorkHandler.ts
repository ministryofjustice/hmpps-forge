import type { WorkContextContract, WorkHandler } from '../../contracts/work/work.type'
import { createWorkTask } from '../../work/workTask'
import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import { DSLValidator } from './DSLValidator'

/**
 * Structural slice of the compilation state this phase reads. dsl-validation
 * runs before the AST exists and must not import from compilation/, so it
 * declares only the shape it needs rather than the full state type.
 */
export interface DslValidationTarget {
  readonly journeyDefinition: JourneyDefinition
}

export const COMPILATION_DSL_VALIDATION_WORK_HANDLER: WorkHandler<'compilation.dsl-validation', undefined> = {
  kind: 'compilation.dsl-validation',

  begin(ctx: WorkContextContract<DslValidationTarget, undefined>) {
    const { journeyDefinition } = ctx.state

    DSLValidator.validateJSON(journeyDefinition)
    DSLValidator.validateSchema(journeyDefinition)

    return { output: undefined }
  },
}

export function createCompilationDslValidationTask() {
  return createWorkTask('dsl-validation', COMPILATION_DSL_VALIDATION_WORK_HANDLER, undefined)
}
