/**
 * A minimal logger interface compatible with pino, bunyan, console, and most logging libraries.
 */
export interface Logger {
  info(...args: unknown[]): void
  error(...args: unknown[]): void
  warn(...args: unknown[]): void
  debug(...args: unknown[]): void
}
