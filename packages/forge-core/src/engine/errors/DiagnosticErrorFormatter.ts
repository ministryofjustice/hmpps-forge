import { isInternalFrame } from '../../shared/diagnostics/formatCallsite'

export interface RuntimeDiagnosticFields {
  readonly phase: string
  readonly formattedPath?: string
  readonly functionName?: string
  readonly functionType?: string
}

const FRAME_PATTERN = /^\s+at /

/**
 * Renders the author-facing sections of a forge error's `stack`: the
 * diagnostics block and the folded frame list. Indentation is deliberate —
 * the block header sits at frame depth (4 spaces) with fields nested at 6, so
 * Node's `[cause]:` (fixed at 2 spaces in `util.inspect`) visibly outdents as
 * a sibling of the whole error instead of reading as another diagnostics
 * field.
 */
export default class DiagnosticErrorFormatter {
  static formatRuntimeDiagnostics(diagnostics: RuntimeDiagnosticFields): string {
    const formattedFields = [
      { label: 'Phase', value: diagnostics.phase },
      { label: 'Path', value: diagnostics.formattedPath },
      { label: 'Function', value: diagnostics.functionName },
      { label: 'Type', value: diagnostics.functionType },
    ]
      .filter(field => field.value !== undefined)
      .map(field => `      ${field.label}: ${field.value}`)

    return ['    Forge diagnostics:', ...formattedFields].join('\n')
  }

  static extractStackFrames(stack: string | undefined): string[] {
    if (stack === undefined) {
      return []
    }

    return stack
      .split('\n')
      .filter(line => FRAME_PATTERN.test(line))
      .map(line => line.replace(FRAME_PATTERN, ''))
  }

  /**
   * Collapses each consecutive run of forge-internal frames into one summary
   * line naming the run's first and last frame. Author frames always render.
   * The summary line deliberately does not match the `at ...` frame grammar so
   * error trackers never ingest it as an execution frame.
   */
  static foldStackFrames(frames: string[]): string[] {
    const folded: string[] = []
    let internalRun: string[] = []

    const flushRun = (): void => {
      if (internalRun.length === 0) {
        return
      }

      folded.push(DiagnosticErrorFormatter.formatFoldedRun(internalRun))
      internalRun = []
    }

    frames.forEach(frame => {
      if (isInternalFrame(frame)) {
        internalRun.push(frame)

        return
      }

      flushRun()
      folded.push(`    at ${frame}`)
    })
    flushRun()

    return folded
  }

  private static formatFoldedRun(run: string[]): string {
    if (run.length === 1) {
      return `    ... 1 forge frame (${frameName(run[0])}) — FORGE_FULL_STACK=1 to expand`
    }

    const summary = `${frameName(run[0])} → ${frameName(run[run.length - 1])}`

    return `    ... ${run.length} forge frames (${summary}) — FORGE_FULL_STACK=1 to expand`
  }
}

const frameName = (frame: string): string => {
  const parenIndex = frame.indexOf(' (')

  return parenIndex === -1 ? frame : frame.slice(0, parenIndex)
}
