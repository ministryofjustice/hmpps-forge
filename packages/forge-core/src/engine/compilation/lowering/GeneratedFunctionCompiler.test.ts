import ForgeCompilationError from '../../errors/ForgeCompilationError'
import ForgeRuntimeEvaluationError, {
  getForgeRuntimeEvaluationDiagnostics,
} from '../../errors/ForgeRuntimeEvaluationError'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ComponentRegistry from '../../registries/ComponentRegistry'
import type { CompilationDependencies } from './compilationDependencies.type'
import { CodeFragment, code, positionedCode } from './codegen/fragments/CodeFragment'
import CodeGenerator from './codegen/CodeGenerator'
import ExpressionDispatcher from './expressions/ExpressionDispatcher'
import { CompilationPhase, compileGeneratedFunction, type GeneratedFunction } from './GeneratedFunctionCompiler'
import { ASTNodeType } from '../../contracts/ast/enums'
import type { FunctionASTNode } from '../../contracts/ast/expressions.type'
import { FunctionType } from '../../../authoring/types/enums'

const dependencies: CompilationDependencies = {
  functionRegistry: new FunctionRegistry(),
  componentRegistry: new ComponentRegistry(),
}

const trustedGeneratedSource = (source: string): CodeGenerator => {
  const generator = CodeGenerator.forFunction(['ctx'])

  generator.statement(CodeFragment.trusted(source))

  return generator
}

const throwingGeneratedSource = (line: number): CodeGenerator => {
  const generator = CodeGenerator.forFunction(['ctx'])

  generator.statement(
    positionedCode(code`(() => { throw new Error("boom") })()`, [{ file: '/journeys/definition.ts', line, column: 1 }]),
  )

  return generator
}

const generatedScriptUrl = (fn: GeneratedFunction): string => {
  try {
    Reflect.apply(fn, undefined, [{}])
    throw new Error('Expected generated function to throw')
  } catch (error) {
    if (!(error instanceof ForgeRuntimeEvaluationError) || !(error.cause instanceof Error)) {
      throw error
    }

    const sourceUrl = error.cause.stack?.match(/forge:compiled\/[\w./-]+\.js/)?.[0]

    if (sourceUrl === undefined) {
      throw new Error('Expected generated function stack to include its script URL')
    }

    return sourceUrl
  }
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
      const fn = compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => generator, {
        phase: 'render' as CompilationPhase,
      })
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
          phase: 'render' as CompilationPhase,
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
        { phase: 'render' as CompilationPhase },
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
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        throwingFunction: {
          name: 'throwingFunction',
          isAsync: false,
          evaluate: () => {
            throw new Error('boom')
          },
        },
      })

      const expr = new ExpressionDispatcher({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const expression: FunctionASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.GENERATOR,
        id: 'compile_ast:1',
        diagnostics: {
          source: { path: ['journey'], formattedPath: 'myJourney > value' },
          callsite: { stack: 'Error\n    at myJourney (/app/journeys/goals.journey.ts:12:5)' },
        },
        properties: { name: 'throwingFunction', arguments: [] },
      }
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => {
          const generator = CodeGenerator.forFunction(['ctx'])

          generator.return(expr.compileExpressionCode(expression))

          return generator
        },
        { phase: 'render' as CompilationPhase },
      )

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{ conditions: functionRegistry }])

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
          phase: 'render' as CompilationPhase,
          nodeId: 'compile_ast:1',
          formattedPath: 'myJourney > value',
          functionName: 'throwingFunction',
          functionType: FunctionType.GENERATOR,
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
        { phase: 'render' as CompilationPhase },
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
        { phase: CompilationPhase.ANSWER_PREPARATION },
      )

      // Act
      const result = Reflect.apply(fn, undefined, [{}])

      // Assert
      expect(result).toBe('red')
    })

    it('should stamp the label into the script URL on error stacks', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)
      const fn = compileGeneratedFunction<GeneratedFunction>(
        expr,
        ['ctx'],
        () => trustedGeneratedSource('throw new Error("boom");'),
        { phase: 'render' as CompilationPhase, label: 'guide.defining-steps' },
      )

      // Act
      const evaluate = () => Reflect.apply(fn, undefined, [{}])

      // Assert
      try {
        evaluate()
        throw new Error('Expected generated function to throw')
      } catch (error) {
        expect(((error as Error).cause as Error).stack).toMatch(
          /forge:compiled\/render\/guide\.defining-steps\.[a-f0-9]{8}\.1\.js/,
        )
      }
    })

    it('should number duplicate labels as sibling JavaScript files', () => {
      // Arrange
      const firstExpr = new ExpressionDispatcher(dependencies)
      const secondExpr = new ExpressionDispatcher(dependencies)
      const compile = (expr: ExpressionDispatcher) =>
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => throwingGeneratedSource(10), {
          phase: 'render' as CompilationPhase,
          label: 'guide.identical',
        })

      // Act
      const firstUrl = generatedScriptUrl(compile(firstExpr))
      const secondUrl = generatedScriptUrl(compile(secondExpr))

      // Assert
      expect(firstUrl).toMatch(/^forge:compiled\/render\/guide\.identical\.[a-f0-9]{8}\.1\.js$/)
      expect(secondUrl).toBe(firstUrl.replace(/\.1\.js$/, '.2.js'))
    })

    it('should change the fingerprint when generated source changes', () => {
      // Arrange
      const firstExpr = new ExpressionDispatcher(dependencies)
      const secondExpr = new ExpressionDispatcher(dependencies)

      // Act
      const firstUrl = generatedScriptUrl(
        compileGeneratedFunction<GeneratedFunction>(
          firstExpr,
          ['ctx'],
          () => trustedGeneratedSource('throw new Error("first");'),
          { phase: 'render' as CompilationPhase, label: 'guide.changed-source' },
        ),
      )
      const secondUrl = generatedScriptUrl(
        compileGeneratedFunction<GeneratedFunction>(
          secondExpr,
          ['ctx'],
          () => trustedGeneratedSource('throw new Error("second");'),
          { phase: 'render' as CompilationPhase, label: 'guide.changed-source' },
        ),
      )
      const firstFingerprint = firstUrl.match(/\.([a-f0-9]{8})\.1\.js$/)?.[1]
      const secondFingerprint = secondUrl.match(/\.([a-f0-9]{8})\.2\.js$/)?.[1]

      // Assert
      expect(secondUrl).not.toBe(firstUrl)
      expect(firstFingerprint).toBeDefined()
      expect(secondFingerprint).toBeDefined()
      expect(secondFingerprint).not.toBe(firstFingerprint)
    })

    it('should change the fingerprint when only the source map changes', () => {
      // Arrange
      const firstExpr = new ExpressionDispatcher(dependencies)
      const secondExpr = new ExpressionDispatcher(dependencies)

      // Act
      const firstUrl = generatedScriptUrl(
        compileGeneratedFunction<GeneratedFunction>(firstExpr, ['ctx'], () => throwingGeneratedSource(10), {
          phase: 'render' as CompilationPhase,
          label: 'guide.changed-map',
        }),
      )
      const secondUrl = generatedScriptUrl(
        compileGeneratedFunction<GeneratedFunction>(secondExpr, ['ctx'], () => throwingGeneratedSource(11), {
          phase: 'render' as CompilationPhase,
          label: 'guide.changed-map',
        }),
      )
      const firstFingerprint = firstUrl.match(/\.([a-f0-9]{8})\.1\.js$/)?.[1]
      const secondFingerprint = secondUrl.match(/\.([a-f0-9]{8})\.2\.js$/)?.[1]

      // Assert
      expect(secondUrl).not.toBe(firstUrl)
      expect(firstFingerprint).toBeDefined()
      expect(secondFingerprint).toBeDefined()
      expect(secondFingerprint).not.toBe(firstFingerprint)
    })

    it('should use a readable fallback for scripts without a label', () => {
      // Arrange
      const expr = new ExpressionDispatcher(dependencies)

      // Act
      const sourceUrl = generatedScriptUrl(
        compileGeneratedFunction<GeneratedFunction>(expr, ['ctx'], () => throwingGeneratedSource(10), {
          phase: 'unlabelled-test' as CompilationPhase,
        }),
      )

      // Assert
      expect(sourceUrl).toMatch(/^forge:compiled\/unlabelled-test\/unlabelled\.[a-f0-9]{8}\.1\.js$/)
    })
  })

})
