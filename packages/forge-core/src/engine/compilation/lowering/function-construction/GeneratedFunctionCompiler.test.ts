import ForgeCompilationError from '../../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError, {
  getForgeRuntimeEvaluationDiagnostics,
} from '../../../errors/ForgeRuntimeEvaluationError'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../compilationDependencies.type'
import CompilationTracer from '../../tracing/CompilationTracer'
import { Code, code } from '../../codegen/Code'
import CodeGenerator from '../../codegen/CodeGenerator'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { compileGeneratedFunction, deriveScriptLabel } from './GeneratedFunctionCompiler'
import type { GeneratedFunction } from './compiledFunctionFactory'

const dependencies: CompilationDependencies = {
  functionRegistry: new FunctionRegistry(),
  componentRegistry: new ComponentRegistry(),
}

const trustedGeneratedSource = (source: string): CodeGenerator => {
  const generator = CodeGenerator.forFunction(['ctx'])

  generator.statement(Code.trusted(source))

  return generator
}

describe('GeneratedFunctionCompiler', () => {
  describe('compileGeneratedFunction()', () => {
    it('should keep typed functions in strict mode', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const generator = CodeGenerator.forFunction(['ctx'])

      generator.directive('use strict')
      generator.return(code`this`)

      // Act
      const fn = compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => generator, { phase: 'render' })
      const result = Reflect.apply(fn, undefined, [{}])

      // Assert
      expect(result).toBeUndefined()
    })

    it('should throw ForgeCompilationError when generated source cannot be constructed', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)

      // Act
      const compile = () =>
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => trustedGeneratedSource('return ('), {
          phase: 'render',
        })

      // Assert
      expect(compile).toThrow(ForgeCompilationError)
    })

    it('should wrap Error failures in ForgeRuntimeEvaluationError with the author error on cause', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => trustedGeneratedSource('throw new Error("boom");'),
        { phase: 'render' },
      )

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      try {
        evaluate()
        throw new Error('Expected generated function to throw')
      } catch (error) {
        if (!(error instanceof ForgeRuntimeEvaluationError)) {
          throw new Error('Expected generated function to throw ForgeRuntimeEvaluationError')
        }

        expect(error.message).toContain('boom')
        expect(error.cause).toBeInstanceOf(Error)
        expect((error.cause as Error).message).toBe('boom')
        expect((error.cause as Error).stack).not.toContain('Forge diagnostics:')
        expect(getForgeRuntimeEvaluationDiagnostics(error)).toEqual({ phase: 'render' })
        expect(error.stack).toContain('Forge diagnostics:')
        expect(error.stack).toContain('Phase: render')
      }
    })

    it('should carry definedAt from emitted metadata into Forge diagnostics', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () =>
          trustedGeneratedSource(
            [
              'return _forgeHelpers.evaluateTracked(',
              '  _forgeRuntimeDiagnostics,',
              '  { definedAt: "myJourney (/app/journeys/goals.journey.ts:12:5)" },',
              '  function() { throw new Error("boom"); }',
              ');',
            ].join('\n'),
          ),
        { phase: 'render' },
      )

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      try {
        evaluate()
        throw new Error('Expected generated function to throw')
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected generated function to throw the original Error')
        }

        expect(error.message).toContain('boom')
        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'render',
          definedAt: 'myJourney (/app/journeys/goals.journey.ts:12:5)',
        })
        expect(error.stack).toContain('at [defined] myJourney (/app/journeys/goals.journey.ts:12:5)')
      }
    })

    it('should wrap non-Error runtime failures in ForgeRuntimeEvaluationError', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => trustedGeneratedSource('throw "boom";'),
        { phase: 'render' },
      )

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
        () => trustedGeneratedSource('return _forgeHelpers.normalizePostValue(["", "red"], false);'),
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
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => trustedGeneratedSource('return true;'), {
        phase: 'render',
      })

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
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => trustedGeneratedSource('return true;'), {
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
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => trustedGeneratedSource('return ('), {
          phase: 'render',
        })

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
      compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => trustedGeneratedSource('"use strict";return true;'),
        { phase: 'render' },
      )

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
      compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => trustedGeneratedSource('return true;'), {
        phase: 'render',
      })

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
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => trustedGeneratedSource('return ('), {
          phase: 'render',
        })

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
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => trustedGeneratedSource('return true;'),
        {
          phase: 'render',
        },
      )

      // Assert
      expect(tracer.root).toBeUndefined()
      expect(Reflect.apply(fn, undefined, [{}])).toBe(true)
    })

    it('should stamp the label into the script URL on error stacks', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => trustedGeneratedSource('throw new Error("boom");'),
        { phase: 'render', label: 'guide.defining-steps' },
      )

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      try {
        evaluate()
        throw new Error('Expected generated function to throw')
      } catch (error) {
        expect(((error as Error).cause as Error).stack).toContain('forge:compiled/render/guide.defining-steps')
      }
    })
  })

  describe('deriveScriptLabel()', () => {
    it('should join the journey and step segments when both are identity segments', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'dump > form > blocks[1] (govukInsetText)' } } }

      // Act
      const label = deriveScriptLabel([node])

      // Assert
      expect(label).toBe('dump.form')
    })

    it('should keep every ancestor segment when journeys nest', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'guide > building-journeys > defining-steps' } } }

      // Act
      const label = deriveScriptLabel([node])

      // Assert
      expect(label).toBe('guide.building-journeys.defining-steps')
    })

    it('should stop at the first structural segment when the node sits on the journey', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'dump > onAccess[0] > effects[0]' } } }

      // Act
      const label = deriveScriptLabel([node])

      // Assert
      expect(label).toBe('dump')
    })

    it('should take only the journey segment when maxDepth is 1', () => {
      // Arrange
      const node = { diagnostics: { source: { formattedPath: 'dump > form > blocks[0]' } } }

      // Act
      const label = deriveScriptLabel([node], { maxDepth: 1 })

      // Assert
      expect(label).toBe('dump')
    })

    it('should use the first node carrying diagnostics when earlier nodes have none', () => {
      // Arrange
      const bare = {}
      const node = { diagnostics: { source: { formattedPath: 'dump > form' } } }

      // Act
      const label = deriveScriptLabel([undefined, bare, node])

      // Assert
      expect(label).toBe('dump.form')
    })

    it('should return undefined when no node carries diagnostics', () => {
      // Act
      const label = deriveScriptLabel([{}, undefined])

      // Assert
      expect(label).toBeUndefined()
    })
  })
})
