import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError, {
  getForgeRuntimeEvaluationDiagnostics,
} from '../../../errors/ForgeRuntimeEvaluationError'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../compilationDependencies.type'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { compileGeneratedFunction } from './GeneratedFunctionCompiler'
import type { GeneratedFunction } from './compiledFunctionFactory'

const dependencies: CompilationDependencies = {
  functionRegistry: new FunctionRegistry(),
  componentRegistry: new ComponentRegistry(),
}

describe('GeneratedFunctionCompiler', () => {
  describe('compileGeneratedFunction()', () => {
    it('should throw ForgeCompilationError when generated source cannot be constructed', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)

      // Act
      const compile = () =>
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return (', { phase: 'render' })

      // Assert
      expect(compile).toThrow(ForgeCompilationError)
    })

    it('should preserve Error failures and attach Forge diagnostics', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'throw new Error("boom");', {
        phase: 'render',
      })

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      expect(evaluate).toThrow(Error)

      try {
        evaluate()
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected generated function to throw the original Error')
        }

        expect(error).not.toBeInstanceOf(ForgeRuntimeEvaluationError)
        expect(error.message).toBe('boom')
        expect(getForgeRuntimeEvaluationDiagnostics(error)).toEqual({ phase: 'render' })
        expect(error.stack).toContain('Forge diagnostics:')
        expect(error.stack).toContain('Phase: render')
      }
    })

    it('should wrap non-Error runtime failures in ForgeRuntimeEvaluationError', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'throw "boom";', {
        phase: 'render',
      })

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      expect(evaluate).toThrow(ForgeRuntimeEvaluationError)
    })

    it('should pass shared helpers into generated functions', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
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
