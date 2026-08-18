import TraceSpan from '../tracing/TraceSpan'
import type { TraceSpanReference } from '../tracing/traceSpan.type'
import type { WorkContextContract } from '../contracts/work/work.type'

export default class WorkContext<TStageState = unknown, TProps = unknown> implements WorkContextContract<
  TStageState,
  TProps
> {
  private readonly stageState: TStageState

  private readonly workProps?: TProps

  private readonly traceSpan?: TraceSpanReference

  constructor(state: TStageState, work?: TraceSpanReference, props?: TProps) {
    this.stageState = state
    this.traceSpan = work
    this.workProps = props
  }

  get state(): TStageState {
    return this.stageState
  }

  // `props` is always set by `withWork` before any handler or instrumentation reads it;
  // the root seed context (no work, no props) is never passed to a handler.
  get props(): TProps {
    return this.workProps as TProps
  }

  get work(): TraceSpanReference | undefined {
    return this.traceSpan
  }

  withWork(work: TraceSpanReference, props: TProps): WorkContext<TStageState, TProps> {
    return new WorkContext<TStageState, TProps>(this.stageState, work, props)
  }

  omitFromTrace(): void {
    if (this.traceSpan instanceof TraceSpan) {
      this.traceSpan.markOmitFromTrace()
    }
  }
}
