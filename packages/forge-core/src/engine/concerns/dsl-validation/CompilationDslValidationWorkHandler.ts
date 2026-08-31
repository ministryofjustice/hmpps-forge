import type { WorkContextContract, WorkHandler } from '../../chassis/contracts/work/work.type'
import { createWorkTask } from '../../chassis/work/workTask'
import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import { DSLValidator } from './DSLValidator'
import RendererBlocksValidator from './RendererBlocksValidator'
import type { FunctionDefinitionLookup } from '../../../authoring/types/functions.type'

/**
 * Structural slice of the compilation state this phase reads. dsl-validation
 * runs before the AST exists and must not import from compilation/, so it
 * declares only the shape it needs rather than the full state type.
 */
export interface DslValidationTarget {
  readonly journeyDefinition: JourneyDefinition<unknown>
  readonly dependencies: {
    readonly functionRegistry: FunctionDefinitionLookup
  }
}

export const COMPILATION_DSL_VALIDATION_WORK_HANDLER: WorkHandler<'compilation.dsl-validation', undefined> = {
  kind: 'compilation.dsl-validation',

  begin(ctx: WorkContextContract<DslValidationTarget, undefined>) {
    const { journeyDefinition, dependencies } = ctx.state

    DSLValidator.validateJSON(journeyDefinition)
    DSLValidator.validateSchema(journeyDefinition)
    new RendererBlocksValidator(journeyDefinition, dependencies.functionRegistry).validate()

    return { output: undefined }
  },
}

export function createCompilationDslValidationTask() {
  return createWorkTask('dsl-validation', COMPILATION_DSL_VALIDATION_WORK_HANDLER, undefined)
}
