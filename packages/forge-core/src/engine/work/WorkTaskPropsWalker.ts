import { FORGE_WORK } from '../contracts/work/work.type'
import type { CompletedWork, WorkTask } from '../contracts/work/work.type'
import { isWorkTask } from './workTask'
import ForgeInternalError from '../errors/ForgeInternalError'

/**
 * Collects work tasks embedded anywhere in a props value and, once the executor
 * has run them, substitutes each task with its completed output.
 *
 * `collect` and `replaceCompletedOutputs` walk the props in the same deterministic order
 * (enumerable own keys then array index, depth-first, stopping at task boundaries),
 * so matching is POSITIONAL: the nth task encountered during replace is paired with
 * the nth `completedWork`. The caller must therefore pass `completedWorks` in the exact
 * order `collect` returned the tasks. The executor guarantees this when the tasks
 * are run as a single reduce-all group — both concurrent and sequential preserve child order.
 *
 * The per-position key+kind check is a sanity assertion, not an identity match: task
 * keys are not assumed unique (an iterator can yield sibling blocks that reuse a key), so two
 * same-key, same-kind siblings are told apart only by position. Keep the begin/collect and
 * complete/replace traversals over the same props value, or out-of-order outputs will be
 * mis-paired without tripping the assertion.
 */
export default class WorkTaskPropsWalker {
  collect(value: unknown): readonly WorkTask[] {
    const workTasks: WorkTask[] = []

    this.collectValue(value, workTasks, new WeakSet<object>())

    return workTasks
  }

  replaceCompletedOutputs(value: unknown, completedWorks: readonly CompletedWork[]): unknown {
    let completedWorkIndex = 0
    const nextCompletedWork = (workTask: WorkTask): CompletedWork => {
      const completedWork = completedWorks[completedWorkIndex]

      if (completedWork === undefined) {
        throw new ForgeInternalError(`Missing completed work for task "${workTask.key}"`)
      }

      completedWorkIndex += 1
      this.assertCompletedWorkMatches(workTask, completedWork)

      return completedWork
    }
    const result = this.replaceValue(value, nextCompletedWork, new WeakSet<object>())

    if (completedWorkIndex < completedWorks.length) {
      throw new ForgeInternalError(
        `Unused completed work remains from task "${completedWorks[completedWorkIndex].key}"`,
      )
    }

    return result
  }

  private collectValue(value: unknown, workTasks: WorkTask[], ancestors: WeakSet<object>): void {
    if (isWorkTask(value)) {
      workTasks.push(value)

      return
    }

    if (this.isMalformedWorkTask(value)) {
      return
    }

    if (Array.isArray(value)) {
      this.assertNotCyclic(value, ancestors)
      ancestors.add(value)
      value.forEach(item => this.collectValue(item, workTasks, ancestors))
      ancestors.delete(value)

      return
    }

    if (this.isPlainRecord(value)) {
      this.assertNotCyclic(value, ancestors)
      ancestors.add(value)
      this.getEnumerableEntries(value).forEach(([, item]) => this.collectValue(item, workTasks, ancestors))
      ancestors.delete(value)
    }
  }

  private replaceValue(
    value: unknown,
    nextCompletedWork: (workTask: WorkTask) => CompletedWork,
    ancestors: WeakSet<object>,
  ): unknown {
    if (isWorkTask(value)) {
      return nextCompletedWork(value).output
    }

    if (this.isMalformedWorkTask(value)) {
      return value
    }

    if (Array.isArray(value)) {
      this.assertNotCyclic(value, ancestors)
      ancestors.add(value)
      const result = value.map(item => this.replaceValue(item, nextCompletedWork, ancestors))

      ancestors.delete(value)

      return result
    }

    if (this.isPlainRecord(value)) {
      this.assertNotCyclic(value, ancestors)
      ancestors.add(value)
      const result: Record<PropertyKey, unknown> = {}

      this.getEnumerableEntries(value).forEach(([key, item]) => {
        result[key] = this.replaceValue(item, nextCompletedWork, ancestors)
      })

      ancestors.delete(value)

      return result
    }

    return value
  }

  private assertCompletedWorkMatches(workTask: WorkTask, completedWork: CompletedWork): void {
    if (completedWork.key !== workTask.key || completedWork.kind !== workTask.handler.kind) {
      throw new ForgeInternalError(
        `Completed work "${completedWork.key}" of kind "${completedWork.kind}" does not match task "${workTask.key}" of kind "${workTask.handler.kind}"`,
      )
    }
  }

  private assertNotCyclic(value: object, ancestors: WeakSet<object>): void {
    if (ancestors.has(value)) {
      throw new ForgeInternalError('Cannot walk cyclic work task props')
    }
  }

  private isPlainRecord(value: unknown): value is Record<PropertyKey, unknown> {
    if (value === undefined || value === null || typeof value !== 'object' || Array.isArray(value)) {
      return false
    }

    const prototype = Object.getPrototypeOf(value)

    return prototype === Object.prototype || prototype === null
  }

  private isMalformedWorkTask(value: unknown): boolean {
    return this.isPlainRecord(value) && value.$$typeof === FORGE_WORK
  }

  private getEnumerableEntries(value: Record<PropertyKey, unknown>): readonly (readonly [PropertyKey, unknown])[] {
    return Reflect.ownKeys(value)
      .filter(key => Object.prototype.propertyIsEnumerable.call(value, key))
      .map(key => [key, value[key]])
  }
}
