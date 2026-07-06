import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError, {
  getForgeRuntimeEvaluationDiagnostics,
} from '../../../errors/ForgeRuntimeEvaluationError'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../compilationDependencies.type'
import CompilationTracer from '../../../diagnostics/tracing/CompilationTracer'
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

    it('should record a completed codegen.function span when the tracer is enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return true;', { phase: 'render' })

      // Assert
      const span = tracer.root?.children.find(child => child.kind === 'codegen.function')

      expect(span?.key).toBe('codegen:render')
      expect(span?.beginFields).toEqual({ phase: 'render' })
      expect(span?.completeFields).toEqual({ async: false })
      expect(span?.completed).toBe(true)
    })

    it('should record async completion metadata when the function is forced async', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return true;', {
        phase: 'render',
        forceAsync: true,
      })

      // Assert
      const span = tracer.root?.children.find(child => child.kind === 'codegen.function')

      expect(span?.completeFields).toEqual({ async: true })
    })

    it('should leave the codegen.function span incomplete when source construction fails', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      const compile = () =>
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return (', { phase: 'render' })

      // Assert
      expect(compile).toThrow(ForgeCompilationError)

      const span = tracer.root?.children.find(child => child.kind === 'codegen.function')

      expect(span?.completed).toBe(false)
    })

    it('should capture the wrapped source on begin fields when captureGeneratedSource is enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true, captureGeneratedSource: true })
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => '"use strict";return true;', { phase: 'render' })

      // Assert
      const span = tracer.root?.children.find(child => child.kind === 'codegen.function')
      const source = span?.beginFields.source

      expect(span?.beginFields.phase).toBe('render')
      expect(typeof source).toBe('string')
      expect(source).toContain('return true;')
      expect(source).toContain('use strict')
    })

    it('should omit source from begin fields when captureGeneratedSource is not enabled', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true })
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return true;', { phase: 'render' })

      // Assert
      const span = tracer.root?.children.find(child => child.kind === 'codegen.function')

      expect(span?.beginFields).toEqual({ phase: 'render' })
      expect('source' in (span?.beginFields ?? {})).toBe(false)
    })

    it('should keep captured source on the incomplete span when compilation fails', () => {
      // Arrange
      const tracer = new CompilationTracer({ enabled: true, captureGeneratedSource: true })
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      const compile = () =>
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return (', { phase: 'render' })

      // Assert
      expect(compile).toThrow(ForgeCompilationError)

      const span = tracer.root?.children.find(child => child.kind === 'codegen.function')

      expect(span?.completed).toBe(false)
      expect(typeof span?.beginFields.source).toBe('string')
    })

    it('should record no spans when the tracer is disabled', () => {
      // Arrange
      const tracer = CompilationTracer.disabled
      const expr = new ExpressionDispatcher({ ...dependencies, tracer })

      // Act
      const fn = compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => 'return true;', { phase: 'render' })

      // Assert
      expect(tracer.root).toBeUndefined()
      expect(Reflect.apply(fn, undefined, [{}])).toBe(true)
    })
  })
})
