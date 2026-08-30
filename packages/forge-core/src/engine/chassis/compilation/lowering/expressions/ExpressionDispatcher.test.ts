import { ExpressionType, FunctionType, IteratorType, PredicateType } from '../../../../../authoring/types/enums'
import type { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import IteratorBudget from '../../../runtime/pipeline/IteratorBudget'
import CodeGenerator from '../codegen/CodeGenerator'
import SourceRenderer from '../codegen/rendering/SourceRenderer'
import type { CompilationDependencies } from '../compilationDependencies.type'
import { compileGeneratedFunction } from '../GeneratedFunctionCompiler'
import ExpressionDispatcher from './ExpressionDispatcher'

type EvaluateFunction = (ctx: {
  data: Record<string, unknown>
  conditions: FunctionRegistry
  iteratorBudget: IteratorBudget
}) => unknown

describe('ExpressionDispatcher', () => {
  let compiler: ExpressionDispatcher
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  dependencies.functionRegistry.register({
    buildCode: { name: 'buildCode', evaluate: () => undefined },
    isRequired: { name: 'isRequired', evaluate: () => undefined },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new ExpressionDispatcher(dependencies)
  })

  function compileSource(expressionCompiler: ExpressionDispatcher, expression: ASTNode): string {
    const generator = CodeGenerator.forFunction(['ctx'])
    const result = expressionCompiler.compileExpressionCode(expression, generator)

    generator.return(result)

    return new SourceRenderer().render(generator.toNodes()).source
  }

  describe('compileExpressionCode()', () => {
    it('should avoid wrapping direct function expressions twice when diagnostics are already on the function call', () => {
      // Arrange
      const expression = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'buildCode')

      // Act
      const source = compileSource(compiler, expression)

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('_forgeRuntimeDiagnostics, 0, "buildCode"')
      expect(source).not.toContain('"functionName"')
      expect(source).not.toContain('_forgeHelpers.evaluateTracked')
      expect(compiler.diagnosticCatalogue).toMatchObject([
        { functionName: 'buildCode', functionType: FunctionType.GENERATOR },
      ])
    })

    it('should handle one evaluator returning direct and promised values without async metadata', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        maybeDeferred: {
          name: 'maybeDeferred',
          evaluate: (defer: unknown) => (defer ? Promise.resolve('deferred') : 'direct'),
        },
      })

      const dynamicCompiler = new ExpressionDispatcher({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const expression = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'maybeDeferred', [
        ASTTestFactory.reference(['data', 'defer']),
      ])
      const source = compileSource(dynamicCompiler, expression)
      const compiled = compileGeneratedFunction<EvaluateFunction>(dynamicCompiler, ['ctx'], () => {
        const generator = CodeGenerator.forFunction(['ctx'])

        generator.return(dynamicCompiler.compileExpressionCode(expression, generator))

        return generator
      })
      const createContext = (defer: boolean) => ({
        data: { defer },
        conditions: functionRegistry,
        iteratorBudget: new IteratorBudget(100),
      })

      // Act
      const directResult = compiled(createContext(false))
      const deferredResult = compiled(createContext(true))

      // Assert
      expect(source).toContain('_forgeHelpers.isThenable(functionResult)')
      expect(source.match(/await functionResult/g)).toHaveLength(1)
      await expect(directResult).resolves.toBe('direct')
      await expect(deferredResult).resolves.toBe('deferred')
    })

    it('should keep diagnostic boundaries around non-function expressions', () => {
      // Arrange
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'enabled']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired'),
      })

      // Act
      const source = compileSource(compiler, predicate)

      // Assert
      expect(source).toContain('try {')
      expect(source).toContain('_forgeRuntimeDiagnostics.wrap(error, 0)')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).not.toContain('_forgeHelpers.evaluateTracked')
    })

    it('should consume the request budget for inline iterator expressions', () => {
      // Arrange
      const expression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', ['Ada', 'Bea'])
        .withProperty('iterator', {
          type: IteratorType.MAP,
          yieldTemplate: 'member',
        })
        .build()

      // Act
      const source = compileSource(compiler, expression)

      // Assert
      expect(source).toContain('_forgeHelpers.consumeIteratorIteration(ctx)')
    })
  })
})
