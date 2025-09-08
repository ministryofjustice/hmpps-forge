type Row = { label: string; value?: unknown }

type BoxOptions = {
  /** Inner text width (excluding borders). Default: 58 */
  width?: number
  /** Box title. Default: "FormEngineDetails" */
  title?: string
}

const CHARS = {
  tl: '┌',
  tr: '┐',
  bl: '└',
  br: '┘',
  h: '─',
  v: '│',
} as const

const DEFAULTS = {
  width: 58,
  minWidth: 30,
  minLabelWidth: 4,
  minValueWidth: 10,
  title: 'FormEngineDetails',
  emptyMessage: '(no details)',
  pairSeparator: ' : ',
} as const

/** True if a value should be rendered (not undefined/null/empty-string when stringified). */
const isPresent = (v: unknown): boolean => v !== undefined && v !== null && String(v) !== ''

/** Convert a value into a single-line string for display. Arrays join with ", ". */
const stringify = (v: unknown): string => (Array.isArray(v) ? v.join(', ') : String(v))

/** Word-wrap text to a given max length. Preserves words; breaks very long words. */
const wrapText = (text: string, max: number): string[] => {
  const words = text.replace(/\s+/g, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''

  for (const w of words) {
    const candidate = line ? `${line} ${w}` : w

    if (candidate.length <= max) {
      line = candidate
    } else {
      if (line) lines.push(line)

      if (w.length > max) {
        for (let i = 0; i < w.length; i += max) {
          lines.push(w.slice(i, i + max))
        }
        line = ''
      } else {
        line = w
      }
    }
  }

  if (line) lines.push(line)
  return lines.length ? lines : ['']
}

/** Build the decorative top border containing the title. */
const buildTopBorder = (title: string, innerWidth: number): string => {
  const headerWidth = innerWidth + 2 // one space padding on each side inside the box
  const lead = '─ '
  const titleSeg = `${title} `
  const taken = lead.length + titleSeg.length
  const fillCount = Math.max(0, headerWidth - taken)

  return `${CHARS.tl}${lead}${titleSeg}${CHARS.h.repeat(fillCount)}${CHARS.tr}`
}

/** Build the bottom border. */
const buildBottomBorder = (innerWidth: number): string => `${CHARS.bl}${CHARS.h.repeat(innerWidth + 2)}${CHARS.br}`

/** Surround a line with vertical borders and single-space padding. */
const frameLine = (s: string, innerWidth: number): string => `${CHARS.v} ${s.padEnd(innerWidth, ' ')} ${CHARS.v}`

export function formatBox(rows: Row[] | string, opts: BoxOptions = {}): string {
  const innerWidth = Math.max(DEFAULTS.minWidth, opts.width ?? DEFAULTS.width)
  const title = opts.title ?? DEFAULTS.title

  const bodyLines: string[] = []

  if (typeof rows === 'string') {
    // Single message mode
    bodyLines.push(...wrapText(rows, innerWidth))
  } else {
    // Rows mode
    const visibleRows = rows.filter(r => isPresent(r.value))

    const labelWidth = Math.max(DEFAULTS.minLabelWidth, ...visibleRows.map(r => r.label.length))

    // LABEL + space + ":" + space + VALUE
    const valueWidth = Math.max(DEFAULTS.minValueWidth, innerWidth - (labelWidth + DEFAULTS.pairSeparator.length))

    for (const r of visibleRows) {
      const raw = stringify(r.value)
      const wrapped = wrapText(raw, valueWidth)

      wrapped.forEach((chunk, i) => {
        const label = (i === 0 ? r.label : '').padEnd(labelWidth, ' ')
        bodyLines.push(`${label}${DEFAULTS.pairSeparator}${chunk}`)
      })
    }
  }

  const contentLines =
    bodyLines.length > 0
      ? bodyLines.map(line => frameLine(line, innerWidth))
      : [frameLine(DEFAULTS.emptyMessage, innerWidth)]

  return [buildTopBorder(title, innerWidth), ...contentLines, buildBottomBorder(innerWidth)].join('\n')
}
