import { SourceMapSegment } from './SourceRenderer'

/**
 * Encodes renderer source-map segments as an inline `data:` source-map URL so
 * debuggers can bind definition-file breakpoints onto compiled functions.
 * `lineOffset` prepends empty mapping lines for the wrapper V8 builds around
 * `new Function` bodies, aligning generated line indexes with the final script.
 */
export const encodeInlineSourceMap = (
  segmentsByLine: readonly (readonly SourceMapSegment[])[],
  lineOffset: number,
): string => {
  const sources: string[] = []
  const sourceIndexes = new Map<string, number>()

  const sourceIndexOf = (file: string): number => {
    const existing = sourceIndexes.get(file)

    if (existing !== undefined) {
      return existing
    }

    sources.push(file)
    sourceIndexes.set(file, sources.length - 1)

    return sources.length - 1
  }

  // Generated-column deltas reset per line; source fields carry across the
  // whole mappings string. Source-map coordinates are 0-based; captured
  // positions are 1-based.
  let previousSourceIndex = 0
  let previousSourceLine = 0
  let previousSourceColumn = 0

  const mappingLines = segmentsByLine.map(segments => {
    let previousGeneratedColumn = 0

    return (
      segments
        .map(segment => {
          const sourceIndex = sourceIndexOf(segment.position.file)
          const encoded = [
            segment.generatedColumn - previousGeneratedColumn,
            sourceIndex - previousSourceIndex,
            segment.position.line - 1 - previousSourceLine,
            segment.position.column - 1 - previousSourceColumn,
          ]
            .map(encodeVlq)
            .join('')

          previousGeneratedColumn = segment.generatedColumn
          previousSourceIndex = sourceIndex
          previousSourceLine = segment.position.line - 1
          previousSourceColumn = segment.position.column - 1

          return encoded
        })
        .join(',')
    )
  })

  const mappings = [...Array<string>(lineOffset).fill(''), ...mappingLines].join(';')
  const sourceMap = { version: 3, sources, names: [], mappings }

  return `data:application/json;base64,${encodeBase64(JSON.stringify(sourceMap))}`
}

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

// Pure JS so the encoder runs in browsers too - `Buffer` is Node-only and `btoa` cannot take
// multi-byte characters without a byte-mangling detour.
/* eslint-disable no-bitwise -- base64 is a bit-packing format */
const encodeBase64 = (value: string): string => {
  const bytes = new TextEncoder().encode(value)
  let encoded = ''

  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = [bytes[index], bytes[index + 1], bytes[index + 2]]
    const bits = (chunk[0] << 16) | ((chunk[1] ?? 0) << 8) | (chunk[2] ?? 0)

    encoded += BASE64_ALPHABET[(bits >> 18) & 63]
    encoded += BASE64_ALPHABET[(bits >> 12) & 63]
    encoded += chunk[1] === undefined ? '=' : BASE64_ALPHABET[(bits >> 6) & 63]
    encoded += chunk[2] === undefined ? '=' : BASE64_ALPHABET[bits & 63]
  }

  return encoded
}
/* eslint-enable no-bitwise */

const VLQ_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/* eslint-disable no-bitwise -- VLQ is a bit-packing format */
const encodeVlq = (value: number): string => {
  let remaining = value < 0 ? (-value << 1) | 1 : value << 1
  let encoded = ''

  do {
    let digit = remaining & 31

    remaining >>>= 5

    if (remaining > 0) {
      digit |= 32
    }

    encoded += VLQ_ALPHABET[digit]
  } while (remaining > 0)

  return encoded
}
