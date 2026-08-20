import type { NodeId } from '../../contracts/ast/engine.type'
import type { CompiledJourneyFunctions } from '../../contracts/plans/compilationArtefacts.type'
import type { JourneyModel, StepModel } from '../../contracts/models/compilationModel.type'
import type { WorkContextContract, WorkHandler, WorkInstrumentation } from '../../contracts/work/work.type'
import { createWorkTask } from '../../work/workTask'
import type CompilationState from '../pipeline/CompilationState'
import CodegenOrchestrator from './CodegenOrchestrator'

export interface JourneyCodegenWorkProps {
  readonly journeyId: NodeId
  readonly journey: JourneyModel
}

export interface StepCodegenWorkProps {
  readonly stepId: NodeId
  readonly step: StepModel
  readonly journeyFunctions: CompiledJourneyFunctions
}

/**
 * The lowering phase as work: the phase task fans out into one
 * `codegen.package-functions` task plus one `codegen.journey` task per
 * journey, and each journey task fans out into its `codegen.step` tasks.
 */
export const COMPILATION_LOWERING_WORK_HANDLER: WorkHandler<'compilation.lowering', undefined> = {
  kind: 'compilation.lowering',

  begin(ctx: WorkContextContract<CompilationState, undefined>) {
    const state = ctx.state

    const journeyTasks = [...state.model.journeys.entries()]
      // A container journey owns no steps and has never produced a compiled
      // journey; emitting one would change the compiled package surface.
      .filter(([, journey]) => journey.steps.size > 0)
      .map(([journeyId, journey]) =>
        createWorkTask(
          `journey:${journeyId}`,
          JOURNEY_CODEGEN_WORK_HANDLER,
          { journeyId, journey },
          JOURNEY_CODEGEN_WORK_INSTRUMENTATION,
        ),
      )

    return {
      groups: [
        {
          mode: 'sequential' as const,
          children: [createWorkTask('package-functions', PACKAGE_FUNCTIONS_WORK_HANDLER, undefined), ...journeyTasks],
        },
      ],
    }
  },
}

export const PACKAGE_FUNCTIONS_WORK_HANDLER: WorkHandler<'codegen.package-functions', undefined> = {
  kind: 'codegen.package-functions',

  begin(ctx: WorkContextContract<CompilationState, undefined>) {
    const state = ctx.state
    const orchestrator = new CodegenOrchestrator(state.dependencies)

    state.recordPackageFunctions(orchestrator.compilePackageFunctions(state.model.routeMetadata))

    return { output: undefined }
  },
}

export const JOURNEY_CODEGEN_WORK_INSTRUMENTATION: WorkInstrumentation<JourneyCodegenWorkProps, undefined> = {
  resolveTraceMetadataAtStart: ctx => ({ nodeId: ctx.props.journeyId }),
  resolveTraceMetadataAtFinish: () => undefined,
}

export const JOURNEY_CODEGEN_WORK_HANDLER: WorkHandler<'codegen.journey', JourneyCodegenWorkProps> = {
  kind: 'codegen.journey',

  begin(ctx: WorkContextContract<CompilationState, JourneyCodegenWorkProps>) {
    const state = ctx.state
    const { journeyId, journey } = ctx.props
    const orchestrator = new CodegenOrchestrator(state.dependencies)
    const journeyFunctions = orchestrator.compileJourneyFunctions(journey)

    state.journeys.set(journeyId, {
      mountInfo: journey.mountInfo,
      ...journeyFunctions,
      ...state.packageFunctions,
    })

    const stepTasks = [...journey.steps.entries()].map(([stepId, step]) =>
      createWorkTask(
        `step:${stepId}`,
        STEP_CODEGEN_WORK_HANDLER,
        { stepId, step, journeyFunctions },
        STEP_CODEGEN_WORK_INSTRUMENTATION,
      ),
    )

    return { groups: [{ mode: 'sequential' as const, children: stepTasks }] }
  },
}

export const STEP_CODEGEN_WORK_INSTRUMENTATION: WorkInstrumentation<StepCodegenWorkProps, undefined> = {
  resolveTraceMetadataAtStart: ctx => ({ nodeId: ctx.props.stepId }),
  resolveTraceMetadataAtFinish: () => undefined,
}

export const STEP_CODEGEN_WORK_HANDLER: WorkHandler<'codegen.step', StepCodegenWorkProps> = {
  kind: 'codegen.step',

  begin(ctx: WorkContextContract<CompilationState, StepCodegenWorkProps>) {
    const state = ctx.state
    const { stepId, step, journeyFunctions } = ctx.props
    const orchestrator = new CodegenOrchestrator(state.dependencies)
    const stepFunctions = orchestrator.compileStepFunctions(step, journeyFunctions.compiledStepValidations.get(stepId))

    state.steps.set(stepId, {
      mountInfo: step.mountInfo,
      compiledReachabilityFacts: journeyFunctions.compiledReachabilityFacts,
      compiledReachabilityState: journeyFunctions.compiledReachabilityState,
      compiledFieldInventory: journeyFunctions.compiledFieldInventory,
      compiledStepValidations: journeyFunctions.compiledStepValidations,
      ...stepFunctions,
      ...state.packageFunctions,
    })

    return { output: undefined }
  },
}

export function createCompilationLoweringTask() {
  return createWorkTask('lowering', COMPILATION_LOWERING_WORK_HANDLER, undefined)
}
