// Strips demo-specific wrapping from a pattern source file so the rendered
// code panel looks like an ordinary Forge step — the same code an adopter
// would write in their own project.
//
// Transforms applied:
//   1. `patternStep(` → `step(`
//   2. Remove the `import { patternStep } from '.../patternStep'` line
//   3. Ensure `step` is imported from the Forge authoring module
//   4. Drop the `sourceBase`, `codeFiles`, `templateLocals` properties from
//      the call

const FORGE_AUTHORING_MODULE = '@ministryofjustice/hmpps-forge/core/authoring'
const DEMO_ONLY_KEYS = ['sourceBase', 'codeFiles', 'templateLocals']
const PATTERN_STEP_IMPORT_RE = /^import\s*\{\s*patternStep\s*\}\s*from\s*['"][^'"]+['"]\s*;?\s*\n/m

export function sanitiseForDisplay(source: string): string {
  let out = source

  out = out.replace(/\bpatternStep\(/g, 'step(')
  out = out.replace(PATTERN_STEP_IMPORT_RE, '')
  out = ensureStepImport(out)

  for (const key of DEMO_ONLY_KEYS) {
    out = stripTopLevelKey(out, key)
  }

  return out
}

function ensureStepImport(source: string): string {
  if (!/\bstep\(/.test(source)) {
    return source
  }

  const escapedModule = FORGE_AUTHORING_MODULE.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  const existingImport = new RegExp(
    `^(import\\s*\\{)([^}]+)(\\}\\s*from\\s*['"]${escapedModule}['"])`,
    'm',
  )
  const match = existingImport.exec(source)

  if (match) {
    const names = match[2]
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    if (names.includes('step')) {
      return source
    }

    const merged = ['step', ...names].join(', ')
    const replacement = `${match[1]} ${merged} ${match[3]}`

    return source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length)
  }

  return `import { step } from '${FORGE_AUTHORING_MODULE}'\n${source}`
}

/**
 * Removes a top-level `key: value,` entry from an object literal in the source.
 * Tracks bracket depth and string state so multi-line values (arrays, objects,
 * strings with commas or braces) are handled correctly.
 *
 * Targets only keys at the start of a line (with leading indentation), which is
 * the shape our step objects use.
 */
function stripTopLevelKey(source: string, key: string): string {
  const startRe = new RegExp(`(^|\\n)(\\s+)${key}:\\s*`)
  const match = startRe.exec(source)

  if (!match) {
    return source
  }

  const matchLeadingNewline = match[1]
  const entryStart = match.index + matchLeadingNewline.length
  const valueStart = match.index + match[0].length

  let depth = 0
  let inString: null | "'" | '"' | '`' = null
  let i = valueStart

  while (i < source.length) {
    const ch = source[i]

    if (inString) {
      if (ch === '\\') {
        i += 2
      } else {
        if (ch === inString) {
          inString = null
        }
        i += 1
      }
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch
      } else if (ch === '{' || ch === '[' || ch === '(') {
        depth += 1
      } else if (ch === '}' || ch === ']' || ch === ')') {
        if (depth === 0) {
          break
        }
        depth -= 1
      } else if (ch === ',' && depth === 0) {
        i += 1
        break
      }

      i += 1
    }
  }

  while (i < source.length && (source[i] === ' ' || source[i] === '\t')) {
    i += 1
  }

  if (source[i] === '\n') {
    i += 1
  }

  return source.slice(0, entryStart) + source.slice(i)
}
