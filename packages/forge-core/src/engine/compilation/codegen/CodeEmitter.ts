/**
 * Helper for building JavaScript source strings for generated Functions.
 *
 * Generated code is intentionally inspectable because these compilers replace a
 * lot of request-time interpretation. Stable indentation and unique variable
 * names make failures much easier to map back to the source compiler.
 */
export default class CodeEmitter {
  private readonly lines: string[] = []

  private depth = 0

  private varCounter = 0

  constructor(varCounter = 0) {
    this.varCounter = varCounter
  }

  fork(): CodeEmitter {
    return new CodeEmitter(this.varCounter)
  }

  syncVariablesFrom(other: CodeEmitter): void {
    this.varCounter = Math.max(this.varCounter, other.varCounter)
  }

  /**
   * Prefixes are chosen by each compiler so the emitted source tells you which
   * part of the journey evaluation produced a temporary value.
   */
  nextVar(prefix = '_v'): string {
    return `${prefix}${this.varCounter++}`
  }

  emit(line: string): void {
    this.lines.push('  '.repeat(this.depth) + line)
  }

  emitBlank(): void {
    this.lines.push('')
  }

  indent(): void {
    this.depth++
  }

  dedent(): void {
    this.depth = Math.max(0, this.depth - 1)
  }

  /**
   * Centralises brace indentation so source generators can focus on evaluation
   * order instead of hand-building nested whitespace.
   */
  emitBlock(header: string, body: () => void): void {
    this.emit(`${header} {`)
    this.indent()
    body()
    this.dedent()
    this.emit('}')
  }

  toString(): string {
    return this.lines.join('\n')
  }
}
