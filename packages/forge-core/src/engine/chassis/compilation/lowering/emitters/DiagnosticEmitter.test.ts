import { CodeFragment, code } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import SourceRenderer, { RenderedSource } from '../codegen/rendering/SourceRenderer'
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

const render = (value: CodeFragment): RenderedSource => new SourceRenderer().renderCode(value)

const wrapExpression = (emitter: DiagnosticEmitter, source: unknown, _usesAwait: boolean): RenderedSource => {
  const generator = CodeGenerator.forFunction([])
  const expression = emitter.compileExpression(source, generator, () => code`1 + 1`)

  generator.return(expression)

  return new SourceRenderer().render(generator.toNodes())
}

describe('DiagnosticEmitter', () => {
  describe('compileExpression()', () => {
    it('should map the generated diagnostic boundary to the authored callsite', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = wrapExpression(emitter, sourceWithStack(AUTHOR_STACK), false)
      // Assert
      expect(wrapped.source).toContain('try {')
      expect(wrapped.source).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(wrapped.segmentsByLine.flat()).toContainEqual(expect.objectContaining({ position: AUTHOR_POSITION }))
    })

    it('should not create a separate async diagnostic callback', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      // Act
      const wrapped = wrapExpression(emitter, sourceWithStack(AUTHOR_STACK), true)

      // Assert
      expect(wrapped.source).toContain('try {')
      expect(wrapped.source).not.toContain('evaluateTracked')
      expect(wrapped.source).not.toContain('async function')
    })

    it('should emit no source-map segment when the callsite is absent', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = { id: 'node-1', diagnostics: { source: { formattedPath: 'journey.steps[0]' } } }

      // Act
      const wrapped = wrapExpression(emitter, source, false)

      // Assert
      expect(wrapped.source).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
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
      expect(wrapped.segmentsByLine.flat().slice(0, 2)).toEqual([
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
      expect(wrapped.source).toBe('return 1 + 1;')
      expect(wrapped.segmentsByLine.flat()).toEqual([])
    })

    it('should store only defined metadata outside the generated source', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = { id: 'node-1', diagnostics: { source: { formattedPath: 'journey.steps[0]' } } }

      // Act
      const wrapped = wrapExpression(emitter, source, false).source
      const catalogue = emitter.snapshot()

      // Assert
      expect(wrapped).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(wrapped).not.toContain('node-1')
      expect(wrapped).not.toContain('journey.steps[0]')
      expect(catalogue).toEqual([{ nodeId: 'node-1', formattedPath: 'journey.steps[0]' }])
    })

    it('should reuse a reference when diagnostic metadata is identical', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = sourceWithStack(AUTHOR_STACK)

      // Act
      const first = wrapExpression(emitter, source, false).source
      const second = wrapExpression(emitter, source, false).source

      // Assert
      expect(first).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(second).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(emitter.snapshot()).toHaveLength(1)
    })

    it('should clear diagnostic references between generated functions', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()

      wrapExpression(emitter, sourceWithStack(AUTHOR_STACK), false)

      // Act
      emitter.reset()
      const wrapped = wrapExpression(emitter, { id: 'node-2' }, false).source

      // Assert
      expect(wrapped).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(emitter.snapshot()).toEqual([{ nodeId: 'node-2' }])
    })

    it('should emit no callback for a formatted path', () => {
      // Arrange
      const emitter = new DiagnosticEmitter()
      const source = {
        id: 'node-1',
        diagnostics: { source: { formattedPath: 'dump > onAccess[0] > effects[0] (effect - Ping)' } },
      }

      // Act
      const wrapped = wrapExpression(emitter, source, false).source

      // Assert
      expect(wrapped).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(wrapped).not.toContain('function evaluate_effects_0_effect_Ping()')
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
