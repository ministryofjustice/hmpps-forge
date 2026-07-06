import TraceSpan from '../../../diagnostics/tracing/TraceSpan'
import type { TraceSpanReference } from '../../../diagnostics/tracing/traceSpan.type'
import type { WorkContextContract } from '../../../contracts/runtime/work.type'

export default class WorkContext<TRequestContext = unknown, TProps = unknown> implements WorkContextContract<
  TRequestContext,
  TProps
> {
  private readonly requestContext: TRequestContext

  private readonly workProps?: TProps

  private readonly traceSpan?: TraceSpanReference

  constructor(request: TRequestContext, work?: TraceSpanReference, props?: TProps) {
    this.requestContext = request
    this.traceSpan = work
    this.workProps = props
  }

  get request(): TRequestContext {
    return this.requestContext
  }

  // `props` is always set by `withWork` before any handler or instrumentation reads it;
  // the root seed context (no work, no props) is never passed to a handler.
  get props(): TProps {
    return this.workProps as TProps
  }

  get work(): TraceSpanReference | undefined {
    return this.traceSpan
  }

  withWork(work: TraceSpanReference, props: TProps): WorkContext<TRequestContext, TProps> {
    return new WorkContext<TRequestContext, TProps>(this.requestContext, work, props)
  }

  omitFromTrace(): void {
    if (this.traceSpan instanceof TraceSpan) {
      this.traceSpan.markOmitFromTrace()
    }
  }
}
