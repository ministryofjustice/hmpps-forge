import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError from '../../../errors/ForgeRuntimeEvaluationError'
import NodeCompilationDispatcher from '../expressions/NodeCompilationDispatcher'
import { compileGeneratedFunction } from './GeneratedFunctionCompiler'
import type { GeneratedFunction } from './compiledFunctionFactory'

describe('GeneratedFunctionCompiler', () => {
  describe('compileGeneratedFunction()', () => {
    it('should throw ForgeCompilationError when generated source cannot be constructed', () => {
      // Arrange
      const expr = new NodeCompilationDispatcher()

      // Act
      const compile = () =>
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], undefined, () => 'return (', { phase: 'render' })

      // Assert
      expect(compile).toThrow(ForgeCompilationError)
    })

    it('should wrap compiled runtime failures in ForgeRuntimeEvaluationError', () => {
      // Arrange
      const expr = new NodeCompilationDispatcher()
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        undefined,
        () => 'throw new Error("boom");',
        { phase: 'render' },
      )

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      expect(evaluate).toThrow(ForgeRuntimeEvaluationError)
    })

    it('should pass shared helpers into generated functions', () => {
      // Arrange
      const expr = new NodeCompilationDispatcher()
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        undefined,
        () => 'return _forgeHelpers.normalizePostValue(["", "red"], false);',
        { phase: 'answer-preparation' },
      )

      // Act
      const result = Reflect.apply(fn, undefined, [{}])

      // Assert
      expect(result).toBe('red')
    })
  })
})
