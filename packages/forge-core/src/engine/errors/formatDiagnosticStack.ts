export default function formatDiagnosticStack(error: Error): string | undefined {
  if (error.stack === undefined) {
    return undefined
  }

  const stackLines = error.stack.split('\n')
  const stackFrames = stackLines.slice(1)

  return [String(error), ...stackFrames].join('\n')
}
