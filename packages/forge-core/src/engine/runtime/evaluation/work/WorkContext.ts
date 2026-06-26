import WorkUnit from './WorkUnit'
import type { WorkUnitReference } from '../../../contracts/runtime/workUnit.type'
import type { WorkContextContract } from '../../../contracts/runtime/work.type'

export default class WorkContext<TRequestContext = unknown, TProps = unknown> implements WorkContextContract<
  TRequestContext,
  TProps
> {
  private readonly requestContext: TRequestContext

  private readonly workProps?: TProps

  private readonly workUnit?: WorkUnitReference

  constructor(request: TRequestContext, work?: WorkUnitReference, props?: TProps) {
    this.requestContext = request
    this.workUnit = work
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

  get work(): WorkUnitReference | undefined {
    return this.workUnit
  }

  withWork(work: WorkUnitReference, props: TProps): WorkContext<TRequestContext, TProps> {
    return new WorkContext<TRequestContext, TProps>(this.requestContext, work, props)
  }

  omitFromTrace(): void {
    if (this.workUnit instanceof WorkUnit) {
      this.workUnit.markOmitFromTrace()
    }
  }
}
