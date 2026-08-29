import { FunctionEntryType } from '../../shared/taxonomy'
import { CONDITION_OUTPUT_SCHEMA } from '../registries/BaseFunctionRegistry'
import { getEntryStamp } from '../builders/utils/stampEntry'
import { isFunctionEntry } from './createEntry'
import ForgeAuthoringError from '../../engine/errors/ForgeAuthoringError'
import ForgeRegistryDuplicateError from '../../engine/errors/ForgeRegistryDuplicateError'
import ForgeFunctionEntryBuildError from '../../engine/errors/ForgeFunctionEntryBuildError'
import type { DSLSourceLocation } from '../../shared/diagnostics/sourceLocation.type'
import type { FunctionEntry, FunctionRegistryBuilder, FunctionRegistryObject } from '../types/functions.type'

// Anonymous entries have no author name, so their registry name falls back to
// the helper that created them.
const ANONYMOUS_LABELS: Record<FunctionEntryType, string> = {
  [FunctionEntryType.CONDITION]: 'condition',
  [FunctionEntryType.TRANSFORMER]: 'transformer',
  [FunctionEntryType.GENERATOR]: 'generator',
  [FunctionEntryType.EFFECT]: 'effect',
}

/**
 * A function registry assembled from function entries (created by the
 * authoring `condition()` / `transformer()` / `generator()` / `effect()`
 * helpers). `createForgePackage()` builds one per package: listed entries and
 * entries embedded in the journey collect into it, and from then on the
 * package carries an ordinary registry - the engine builds it with
 * dependencies at registration exactly like a `BaseFunctionRegistry`.
 *
 * Collection assigns each distinct entry - distinct by pointer identity - a
 * unique registry name. An entry's name is its author name (or an anonymous
 * label) untouched; only when a *different* entry already claimed that name
 * does it become `name@2`, `name@3`, ... Embedded expressions found during the
 * journey walk are renamed in place to whatever their entry was assigned, so
 * by compilation time expression names and registry rows agree.
 *
 * Listed entries (`functions: [...]`) are the exception: listing promises that
 * exact name to external references (e.g. plain JSON journeys), so a second
 * entry listed under the same name throws instead of being renamed.
 *
 * `build()` runs each entry's factory exactly once; an entry that is both
 * listed and embedded shares one evaluator and one name. Factory failures are
 * gathered and thrown together so every broken factory is reported in one
 * pass.
 */
export class FunctionEntryRegistry<TDeps = any> implements FunctionRegistryBuilder<TDeps> {
  private readonly assignedNames = new Map<FunctionEntry, string>()

  private readonly claimedNames = new Map<string, FunctionEntry>()

  private readonly entriesByName = new Map<string, FunctionEntry>()

  private readonly expressions = new Map<FunctionEntry, object>()

  /** Registers a listed entry under its exact author name. Listing requires a name. */
  collectListed(entry: FunctionEntry): void {
    if (!entry.name) {
      throw new ForgeAuthoringError({
        message:
          `An anonymous ${entry._forge} entry cannot be listed in "functions" - ` +
          `give it a name, e.g. condition('MyCondition', { ... })`,
      })
    }

    const existing = this.claimedNames.get(entry.name)

    if (existing === entry) {
      return
    }

    if (existing) {
      throw new ForgeRegistryDuplicateError({
        registryType: 'function',
        itemName: entry.name,
        message:
          `Two function entries are listed under the name "${entry.name}" - ` +
          'listed entry names must be unique within their scope',
      })
    }

    this.claimedNames.set(entry.name, entry)
    this.assignedNames.set(entry, entry.name)
    this.entriesByName.set(entry.name, entry)
  }

  /** Registers an entry under its assigned name, and returns that name. */
  collect(entry: FunctionEntry): string {
    const name = this.nameFor(entry)

    this.entriesByName.set(name, entry)

    return name
  }

  /**
   * Walks a finalised journey definition, registers the entry behind every
   * `__entry`-stamped expression, and rewrites each expression's `name` to the
   * entry's assigned name.
   */
  collectEmbedded(root: unknown): void {
    this.walk(root, new WeakSet())
  }

  /** Whether any entries were collected. */
  hasEntries(): boolean {
    return this.entriesByName.size > 0
  }

  /**
   * Builds the registry rows, running each entry's factory once with the given
   * dependencies. Throws every factory failure at once.
   */
  build(deps?: TDeps): FunctionRegistryObject {
    const resolvedDeps = (deps ?? {}) as TDeps
    const rows: FunctionRegistryObject = {}
    const errors: Error[] = []

    this.entriesByName.forEach((entry, name) => {
      try {
        const evaluate = entry.factory(resolvedDeps)

        rows[name] = {
          name,
          evaluate,
          inputSchema: entry.inputSchema,
          argumentsSchema: entry.argumentsSchema,
          outputSchema:
            entry.outputSchema ?? (entry._forge === FunctionEntryType.CONDITION ? CONDITION_OUTPUT_SCHEMA : undefined),
          _forge: entry._forge,
        }
      } catch (cause) {
        errors.push(this.buildError(name, entry, cause))
      }
    })

    if (errors.length > 0) {
      throw new AggregateError(errors, 'Function registration failed')
    }

    return rows
  }

  private walk(node: unknown, seen: WeakSet<object>): void {
    if (node === null || typeof node !== 'object' || seen.has(node)) {
      return
    }

    seen.add(node)

    const entry = getEntryStamp(node)

    if (entry && isFunctionEntry(entry)) {
      const name = this.collect(entry)

      ;(node as { name?: string }).name = name

      if (!this.expressions.has(entry)) {
        this.expressions.set(entry, node)
      }
    }

    if (Array.isArray(node)) {
      node.forEach(item => this.walk(item, seen))

      return
    }

    Object.values(node).forEach(value => this.walk(value, seen))
  }

  private nameFor(entry: FunctionEntry): string {
    const assigned = this.assignedNames.get(entry)

    if (assigned) {
      return assigned
    }

    const base = entry.name ?? ANONYMOUS_LABELS[entry._forge]
    let candidate = base
    let suffix = 1

    while (this.claimedNames.has(candidate)) {
      suffix += 1
      candidate = `${base}@${suffix}`
    }

    this.claimedNames.set(candidate, entry)
    this.assignedNames.set(entry, candidate)

    return candidate
  }

  private buildError(name: string, entry: FunctionEntry, cause: unknown): Error {
    const expression = this.expressions.get(entry)
    const source = expression
      ? (Object.getOwnPropertyDescriptor(expression, '__source')?.value as DSLSourceLocation | undefined)
      : undefined
    const callsite = expression
      ? (Object.getOwnPropertyDescriptor(expression, '__callsite')?.value as { stack?: string } | undefined)
      : undefined

    return new ForgeFunctionEntryBuildError({
      functionName: name,
      functionType: entry._forge,
      formattedPath: source?.formattedPath,
      callsite,
      cause,
    })
  }
}
