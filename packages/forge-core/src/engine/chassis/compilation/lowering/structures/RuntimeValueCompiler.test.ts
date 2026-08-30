import { ComponentCallType, ExpressionType, IteratorType } from '../../../../../shared/taxonomy'
import type { AuthoredValue } from '../../../contracts/models/authoredValue.type'
import AuthoredValueClassifier from '../../analysis/shared/AuthoredValueClassifier'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import { code, literal } from '../codegen/fragments/CodeFragment'
import CodeGenerator from '../codegen/CodeGenerator'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ForgeInternalError from '../../../../errors/ForgeInternalError'
import type { CompilationDependencies } from '../compilationDependencies.type'
import ExpressionDispatcher from '../expressions/ExpressionDispatcher'
import { compileGeneratedFunction } from '../GeneratedFunctionCompiler'
import RuntimeValueCompiler, { RuntimeValueCompilerPolicy } from './RuntimeValueCompiler'

type ValueFunction = (ctx: Record<string, unknown>) => unknown

describe('RuntimeValueCompiler', () => {
  let expr: ExpressionDispatcher
  let classifier: AuthoredValueClassifier
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    expr = new ExpressionDispatcher(dependencies)
    classifier = new AuthoredValueClassifier()
  })

  function compileValueFunction(value: AuthoredValue, policy: Partial<RuntimeValueCompilerPolicy> = {}): ValueFunction {
    const values = new RuntimeValueCompiler(expr, {
      expressionErrorFallback: literal(undefined),
      omitUndefinedArrayItems: false,
      ...policy,
    })

    return compileGeneratedFunction<ValueFunction>(expr, ['ctx'], () => {
      const generator = CodeGenerator.forFunction(['ctx'])
      const result = generator.let('result')

      values.compileValue(value, generator, result)
      generator.return(result)

      return generator
    })
  }

  describe('compileValue()', () => {
    it('should emit static values as literals', async () => {
      // Arrange
      const run = compileValueFunction(classifier.classify({ label: 'Static', tags: ['a'] }))

      // Act
      const result = await run({})

      // Assert
      expect(result).toEqual({ label: 'Static', tags: ['a'] })
    })

    it('should evaluate expression values through the dispatcher', async () => {
      // Arrange
      const run = compileValueFunction(classifier.classify(ASTTestFactory.reference(['data', 'name'])))

      // Act
      const result = await run({ data: { name: 'Ada' } })

      // Assert
      expect(result).toBe('Ada')
    })

    it('should materialise record and list arms entry by entry', async () => {
      // Arrange
      const value = classifier.classify({ items: ['static', ASTTestFactory.reference(['data', 'name'])] })
      const run = compileValueFunction(value)

      // Act
      const result = await run({ data: { name: 'Ada' } })

      // Assert
      expect(result).toEqual({ items: ['static', 'Ada'] })
    })

    it('should select conditional branches from the evaluated predicate', async () => {
      // Arrange
      const conditional = classifier.classify({
        kind: ExpressionType.CONDITIONAL,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        properties: { predicate: ASTTestFactory.reference(['data', 'flag']), thenValue: 'yes', elseValue: 'no' },
      })
      const run = compileValueFunction(conditional)

      // Act / Assert
      expect(await run({ data: { flag: true } })).toBe('yes')
      expect(await run({ data: { flag: false } })).toBe('no')
    })

    it('should materialise MAP iterations and drop undefined yields', async () => {
      // Arrange
      const iterate = classifier.classify({
        kind: ExpressionType.ITERATE,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        properties: {
          input: ASTTestFactory.reference(['data', 'members']),
          iterator: { type: IteratorType.MAP, yieldTemplate: 'seen' },
        },
      })
      const run = compileValueFunction(iterate)

      // Act
      const result = await run({
        data: { members: ['a', 'b'] },
        iteratorBudget: { consume: vi.fn() },
      })

      // Assert
      expect(result).toEqual(['seen', 'seen'])
    })

    it('should throw when a block value reaches a policy without a block compiler', () => {
      // Arrange
      const block = classifier.classify({
        kind: ComponentCallType.BASIC,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        variant: 'content',
        properties: {},
      })

      // Act / Assert
      expect(() => compileValueFunction(block)).toThrow(ForgeInternalError)
    })

    it('should delegate block values to the policy block compiler when supplied', async () => {
      // Arrange
      const block = classifier.classify({
        kind: ComponentCallType.BASIC,
        isTemplate: false,
        id: ASTTestFactory.getId(),
        variant: 'content',
        properties: {},
      })
      const run = compileValueFunction(block, {
        compileBlockValue: (blockValue, generator, nameHint) =>
          generator.const(nameHint, code`${literal(blockValue.variant)}`),
      })

      // Act
      const result = await run({})

      // Assert
      expect(result).toBe('content')
    })
  })
})
