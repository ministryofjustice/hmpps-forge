import ForgeRuntimeEvaluationError, {
  FORGE_RUNTIME_EVALUATION_DIAGNOSTICS,
  getForgeRuntimeEvaluationDiagnostics,
} from './ForgeRuntimeEvaluationError'

const buildCause = (): Error => {
  const cause = new Error('boom')

  cause.stack = [
    'Error: boom',
    '    at Object.evaluate (/app/server/forms/effects/loadPreferences.ts:256:11)',
    '    at invokeEffect (/app/node_modules/@ministryofjustice/hmpps-forge/dist/forge-core/lowering/GeneratedFunctionHelpers.js:88:15)',
    '    at WorkExecutor.executeTask (/app/node_modules/@ministryofjustice/hmpps-forge/dist/forge-core/runtime/WorkExecutor.js:141:26)',
    '    at WorkExecutor.runUnit (/app/node_modules/@ministryofjustice/hmpps-forge/dist/forge-core/runtime/WorkExecutor.js:64:19)',
  ].join('\n')

  return cause
}

describe('ForgeRuntimeEvaluationError', () => {
  describe('stack', () => {
    it('should include the cause message in the wrapper message when the cause is an Error', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({ phase: 'hooks', cause: buildCause() })

      // Act
      const { message } = error

      // Assert
      expect(message).toBe('Failed to evaluate compiled Forge hooks function: boom')
    })

    it('should render the cause author frames and fold the forge-internal run', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({ phase: 'hooks', cause: buildCause() })

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('    at Object.evaluate (/app/server/forms/effects/loadPreferences.ts:256:11)')
      expect(stack).toContain(
        '    ... 3 forge frames (invokeEffect → WorkExecutor.runUnit) — FORGE_FULL_STACK=1 to expand',
      )
      expect(stack).not.toContain('    at WorkExecutor.executeTask')
    })

    it('should include diagnostic fields when loggers serialise the stack', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({
        phase: 'render',
        nodeId: 'compile_ast:1',
        formattedPath: 'journey > step > blocks[0]',
        functionName: 'explode',
        functionType: 'FunctionType.Generator',
        cause: new Error('boom'),
      })

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('    Forge diagnostics:')
      expect(stack).toContain('      Phase: render')
      expect(stack).toContain('      Path: journey > step > blocks[0]')
      expect(stack).toContain('      Function: explode')
      expect(stack).toContain('      Type: FunctionType.Generator')
    })

    it('should not render the node id in the diagnostics block', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({
        phase: 'render',
        nodeId: 'compile_ast:1',
        cause: new Error('boom'),
      })

      // Act
      const stack = error.stack

      // Assert
      expect(stack).not.toContain('Node:')
      expect(error.nodeId).toBe('compile_ast:1')
    })

    it('should render the defined-at chain as [defined] frames instead of a diagnostics row', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({
        phase: 'hooks',
        definedAt: 'effects (/app/forms/index.ts:40:40)\nonAccess (/app/forms/hooks.ts:18:22)',
        cause: new Error('boom'),
      })

      // Act
      const stack = error.stack

      // Assert
      expect(stack).toContain('    at [defined] effects (/app/forms/index.ts:40:40)')
      expect(stack).toContain('    at [defined] onAccess (/app/forms/hooks.ts:18:22)')
      expect(stack).not.toContain('Defined at:')
    })

    it('should render every frame when FORGE_FULL_STACK is set', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({ phase: 'hooks', cause: buildCause() })

      // Act
      process.env.FORGE_FULL_STACK = '1'
      const stack = error.stack
      delete process.env.FORGE_FULL_STACK

      // Assert
      expect(stack).toContain('    at WorkExecutor.executeTask')
      expect(stack).not.toContain('forge frames (')
    })

    it('should leave the author error stack untouched', () => {
      // Arrange
      const cause = buildCause()
      const originalStack = cause.stack

      // Act
      const error = new ForgeRuntimeEvaluationError({ phase: 'hooks', formattedPath: 'a > b', cause })
      const renderedStack = error.stack

      // Assert
      expect(renderedStack).toContain('Forge diagnostics:')
      expect(cause.stack).toBe(originalStack)
      expect(cause.stack).not.toContain('Forge diagnostics:')
    })

    it('should keep the unfolded wrapper frames reachable via rawStack', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({ phase: 'hooks', cause: buildCause() })

      // Act
      const { rawStack } = error

      // Assert
      expect(rawStack).toContain('ForgeRuntimeEvaluationError: Failed to evaluate compiled Forge hooks function: boom')
      expect(rawStack).toContain('ForgeRuntimeEvaluationError.test.ts')
      expect(rawStack).not.toContain('forge frames (')
      expect(Object.keys(error)).not.toContain('rawStack')
    })
  })

  describe('cause', () => {
    it('should expose the author error on cause', () => {
      // Arrange
      const cause = buildCause()

      // Act
      const error = new ForgeRuntimeEvaluationError({ phase: 'hooks', cause })

      // Assert
      expect(error.cause).toBe(cause)
    })
  })

  describe('getForgeRuntimeEvaluationDiagnostics()', () => {
    it('should expose structured diagnostics as non-enumerable metadata', () => {
      // Arrange
      const error = new ForgeRuntimeEvaluationError({
        phase: 'render',
        nodeId: 'compile_ast:1',
        cause: new Error('boom'),
      })

      // Act
      const diagnostics = getForgeRuntimeEvaluationDiagnostics(error)

      // Assert
      expect(diagnostics).toEqual({ phase: 'render', nodeId: 'compile_ast:1' })
      expect(Object.prototype.propertyIsEnumerable.call(error, FORGE_RUNTIME_EVALUATION_DIAGNOSTICS)).toBe(false)
    })

    it('should return undefined for an error without diagnostics', () => {
      // Act
      const diagnostics = getForgeRuntimeEvaluationDiagnostics(new Error('boom'))

      // Assert
      expect(diagnostics).toBeUndefined()
    })
  })
})
