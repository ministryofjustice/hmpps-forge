import type { WorkUnitTrace } from '../../../../contracts/runtime/trace.type'
import type { WorkUnitContract } from '../../../../contracts/runtime/work.type'

export default class WorkUnitTraceSerializer {
  serialize(workUnit: WorkUnitContract): WorkUnitTrace {
    return {
      key: workUnit.key,
      kind: workUnit.kind,
      beginFields: workUnit.beginFields,
      completeFields: workUnit.completeFields,
      completed: workUnit.completed,
      startedAtMs: workUnit.startedAtMs,
      completedAtMs: workUnit.completedAtMs,
      durationMs: workUnit.durationMs,
      children: workUnit.children.filter(child => !child.omitFromTrace).map(child => this.serialize(child)),
    }
  }
}
