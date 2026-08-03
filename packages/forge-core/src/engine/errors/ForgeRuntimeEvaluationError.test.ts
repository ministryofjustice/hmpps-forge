import ForgeRuntimeEvaluationError, {
  decorateForgeRuntimeEvaluationError,
  FORGE_RUNTIME_EVALUATION_DIAGNOSTICS,
  getForgeRuntimeEvaluationDiagnostics,
} from './ForgeRuntimeEvaluationError'

describe('ForgeRuntimeEvaluationError', () => {
  describe('stack', () => {
    it('should include diagnostic fields when loggers serialise the stack', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({
        phase: 'render',
        nodeId: 'compile_ast:1',
        path: ['steps', 0, 'blocks', 0],
        formattedPath: 'journey > step > blocks[0]',
        functionName: 'explode',
        functionType: 'FunctionType.Generator',
        cause: new Error('boom'),
      })

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('Path: journey > step > blocks[0]')
      expect(stack).toContain('Node: compile_ast:1')
      expect(stack).toContain('Function: explode')
      expect(stack).toContain('Type: FunctionType.Generator')
    })

    it('should include the defined-at frame in the appended diagnostics block', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({
        phase: 'render',
        functionName: 'explode',
        definedAt: 'myJourney (/app/journeys/goals.journey.ts:12:5)',
        cause: new Error('boom'),
      })

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('Forge diagnostics:')
      expect(stack).toContain('Defined at: myJourney (/app/journeys/goals.journey.ts:12:5)')
    })
  })

  describe('decorateForgeRuntimeEvaluationError()', () => {
    it('should preserve the original error and append Forge diagnostics to its stack', () => {
      // Arrange
      const error = new Error('Internal Server Error')

      // Act
      const result = decorateForgeRuntimeEvaluationError(error, {
        phase: 'hooks',
        formattedPath: 'example > / > onAccess[0] > effects[1] (effect - LoadCurrentTime)',
        functionName: 'LoadCurrentTime',
        functionType: 'FunctionType.Effect',
      })

      // Assert
      expect(result).toBe(error)
      expect(result.message).toBe('Internal Server Error')
      expect(result.stack).toContain('Error: Internal Server Error')
      expect(result.stack).toContain('Forge diagnostics:')
      expect(result.stack).toContain('Phase: hooks')
      expect(result.stack).toContain('Path: example > / > onAccess[0] > effects[1] (effect - LoadCurrentTime)')
      expect(result.stack).toContain('Function: LoadCurrentTime')
      expect(result.stack).toContain('Type: FunctionType.Effect')
    })

    it('should store Forge diagnostics as non-enumerable metadata', () => {
      // Arrange
      const error = new Error('boom')

      // Act
      decorateForgeRuntimeEvaluationError(error, {
        phase: 'render',
        nodeId: 'compile_ast:1',
      })

      // Assert
      expect(getForgeRuntimeEvaluationDiagnostics(error)).toEqual({
        phase: 'render',
        nodeId: 'compile_ast:1',
      })
      expect(Object.prototype.propertyIsEnumerable.call(error, FORGE_RUNTIME_EVALUATION_DIAGNOSTICS)).toBe(false)
    })

    it('should not append Forge diagnostics more than once', () => {
      // Arrange
      const error = new Error('boom')
      const diagnostics = {
        phase: 'render',
        formattedPath: 'journey > step > blocks[0]',
      }

      // Act
      decorateForgeRuntimeEvaluationError(error, diagnostics)
      decorateForgeRuntimeEvaluationError(error, diagnostics)

      // Assert
      expect(error.stack?.match(/Forge diagnostics:/g)).toHaveLength(1)
    })
  })
})
