import { ExpressionType, FunctionCallType, IteratorType, PredicateType } from '../../../../../authoring/types/enums'
import { ASTNode } from '../../../contracts/ast/ast.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../compilationDependencies.type'
import CodeGenerator from '../codegen/CodeGenerator'
import SourceRenderer from '../codegen/rendering/SourceRenderer'
import { compileGeneratedFunction } from '../GeneratedFunctionCompiler'
import IteratorBudget from '../../../runtime/pipeline/IteratorBudget'
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
    buildCode: { name: 'buildCode', isAsync: true, evaluate: () => undefined },
    isRequired: { name: 'isRequired', isAsync: true, evaluate: () => undefined },
    GreaterThan: {
      name: 'GreaterThan',
      isAsync: false,
      evaluate: (value: unknown, expected: unknown) =>
        typeof value === 'number' && typeof expected === 'number' && value > expected,
    },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new ExpressionDispatcher(dependencies)
  })

  function compileEvaluator(expression: ASTNode): EvaluateFunction {
    return compileGeneratedFunction<EvaluateFunction>(compiler, ['ctx'], () => {
      const generator = CodeGenerator.forFunction(['ctx'])

      generator.return(compiler.compileExpressionCode(expression))

      return generator
    })
  }

  describe('compileExpressionCode()', () => {
    it('should avoid wrapping direct function expressions twice when diagnostics are already on the function call', () => {
      // Arrange
      const expression = ASTTestFactory.functionExpression(FunctionCallType.GENERATOR, 'buildCode')

      // Act
      const source = new SourceRenderer().renderCode(compiler.compileExpressionCode(expression)).source

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('_forgeRuntimeDiagnostics, 0, "buildCode"')
      expect(source).not.toContain('"functionName"')
      expect(source).not.toContain('_forgeHelpers.evaluateTracked')
      expect(compiler.diagnosticCatalogue).toMatchObject([
        { functionName: 'buildCode', functionType: FunctionCallType.GENERATOR },
      ])
    })

    it('should keep tracking non-function expressions around their compiled body', () => {
      // Arrange
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['data', 'enabled']),
        condition: ASTTestFactory.functionExpression(FunctionCallType.CONDITION, 'isRequired'),
      })

      // Act
      const source = new SourceRenderer().renderCode(compiler.compileExpressionCode(predicate)).source

      // Assert
      expect(source).toContain('_forgeHelpers.evaluateTracked')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
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
      const source = new SourceRenderer().renderCode(compiler.compileExpressionCode(expression)).source

      // Assert
      expect(source).toContain('_forgeHelpers.consumeIteratorIteration(ctx)')
    })

    it('should match JavaScript Object.entries operations when iterating objects', async () => {
      // Arrange
      const input = ASTTestFactory.reference(['data', 'values'])
      const item = ASTTestFactory.reference(['@loop', '0', 'item'])
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: item,
        condition: ASTTestFactory.functionExpression(FunctionCallType.CONDITION, 'GreaterThan', [10]),
      })
      const mapExpression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', input)
        .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate: item })
        .build()
      const filterExpression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', input)
        .withProperty('iterator', { type: IteratorType.FILTER, predicateTemplate: predicate })
        .build()
      const findExpression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', input)
        .withProperty('iterator', { type: IteratorType.FIND, predicateTemplate: predicate })
        .build()
      const evaluateMap = compileEvaluator(mapExpression)
      const evaluateFilter = compileEvaluator(filterExpression)
      const evaluateFind = compileEvaluator(findExpression)
      const ctx = {
        data: { values: { a: 10, b: 20 } },
        conditions: dependencies.functionRegistry,
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const [mapped, filtered, found] = await Promise.all([evaluateMap(ctx), evaluateFilter(ctx), evaluateFind(ctx)])

      // Assert
      expect(mapped).toEqual([10, 20])
      expect(filtered).toEqual([['b', 20]])
      expect(found).toEqual(['b', 20])
    })

    it('should preserve reserved-looking properties when iterating arrays', async () => {
      // Arrange
      const item = ASTTestFactory.reference(['@loop', '0', 'item'])
      const key = ASTTestFactory.reference(['@loop', '0', 'item', '@key'])
      const expression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['data', 'values']))
        .withProperty('iterator', {
          type: IteratorType.MAP,
          yieldTemplate: { item, key },
        })
        .build()
      const evaluate = compileEvaluator(expression)
      const value = { '@key': 'literal-key', '@value': 'literal-value', name: 'Ada' }
      const ctx = {
        data: { values: [value] },
        conditions: dependencies.functionRegistry,
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const result = await evaluate(ctx)

      // Assert
      expect(result).toEqual([{ item: value, key: undefined }])
    })

    it('should treat filtered object entries as ordinary items in the next iterator', async () => {
      // Arrange
      const item = ASTTestFactory.reference(['@loop', '0', 'item'])
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: item,
        condition: ASTTestFactory.functionExpression(FunctionCallType.CONDITION, 'GreaterThan', [10]),
      })
      const filteredEntries = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['data', 'values']))
        .withProperty('iterator', { type: IteratorType.FILTER, predicateTemplate: predicate })
        .build()
      const expression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', filteredEntries)
        .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate: item })
        .build()
      const evaluate = compileEvaluator(expression)
      const ctx = {
        data: { values: { a: 10, b: 20 } },
        conditions: dependencies.functionRegistry,
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const result = await evaluate(ctx)

      // Assert
      expect(result).toEqual([['b', 20]])
    })

    it('should keep keyed state independent across nested iterators', async () => {
      // Arrange
      const innerItem = ASTTestFactory.reference(['@loop', '0', 'item'])
      const innerKey = ASTTestFactory.reference(['@loop', '0', 'item', '@key'])
      const outerKey = ASTTestFactory.reference(['@loop', '1', 'item', '@key'])
      const innerMap = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['@loop', '0', 'item']))
        .withProperty('iterator', {
          type: IteratorType.MAP,
          yieldTemplate: { item: innerItem, innerKey, outerKey },
        })
        .build()
      const expression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['data', 'groups']))
        .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate: innerMap })
        .build()
      const evaluate = compileEvaluator(expression)
      const value = { '@key': 'literal-key', name: 'Ada' }
      const ctx = {
        data: { groups: { staff: [value] } },
        conditions: dependencies.functionRegistry,
        iteratorBudget: new IteratorBudget(),
      }

      // Act
      const result = await evaluate(ctx)

      // Assert
      expect(result).toEqual([[{ item: value, innerKey: undefined, outerKey: 'staff' }]])
    })

    it('should generate keyed state without reserved-property inspection', () => {
      // Arrange
      const expression = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withProperty('input', ASTTestFactory.reference(['data', 'values']))
        .withProperty('iterator', {
          type: IteratorType.MAP,
          yieldTemplate: ASTTestFactory.reference(['@loop', '0', 'item', '@key']),
        })
        .build()

      // Act
      const source = new SourceRenderer().renderCode(compiler.compileExpressionCode(expression)).source

      // Assert
      expect(source).toContain('Object.entries')
      expect(source).toContain('iteratorInputWasKeyed')
      expect(source).not.toContain('"@key" in')
      expect(source).not.toContain('["@value"]')
    })
  })
})
