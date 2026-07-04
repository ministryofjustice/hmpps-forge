// Each rolldown entry point (core, core/authoring) inlines its own copy of this class, so a
// module-level Set would warn once per bundle rather than once per process. The Symbol.for key
// is process-global, so the seen-codes set survives the duplication and dedupes across bundles.
const SEEN_CODES = Symbol.for('forge:deprecations')

interface DeprecationsGlobal {
  [SEEN_CODES]?: Set<string>
}

export class ForgeDeprecations {
  /**
   * Emit a runtime deprecation warning exactly once per process for the given `code`.
   *
   * Warnings go through `process.emitWarning` with `type: 'DeprecationWarning'`, so Node's
   * `--trace-deprecation`, `--throw-deprecation`, and `--no-deprecation` flags apply. Node does
   * not dedupe `emitWarning` itself, so repeated calls for the same `code` are suppressed here.
   */
  static warn(code: string, message: string): void {
    const seen = ForgeDeprecations.seenCodes()

    if (seen.has(code)) {
      return
    }

    seen.add(code)
    process.emitWarning(message, { type: 'DeprecationWarning', code })
  }

  private static seenCodes(): Set<string> {
    const store = globalThis as DeprecationsGlobal
    const existing = store[SEEN_CODES]

    if (existing) {
      return existing
    }

    const seen = new Set<string>()
    store[SEEN_CODES] = seen

    return seen
  }
}
