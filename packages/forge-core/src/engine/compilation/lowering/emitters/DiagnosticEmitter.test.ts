import DiagnosticEmitter from './DiagnosticEmitter'

const AUTHOR_STACK = 'Error\n    at journeySteps (/repo/journeys/tax/steps.ts:42:13)'
const INTERNAL_STACK = 'Error\n    at handle (/repo/packages/forge-core/src/registry/handles.ts:7:9)'
const EXPECTED_MARKER = '/*@forge-pos:{"f":"/repo/journeys/tax/steps.ts","l":42,"c":13}*/'

const sourceWithStack = (stack: string) => ({
  id: 'node-1',
  diagnostics: {
    source: { formattedPath: 'journey.steps[0]' },
    callsite: { stack },
  },
})

describe('DiagnosticEmitter', () => {
  describe('wrapExpression()', () => {
    it('should prefix the helper call with a position marker when the callsite resolves', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', sourceWithStack(AUTHOR_STACK), false)

      // Assert
      expect(wrapped.startsWith(`${EXPECTED_MARKER}_forgeHelpers.evaluateTracked(`)).toBe(true)
    })

    it('should place the marker before the await wrapper when the expression is async', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', sourceWithStack(AUTHOR_STACK), true)

      // Assert
      expect(wrapped.startsWith(`${EXPECTED_MARKER}(await _forgeHelpers.evaluateTrackedAsync(`)).toBe(true)
    })

    it('should emit no marker when the callsite is absent', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = { id: 'node-1', diagnostics: { source: { formattedPath: 'journey.steps[0]' } } }

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', source, false)

      // Assert
      expect(wrapped.startsWith('_forgeHelpers.evaluateTracked(')).toBe(true)
      expect(wrapped).not.toContain('@forge-pos')
    })

    it('should emit no marker when every callsite frame is forge-internal', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', sourceWithStack(INTERNAL_STACK), false)

      // Assert
      expect(wrapped).not.toContain('@forge-pos')
    })

    it('should emit one marker per author chain frame when a helper built the node', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const chainStack = [
        'Error',
        '    at loadContent (/app/server/journeys/guide/effects.ts:56:14)',
        '    at definingSteps (/app/server/journeys/guide/sections/defining-steps/step.ts:10:14)',
      ].join('\n')

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', sourceWithStack(chainStack), false)

      // Assert
      const helperMarker = '/*@forge-pos:{"f":"/app/server/journeys/guide/effects.ts","l":56,"c":14}*/'
      const wiringMarker =
        '/*@forge-pos:{"f":"/app/server/journeys/guide/sections/defining-steps/step.ts","l":10,"c":14}*/'
      expect(wrapped.startsWith(`${helperMarker}${wiringMarker}_forgeHelpers.evaluateTracked(`)).toBe(true)
    })

    it('should return the raw expression when the source carries no metadata at all', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', undefined, false)

      // Assert
      expect(wrapped).toBe('1 + 1')
    })

    it('should omit undefined metadata fields from the emitted literal', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = { id: 'node-1', diagnostics: { source: { formattedPath: 'journey.steps[0]' } } }

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', source, false)

      // Assert
      expect(wrapped).toContain('nodeId: "node-1"')
      expect(wrapped).toContain('formattedPath: "journey.steps[0]"')
      expect(wrapped).not.toContain('undefined')
    })

    it('should name the tracked callback after the formatted path tail', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = {
        id: 'node-1',
        diagnostics: { source: { formattedPath: 'dump > form > blocks[1] (govukInsetText) > hidden' } },
      }

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', source, false)

      // Assert
      expect(wrapped).toContain('function evaluate_hidden() {')
    })

    it('should sanitise a structural path tail into a valid callback identifier', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = {
        id: 'node-1',
        diagnostics: { source: { formattedPath: 'dump > onAccess[0] > effects[0] (effect - Ping)' } },
      }

      // Act
      const wrapped = emitter.wrapExpression('1 + 1', source, false)

      // Assert
      expect(wrapped).toContain('function evaluate_effects_0_effect_Ping() {')
    })
  })

  describe('wrapFunctionCall()', () => {
    it('should prefix the helper call with a position marker when the callsite resolves', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = emitter.wrapFunctionCall(
        'callFunction',
        'loadPreferences',
        ['ctx'],
        sourceWithStack(AUTHOR_STACK),
      )

      // Assert
      expect(wrapped.startsWith(`${EXPECTED_MARKER}_forgeHelpers.callFunction(`)).toBe(true)
    })

    it('should emit no marker when the callsite is absent', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = emitter.wrapFunctionCall('callFunction', 'loadPreferences', ['ctx'], {})

      // Assert
      expect(wrapped.startsWith('_forgeHelpers.callFunction(')).toBe(true)
      expect(wrapped).not.toContain('@forge-pos')
    })
  })
})
