import { describe, expect, it } from 'vitest'
import inspector from 'node:inspector'
import { GovUKInsetText, govukComponents } from '@ministryofjustice/hmpps-forge/govuk-components'
import {
  journey,
  step,
  access,
  defineEffectFunctions,
  createForgePackage,
  type EffectFunctionExpr,
} from '../../src/authoring'
import { ForgeTestHarness } from '../../src/testing'

interface SourceMapEffectShape {
  Ping: () => EffectFunctionExpr
}

const { effects: MapEffects, implementations: mapEffectImplementations } = defineEffectFunctions<SourceMapEffectShape>({
  Ping: () => context => {
    context.setData('pinged', 'yes')
  },
})

// A shared wiring helper, mirroring the idiomatic `loadContent(slug)` pattern:
// the effect node is built inside the helper, so its author chain carries both
// the helper's line and the journey line that called it.
const pingAccess = () =>
  access({
    effects: [MapEffects.Ping()],
  })

const sourceMapJourney = journey({
  code: 'maps',
  path: '/maps',
  title: 'Source Maps',
  onAccess: [pingAccess()],
  steps: [
    step({
      path: '/form',
      title: 'Form',
      reachability: { entryWhen: true },
      blocks: [GovUKInsetText({ text: 'Content' })],
    }),
  ],
})

function createSourceMapClient() {
  return new ForgeTestHarness()
    .registerGlobalComponents(govukComponents)
    .registerPackage(
      createForgePackage({
        journey: sourceMapJourney,
        functions: mapEffectImplementations,
      }),
    )
    .createClient()
}

const VLQ_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

interface DecodedMapping {
  generatedLine: number
  generatedColumn: number
  sourceIndex: number
  sourceLine: number
  sourceColumn: number
}

/* eslint-disable no-bitwise -- VLQ is a bit-packing format */
const decodeVlqSegment = (segment: string): number[] => {
  const values: number[] = []
  let shift = 0
  let current = 0

  segment.split('').forEach(char => {
    const digit = VLQ_ALPHABET.indexOf(char)

    current += (digit & 31) << shift

    if ((digit & 32) !== 0) {
      shift += 5

      return
    }

    values.push((current & 1) === 1 ? -(current >>> 1) : current >>> 1)
    shift = 0
    current = 0
  })

  return values
}
/* eslint-enable no-bitwise */

const decodeSourceMapUrl = (sourceMapUrl: string): { sources: string[]; mappings: DecodedMapping[] } => {
  const json = Buffer.from(sourceMapUrl.replace('data:application/json;base64,', ''), 'base64').toString('utf8')
  const map = JSON.parse(json) as { sources: string[]; mappings: string }
  const mappings: DecodedMapping[] = []

  let sourceIndex = 0
  let sourceLine = 0
  let sourceColumn = 0

  map.mappings.split(';').forEach((line, generatedLine) => {
    let generatedColumn = 0

    line
      .split(',')
      .filter(segment => segment.length > 0)
      .forEach(segment => {
        const [generatedColumnDelta, sourceIndexDelta, sourceLineDelta, sourceColumnDelta] = decodeVlqSegment(segment)

        generatedColumn += generatedColumnDelta
        sourceIndex += sourceIndexDelta
        sourceLine += sourceLineDelta
        sourceColumn += sourceColumnDelta
        mappings.push({ generatedLine, generatedColumn, sourceIndex, sourceLine, sourceColumn })
      })
  })

  return { sources: map.sources, mappings }
}

const post = <TResult>(session: inspector.Session, method: string, params?: object): Promise<TResult> =>
  new Promise((resolve, reject) => {
    session.post(method, params, (error: Error | null, result: unknown) => {
      if (error) {
        reject(error)

        return
      }

      resolve(result as TResult)
    })
  })

interface ParsedScript {
  url: string
  sourceMapURL?: string
}

/**
 * Every hooks script whose map claims this test file. Several can qualify at
 * once — `Debugger.enable` replays still-alive scripts from earlier tests'
 * clients — so callers bind to all of them, exactly as an IDE resolves a
 * definition-file breakpoint into every script claiming that file.
 */
const findMappedHooksScripts = (scripts: ParsedScript[]) =>
  scripts
    .filter(
      script =>
        script.url.startsWith('forge:compiled/hooks/') &&
        script.sourceMapURL?.startsWith('data:application/json;base64,') === true,
    )
    .map(script => ({ url: script.url, decoded: decodeSourceMapUrl(script.sourceMapURL ?? '') }))
    .filter(script => script.decoded.sources.some(source => source.endsWith('sourceMaps.test.ts')))

describe('compiled source map contracts', () => {
  it('should advertise hooks scripts with an inline map pointing at the defining file', async () => {
    // Arrange
    const session = new inspector.Session()
    const scripts: ParsedScript[] = []

    session.connect()
    session.on('Debugger.scriptParsed', notification => scripts.push(notification.params))

    try {
      await post(session, 'Debugger.enable')

      const client = createSourceMapClient()

      // Act
      const result = await client.get('/maps/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      const mappedScripts = findMappedHooksScripts(scripts)

      expect(mappedScripts.length).toBeGreaterThan(0)
      expect(mappedScripts[0].decoded.mappings.length).toBeGreaterThan(0)
      expect(mappedScripts[0].decoded.mappings.every(mapping => mapping.sourceLine >= 0)).toBe(true)

      // The effect is built inside `pingAccess`, so its chain maps the helper
      // line and the journey's wiring line — two distinct breakpoint homes.
      const mappedSourceLines = new Set(mappedScripts[0].decoded.mappings.map(mapping => mapping.sourceLine))

      expect(mappedSourceLines.size).toBeGreaterThanOrEqual(2)
    } finally {
      session.disconnect()
    }
  })

  it('should pause on a definition-file breakpoint when the mapped hook evaluates', async () => {
    // Arrange
    const session = new inspector.Session()
    const scripts: ParsedScript[] = []
    const hitBreakpoints: string[] = []

    session.connect()
    session.on('Debugger.scriptParsed', notification => scripts.push(notification.params))
    session.on('Debugger.paused', notification => {
      hitBreakpoints.push(...(notification.params.hitBreakpoints ?? []))
      session.post('Debugger.resume')
    })

    try {
      await post(session, 'Debugger.enable')

      const client = createSourceMapClient()

      await client.get('/maps/form', { session: {} })

      const mappedScripts = findMappedHooksScripts(scripts)

      expect(mappedScripts.length).toBeGreaterThan(0)

      const breakpoints = await Promise.all(
        mappedScripts.map(script =>
          post<{ breakpointId: string; locations: object[] }>(session, 'Debugger.setBreakpointByUrl', {
            url: script.url,
            lineNumber: script.decoded.mappings[0].generatedLine,
            columnNumber: 0,
          }),
        ),
      )

      expect(breakpoints.some(breakpoint => breakpoint.locations.length > 0)).toBe(true)

      // Act
      const result = await client.get('/maps/form', { session: {} })

      // Assert
      expect(result.type).toBe('render')

      const breakpointIds = breakpoints.map(breakpoint => breakpoint.breakpointId)

      expect(hitBreakpoints.some(hit => breakpointIds.includes(hit))).toBe(true)
    } finally {
      session.disconnect()
    }
  })
})
