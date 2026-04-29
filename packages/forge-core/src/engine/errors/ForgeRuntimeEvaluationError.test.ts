import ForgeRuntimeEvaluationError from './ForgeRuntimeEvaluationError'

describe('ForgeRuntimeEvaluationError', () => {
  describe('toString()', () => {
    it('should format diagnostic fields across multiple lines', () => {
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
      const result = error.toString()

      // Assert
      expect(result).toBe(
        [
          'ForgeRuntimeEvaluationError: Failed to evaluate compiled Forge render function',
          '  Phase: render',
          '  Path: journey > step > blocks[0]',
          '  Node: compile_ast:1',
          '  Function: explode',
          '  Type: FunctionType.Generator',
          '  Cause: Error: boom',
        ].join('\n'),
      )
    })
  })

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
      expect(stack).toContain('Cause: Error: boom')
    })
  })
})
