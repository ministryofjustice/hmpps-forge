import { ComponentCallType, ExpressionType, IteratorType, FunctionCallType } from '../../../../../shared/taxonomy'
import type { AuthoredValue, BlockValue } from '../../../contracts/models/authoredValue.type'
import AuthoredValueClassifier from '../../analysis/shared/AuthoredValueClassifier'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import { code, literal, type SafeCode } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ForgeInternalError from '../../../../errors/ForgeInternalError'
import type { CompilationDependencies } from '../compilationDependencies.type'
import ExpressionDispatcher from './ExpressionDispatcher'
import { compileGeneratedFunction } from '../GeneratedFunctionCompiler'

type ValueFunction = (ctx: Record<string, unknown>) => unknown

describe('ExpressionDispatcher values', () => {
  let expr: ExpressionDispatcher
  let classifier: AuthoredValueClassifier
  const functionRegistry = new FunctionRegistry()
  const dependencies: CompilationDependencies = { functionRegistry }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    expr = new ExpressionDispatcher(dependencies)
    classifier = new AuthoredValueClassifier()
  })

  function compileValueFunction(
    value: AuthoredValue,
    compileBlock?: (block: BlockValue, generator: CodeGenerator, nameHint: string) => SafeCode,
  ): ValueFunction {
    expr = new ExpressionDispatcher(dependencies, compileBlock)

    return compileGeneratedFunction<ValueFunction>(expr, ['ctx'], () => {
      const generator = CodeGenerator.forFunction(['ctx'])
      const result = generator.let('result')

      generator.assign(result, expr.compileValueCode(value, generator))
      generator.return(result)

      return generator
    })
  }

  describe('compileValueCode()', () => {
    it('should emit literals when values are static', async () => {
      // Arrange
      const run = compileValueFunction(classifier.classify({ label: 'Static', tags: ['a'] }))

      // Act
      const result = await run({})

      // Assert
      expect(result).toEqual({ label: 'Static', tags: ['a'] })
    })

    it('should evaluate references when values contain expressions', async () => {
      // Arrange
      const run = compileValueFunction(classifier.classify(ASTTestFactory.reference(['data', 'name'])))

      // Act
      const result = await run({ data: { name: 'Ada' } })

      // Assert
      expect(result).toBe('Ada')
    })

    it('should preserve authored entries when compiling records and lists', async () => {
      // Arrange
      const value = classifier.classify({ items: ['static', ASTTestFactory.reference(['data', 'name'])] })
      const run = compileValueFunction(value)

      // Act
      const result = await run({ data: { name: 'Ada' } })

      // Assert
      expect(result).toEqual({ items: ['static', 'Ada'] })
    })

    it('should select branches when a conditional predicate changes', async () => {
      // Arrange
      const conditional = classifier.classify({
        kind: ExpressionType.CONDITIONAL,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        properties: { predicate: ASTTestFactory.reference(['data', 'flag']), thenValue: 'yes', elseValue: 'no' },
      })
      const run = compileValueFunction(conditional)

      // Act
      const selected = await run({ data: { flag: true } })
      const alternate = await run({ data: { flag: false } })

      // Assert
      expect(selected).toBe('yes')
      expect(alternate).toBe('no')
    })

    it('should retain undefined yields when materialising MAP iterations', async () => {
      // Arrange
      const iterate = classifier.classify({
        kind: ExpressionType.ITERATE,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        properties: {
          input: ASTTestFactory.reference(['data', 'members']),
          iterator: { type: IteratorType.MAP, yieldTemplate: ASTTestFactory.reference(['data', 'missing']) },
        },
      })
      const run = compileValueFunction(iterate)

      // Act
      const result = await run({
        data: { members: ['a', 'b'] },
        iteratorBudget: { consume: vi.fn() },
      })

      // Assert
      expect(result).toStrictEqual([undefined, undefined])
    })

    it('should throw when a block value has no component compiler', () => {
      // Arrange
      const block = classifier.classify({
        kind: ComponentCallType.BASIC,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        variant: 'content',
        properties: {},
      })

      // Act
      const compile = () => compileValueFunction(block)

      // Assert
      expect(compile).toThrow(ForgeInternalError)
    })

    it('should delegate block values when a component compiler is supplied', async () => {
      // Arrange
      const block = classifier.classify({
        kind: ComponentCallType.BASIC,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        variant: 'content',
        properties: {},
      })
      const run = compileValueFunction(block, (blockValue, generator, nameHint) =>
        generator.const(nameHint, code`${literal(blockValue.variant)}`),
      )

      // Act
      const result = await run({})

      // Assert
      expect(result).toBe('content')
    })

    it('should retain explicit and computed undefined entries when compiling arrays', async () => {
      // Arrange
      const run = compileValueFunction(
        classifier.classify([undefined, ASTTestFactory.reference(['data', 'missing']), 'last']),
      )

      // Act
      const result = await run({ data: {} })

      // Assert
      expect(result).toStrictEqual([undefined, undefined, 'last'])
    })

    it('should read earlier arguments before later calls when compiling a function', async () => {
      // Arrange
      functionRegistry.register({
        captureEarlier: { name: 'captureEarlier', evaluate: (earlier: unknown) => earlier },
        mutateLater: {
          name: 'mutateLater',
          evaluate: (item: unknown) => {
            if (item !== null && typeof item === 'object' && 'label' in item) {
              item.label = 'after'
            }

            return 'changed'
          },
        },
      })
      const expression = ASTTestFactory.functionExpression(FunctionCallType.GENERATOR, 'captureEarlier', [
        ASTTestFactory.reference(['data', 'item', 'label']),
        ASTTestFactory.functionExpression(FunctionCallType.GENERATOR, 'mutateLater', [
          ASTTestFactory.reference(['data', 'item']),
        ]),
      ])
      const run = compileValueFunction(classifier.classify(expression))

      // Act
      const result = await run({ data: { item: { label: 'before' } }, conditions: functionRegistry })

      // Assert
      expect(result).toBe('before')
    })
  })
})
