export type WorkUnitFields = Readonly<Record<string, unknown>>

export interface WorkUnitReference {
  readonly key: string
  readonly kind: string
  readonly parent?: WorkUnitReference
  readonly children: readonly WorkUnitReference[]
  readonly beginFields: WorkUnitFields
  readonly completeFields: WorkUnitFields
  readonly completed: boolean
  readonly startedAtMs: number
  readonly completedAtMs?: number
  readonly durationMs?: number
  readonly output?: unknown
}
