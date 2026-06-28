import type { WorkUnitContract, WorkUnitFields } from '../../../contracts/runtime/work.type'

export default class WorkUnit implements WorkUnitContract {
  private readonly workKey: string

  private readonly workKind: string

  private readonly parentWorkUnit?: WorkUnit

  private readonly childWorkUnits: WorkUnit[] = []

  private readonly mutableStartedAtMs = performance.now()

  private mutableBeginFields: WorkUnitFields = {}

  private mutableCompleteFields: WorkUnitFields = {}

  private mutableCompleted = false

  private mutableCompletedAtMs: number | undefined

  private mutableDurationMs: number | undefined

  private mutableOutput: unknown

  private mutableOmitFromTrace = false

  constructor(key: string, kind: string, parent?: WorkUnit) {
    this.workKey = key
    this.workKind = kind
    this.parentWorkUnit = parent
  }

  get key(): string {
    return this.workKey
  }

  get kind(): string {
    return this.workKind
  }

  get parent(): WorkUnit | undefined {
    return this.parentWorkUnit
  }

  get children(): readonly WorkUnit[] {
    return this.childWorkUnits
  }

  get beginFields(): WorkUnitFields {
    return this.mutableBeginFields
  }

  get completeFields(): WorkUnitFields {
    return this.mutableCompleteFields
  }

  get completed(): boolean {
    return this.mutableCompleted
  }

  get startedAtMs(): number {
    return this.mutableStartedAtMs
  }

  get completedAtMs(): number | undefined {
    return this.mutableCompletedAtMs
  }

  get durationMs(): number | undefined {
    return this.mutableDurationMs
  }

  get output(): unknown {
    return this.mutableOutput
  }

  get omitFromTrace(): boolean {
    return this.mutableOmitFromTrace
  }

  addChild(childWorkUnit: WorkUnit): void {
    this.childWorkUnits.push(childWorkUnit)
  }

  recordTraceMetadataAtStart(traceMetadata: WorkUnitFields | undefined): void {
    this.mutableBeginFields = traceMetadata ?? {}
  }

  recordTraceMetadataAtFinish(traceMetadata: WorkUnitFields | undefined): void {
    this.mutableCompleteFields = traceMetadata ?? {}
  }

  complete(output: unknown): void {
    const completedAtMs = performance.now()

    this.mutableOutput = output
    this.mutableCompleted = true
    this.mutableCompletedAtMs = completedAtMs
    this.mutableDurationMs = completedAtMs - this.mutableStartedAtMs
  }

  markOmitFromTrace(): void {
    this.mutableOmitFromTrace = true
  }
}
