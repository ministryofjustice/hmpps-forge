import { Code, code } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import SourceRenderer, { RenderedSource } from '../../codegen/SourceRenderer'
import DiagnosticEmitter from './DiagnosticEmitter'

const AUTHOR_STACK = 'Error\n    at journeySteps (/repo/journeys/tax/steps.ts:42:13)'
const INTERNAL_STACK = 'Error\n    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)'
const AUTHOR_POSITION = { file: '/repo/journeys/tax/steps.ts', line: 42, column: 13 }

const sourceWithStack = (stack: string) => ({
  id: 'node-1',
  diagnostics: {
    source: { formattedPath: 'journey.steps[0]' },
    callsite: { stack },
  },
})

const render = (value: Code): RenderedSource => new SourceRenderer().renderCode(value)

const wrapExpression = (emitter: DiagnosticEmitter, source: unknown, usesAwait: boolean): RenderedSource =>
  render(emitter.wrapExpression(code`1 + 1`, source, usesAwait, new CodeGenerator()))

describe('DiagnosticEmitter', () => {
  describe('wrapExpression()', () => {
    it('should map the helper call to the authored callsite', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = wrapExpression(emitter, sourceWithStack(AUTHOR_STACK), false)

      // Assert
      expect(wrapped.source.startsWith('_forgeHelpers.evaluateTracked(')).toBe(true)
      expect(wrapped.segmentsByLine[0]).toEqual([{ generatedColumn: 0, position: AUTHOR_POSITION }])
    })

    it('should map the await wrapper to the authored callsite', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = wrapExpression(emitter, sourceWithStack(AUTHOR_STACK), true)

      // Assert
      expect(wrapped.source.startsWith('(await _forgeHelpers.evaluateTrackedAsync(')).toBe(true)
      expect(wrapped.segmentsByLine[0]).toEqual([{ generatedColumn: 0, position: AUTHOR_POSITION }])
    })

    it('should emit no source-map segment when the callsite is absent', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = { id: 'node-1', diagnostics: { source: { formattedPath: 'journey.steps[0]' } } }

      // Act
      const wrapped = wrapExpression(emitter, source, false)

      // Assert
      expect(wrapped.source.startsWith('_forgeHelpers.evaluateTracked(')).toBe(true)
      expect(wrapped.segmentsByLine.flat()).toEqual([])
    })

    it('should emit no source-map segment when every callsite frame is internal', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = wrapExpression(emitter, sourceWithStack(INTERNAL_STACK), false)

      // Assert
      expect(wrapped.segmentsByLine.flat()).toEqual([])
    })

    it('should map every author chain frame in helper-to-author order', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const chainStack = [
        'Error',
        '    at loadContent (/app/server/journeys/guide/effects.ts:56:14)',
        '    at definingSteps (/app/server/journeys/guide/sections/defining-steps/step.ts:10:14)',
      ].join('\n')

      // Act
      const wrapped = wrapExpression(emitter, sourceWithStack(chainStack), false)

      // Assert
      expect(wrapped.segmentsByLine[0]).toEqual([
        {
          generatedColumn: 0,
          position: { file: '/app/server/journeys/guide/effects.ts', line: 56, column: 14 },
        },
        {
          generatedColumn: 1,
          position: { file: '/app/server/journeys/guide/sections/defining-steps/step.ts', line: 10, column: 14 },
        },
      ])
    })

    it('should return the raw expression when the source carries no metadata', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = wrapExpression(emitter, undefined, false)

      // Assert
      expect(wrapped.source).toBe('1 + 1')
      expect(wrapped.segmentsByLine.flat()).toEqual([])
    })

    it('should omit undefined metadata fields from the emitted literal', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = { id: 'node-1', diagnostics: { source: { formattedPath: 'journey.steps[0]' } } }

      // Act
      const wrapped = wrapExpression(emitter, source, false).source

      // Assert
      expect(wrapped).toContain('"nodeId": "node-1"')
      expect(wrapped).toContain('"formattedPath": "journey.steps[0]"')
      expect(wrapped).not.toContain('undefined')
    })

    it('should name and sanitise tracked callbacks from the formatted path tail', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = {
        id: 'node-1',
        diagnostics: { source: { formattedPath: 'dump > onAccess[0] > effects[0] (effect - Ping)' } },
      }

      // Act
      const wrapped = wrapExpression(emitter, source, false).source

      // Assert
      expect(wrapped).toContain('function evaluate_effects_0_effect_Ping() {')
    })
  })

  describe('wrapFunctionCall()', () => {
    it('should map a tracked function helper call to the authored callsite', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = render(
        emitter.wrapFunctionCall('callFunction', 'loadPreferences', [code`ctx`], sourceWithStack(AUTHOR_STACK)),
      )

      // Assert
      expect(wrapped.source.startsWith('_forgeHelpers.callFunction(')).toBe(true)
      expect(wrapped.segmentsByLine[0]).toEqual([{ generatedColumn: 0, position: AUTHOR_POSITION }])
    })

    it('should emit no segment for a function call without a callsite', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = render(emitter.wrapFunctionCall('callFunction', 'loadPreferences', [code`ctx`], {}))

      // Assert
      expect(wrapped.source.startsWith('_forgeHelpers.callFunction(')).toBe(true)
      expect(wrapped.segmentsByLine.flat()).toEqual([])
    })
  })
})
