import type { JourneyDefinition } from '../../../authoring/types/structures.type'
import type { CompiledPackage } from '../../contracts/plans/compilationArtefacts.type'
import type { ForgeInstrumentation } from '../../tracing/ForgeTraceSinkDispatcher'
import type TraceSpan from '../../tracing/TraceSpan'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'
import WorkExecutor from '../../work/WorkExecutor'
import WorkContext from '../../work/WorkContext'
import WorkExecutionError from '../../work/WorkExecutionError'
import CompilationPipelineTraceProjector from './CompilationPipelineTraceProjector'
import CompilationState from './CompilationState'
import CompilationPipelineBootstrap from './CompilationPipelineBootstrap'

export interface CompilationPipelineOptions {
  readonly functionRegistry: FunctionRegistry
  readonly componentRegistry: ComponentRegistry
  readonly instrumentation?: ForgeInstrumentation
}

/**
 * Compiles a journey definition by running the `compilation.pipeline` task tree
 * through the work executor — the same controller that runs the request
 * pipeline. Compilation handlers are all synchronous, so the tree executes
 * via `executeSyncWithUnit` and `compile()` stays synchronous end to end.
 */
export default class CompilationPipeline {
  private readonly traceProjector = new CompilationPipelineTraceProjector()

  constructor(private readonly options: CompilationPipelineOptions) {}

  compile(journeyDefinition: JourneyDefinition): CompiledPackage {
    const traceEnabled = this.options.instrumentation?.enabled === true
    const bootstrap = new CompilationPipelineBootstrap({
      journeyDefinition,
      functionRegistry: this.options.functionRegistry,
      componentRegistry: this.options.componentRegistry,
    })
    const state = bootstrap.buildExecutionContext()
    const executor = new WorkExecutor(traceEnabled)
    const pipelineElement = bootstrap.buildPipelineElement()

    try {
      const { traceSpan } = executor.executeSyncWithUnit(pipelineElement, new WorkContext(state))

      this.emitTrace(state, { root: traceSpan, outcome: 'compiled' })

      return this.assemblePackage(state)
    } catch (error) {
      const original = error instanceof WorkExecutionError ? error.original : error
      const root = error instanceof WorkExecutionError ? error.traceSpan : undefined

      this.emitTrace(state, { root, outcome: 'error', error: original })

      throw original
    }
  }

  private assemblePackage(state: CompilationState): CompiledPackage {
    return {
      journeyCode: state.ast.rootNode.properties.code,
      ...state.routeIndexes,
      steps: state.steps,
      journeys: state.journeys,
    }
  }

  private emitTrace(
    state: CompilationState,
    result: { root: TraceSpan | undefined; outcome: 'compiled' | 'error'; error?: unknown },
  ): void {
    const { instrumentation } = this.options

    if (instrumentation === undefined) {
      return
    }

    this.traceProjector.emit({
      instrumentation,
      root: result.root,
      journeyCode: state.journeyCode,
      outcome: result.outcome,
      error: result.error,
    })
  }
}
