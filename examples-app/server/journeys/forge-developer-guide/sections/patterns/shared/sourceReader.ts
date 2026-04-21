import fs from 'node:fs'
import path from 'node:path'

// The pattern sources are copied into
// dist/journeys/forge-developer-guide/sections/patterns at build time
// (see rolldown/configs.js). The bundle itself sits at dist/server.js, so
// __dirname is usually dist/. We fall back to other likely roots for test
// runners or direct source execution.
const PATTERNS_SUBPATH = 'journeys/forge-developer-guide/sections/patterns'

const candidateRoots = [
  path.join(__dirname, PATTERNS_SUBPATH),
  path.join(process.cwd(), 'dist', PATTERNS_SUBPATH),
  path.join(process.cwd(), 'server', PATTERNS_SUBPATH),
  path.join(process.cwd(), 'examples-app/dist', PATTERNS_SUBPATH),
  path.join(process.cwd(), 'examples-app/server', PATTERNS_SUBPATH),
]

const resolvedRoot = candidateRoots.find(candidate => fs.existsSync(candidate))

export function readPatternSource(relativePath: string): string {
  if (!resolvedRoot) {
    throw new Error(
      `Could not locate patterns root. Tried: ${candidateRoots.join(', ')}. ` +
        `Make sure the build copies patterns .ts files into dist.`,
    )
  }

  const fullPath = path.join(resolvedRoot, relativePath)

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Pattern source not found: ${relativePath} (resolved to ${fullPath}). ` +
        `Check that the path is correct and the file exists under ${PATTERNS_SUBPATH}.`,
    )
  }

  return fs.readFileSync(fullPath, 'utf-8')
}
