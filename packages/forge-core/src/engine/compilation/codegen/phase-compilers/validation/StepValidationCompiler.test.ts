import { ASTTestFactory } from '../../../testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../../types/enums'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  IteratorType,
  PredicateType,
} from '../../../../../authoring/types/enums'
import {
  FORMAT_STRING_GENERATOR_NAME,
  FormatGeneratorsRegistry,
} from '../../../../../authoring/generators/formatGenerators'
import { FieldBlockASTNode, StepASTNode, StepEntryValidationAST } from '../../../../types/structures.type'
import {
  FunctionASTNode,
  IterateASTNode,
  ReferenceASTNode,
  ValidationASTNode,
} from '../../../../types/expressions.type'
import { TemplateValue } from '../../../../types/template.type'
import TemplateFactory from '../../../nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../../../id-generators/NodeIDGenerator'
import {
  TestPredicateASTNode,
  AndPredicateASTNode,
  OrPredicateASTNode,
  NotPredicateASTNode,
  XorPredicateASTNode,
} from '../../../../types/predicates.type'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../../errors/ForgeRuntimeEvaluationError'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import StepValidationCompiler, { ValidationContext } from './StepValidationCompiler'

function createStep(): StepASTNode {
  return ASTTestFactory.step()
    .withPath('/step')
    .withTitle('Step')
    .build()
}

function createFieldBlock(code: unknown): FieldBlockASTNode {
  return ASTTestFactory.block('text-input', BlockType.FIELD)
    .withProperty('code', code)
    .build() as FieldBlockASTNode
}

function createReference(path: string[]): ReferenceASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    id: ASTTestFactory.getId(),
    properties: { path },
  } as ReferenceASTNode
}

function createConditionFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.CONDITION,
    id: ASTTestFactory.getId(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createGeneratorFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.GENERATOR,
    id: ASTTestFactory.getId(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createTestPredicate(
  subject: ReferenceASTNode,
  condition: FunctionASTNode,
  negate = false,
): TestPredicateASTNode {
  return {
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    id: ASTTestFactory.getId(),
    properties: { subject, condition, negate },
  } as TestPredicateASTNode
}

function createValidation(
  condition:
    | TestPredicateASTNode
    | AndPredicateASTNode
    | OrPredicateASTNode
    | NotPredicateASTNode
    | XorPredicateASTNode,
  message: string | FunctionASTNode,
  options: { submissionOnly?: boolean; details?: Record<string, unknown>; groups?: string[] } = {},
): ValidationASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.VALIDATION,
    id: ASTTestFactory.getId(),
    properties: {
      condition,
      message,
      submissionOnly: options.submissionOnly,
      details: options.details,
      groups: options.groups,
    },
  } as ValidationASTNode
}

function createCtx(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    conditions: {
      get: vi.fn((name: string) => {
        if (name === FORMAT_STRING_GENERATOR_NAME) {
          return FormatGeneratorsRegistry[FORMAT_STRING_GENERATOR_NAME]
        }

        if (name === 'isRequired') {
          return {
            evaluate: (value: unknown) =>
              value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
          }
        }

        if (name === 'hasMaxLength') {
          return {
            evaluate: (value: unknown, max: number) => typeof value === 'string' && value.length <= max,
          }
        }

        if (name === 'equals') {
          return {
            evaluate: (value: unknown, expected: unknown) => value === expected,
          }
        }

        if (name === 'trim') {
          return {
            evaluate: (value: unknown) => (typeof value === 'string' ? value.trim() : value),
          }
        }

        return { evaluate: () => false }
      }),
    } as unknown as ValidationContext['conditions'],
    ...overrides,
  }
}

describe('StepValidationCompiler', () => {
  let compiler: StepValidationCompiler
  const dependencies: CompilationDependencies = { functionRegistry: new FunctionRegistry() }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepValidationCompiler(dependencies)
  })

  describe('compileOnEntryValidation()', () => {
    it('should return undefined when no entries are configured', () => {
      // Act
      const fn = compiler.compileOnEntryValidation(undefined)

      // Assert
      expect(fn).toBeUndefined()
    })

    it('should collect groups for matching entries', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const entries: StepEntryValidationAST[] = [
        { groups: ['contact'], when: true },
        {
          groups: ['address'],
          when: ASTTestFactory.predicate(PredicateType.TEST, {
            subject: ASTTestFactory.expression(ExpressionType.REFERENCE)
              .withProperty('path', ['data', 'addressLoaded'])
              .build(),
            condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', [true]),
          }),
        },
      ]

      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new StepValidationCompiler({ functionRegistry })
      const fn = localCompiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx({ conditions: functionRegistry, data: { addressLoaded: true } }))

      // Assert
      expect(result).toEqual(['contact', 'address'])
    })

    it('should await async entry predicates', async () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()
      const entries: StepEntryValidationAST[] = [
        {
          groups: ['address'],
          when: ASTTestFactory.predicate(PredicateType.TEST, {
            subject: ASTTestFactory.expression(ExpressionType.REFERENCE)
              .withProperty('path', ['data', 'addressLoaded'])
              .build(),
            condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', [true]),
          }),
        },
      ]

      functionRegistry.register({
        equals: {
          name: 'equals',
          isAsync: true,
          evaluate: async (value: unknown, expected: unknown) => value === expected,
        },
      })

      const localCompiler = new StepValidationCompiler({ functionRegistry })
      const fn = localCompiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx({ conditions: functionRegistry, data: { addressLoaded: true } }))

      // Assert
      expect(result).toEqual(['address'])
    })

    it('should deduplicate groups across matching entries', async () => {
      // Arrange
      const entries: StepEntryValidationAST[] = [
        { groups: ['contact'], when: true },
        { groups: ['contact', 'address'], when: true },
      ]

      const fn = compiler.compileOnEntryValidation(entries)

      // Act
      const result = await fn!(createCtx())

      // Assert
      expect(result).toEqual(['contact', 'address'])
    })
  })

  describe('compileOnSubmitValidation()', () => {
    it('should keep compiled validation synchronous when registry functions are sync', () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('firstName')
      const validation = createValidation(
        createTestPredicate(createReference(['answers', 'firstName']), createConditionFunction('isRequired')),
        'Enter your first name',
      )
      const functionRegistry = new FunctionRegistry()

      block.properties.validWhen = [validation]
      functionRegistry.register({
        isRequired: {
          name: 'isRequired',
          isAsync: false,
          evaluate: (value: unknown) => value !== undefined && value !== '',
        },
      })

      const localCompiler = new StepValidationCompiler({ functionRegistry })

      // Act
      const source = localCompiler.generateOnSubmitValidationSource(step, [block], [], [])
      const fn = localCompiler.compileOnSubmitValidation(step, [block], [], [])
      const result = fn!(
        createCtx({
          answers: { firstName: { current: 'Ada' } },
          conditions: functionRegistry,
        }),
        false,
      )

      // Assert
      expect(source).not.toContain('await')
      expect(result).not.toBeInstanceOf(Promise)

      if (result instanceof Promise) {
        throw new Error('Expected sync validation result')
      }

      expect(result.isValid).toBe(true)
    })

    it('should await async validation conditions when registry functions are async', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('firstName')
      const validation = createValidation(
        createTestPredicate(createReference(['answers', 'firstName']), createConditionFunction('isRequired')),
        'Enter your first name',
      )
      const functionRegistry = new FunctionRegistry()

      block.properties.validWhen = [validation]
      functionRegistry.register({
        isRequired: {
          name: 'isRequired',
          isAsync: true,
          evaluate: async (value: unknown) => value !== undefined && value !== '',
        },
      })

      const localCompiler = new StepValidationCompiler({ functionRegistry })

      // Act
      const source = localCompiler.generateOnSubmitValidationSource(step, [block], [], [])
      const fn = localCompiler.compileOnSubmitValidation(step, [block], [], [])
      const result = await fn!(
        createCtx({
          answers: { firstName: { current: 'Ada' } },
          conditions: functionRegistry,
        }),
        false,
      )

      // Assert
      expect(source).toContain('await')
      expect(result.isValid).toBe(true)
    })

    it('should compile a single field with a required validation', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('firstName')
      const ref = createReference(['answers', 'firstName'])
      const cond = createConditionFunction('isRequired')
      const pred = createTestPredicate(ref, cond)
      const validation = createValidation(pred, 'Enter your first name')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { firstName: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])

      // Assert
      expect(fn).toBeDefined()
      const result = await fn!(ctx, false)
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].blockCode).toBe('firstName')
      expect(result.fieldFailures[0].message).toBe('Enter your first name')
    })

    it('should resolve dynamic registered field codes as strings', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock(createGeneratorFunction('fieldCode'))
      const validation = createValidation(
        createTestPredicate(createReference(['@self']), createConditionFunction('isRequired')),
        'Enter a value',
      )
      const functionRegistry = new FunctionRegistry()

      block.properties.validWhen = [validation]
      functionRegistry.register({
        fieldCode: {
          name: 'fieldCode',
          isAsync: false,
          evaluate: () => 123,
        },
        isRequired: {
          name: 'isRequired',
          isAsync: false,
          evaluate: (value: unknown) =>
            value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
        },
      })

      const localCompiler = new StepValidationCompiler({ functionRegistry })

      // Act
      const source = localCompiler.generateOnSubmitValidationSource(step, [block], [], [])
      const fn = localCompiler.compileOnSubmitValidation(step, [block], [], [])
      const result = await fn!(
        createCtx({
          answers: { '123': { current: '' } },
          conditions: functionRegistry,
        }),
        false,
      )

      // Assert
      expect(source).toContain('String(')
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures[0].blockCode).toBe('123')
      expect(result.fieldFailures[0].message).toBe('Enter a value')
    })

    it('should pass validation when condition is truthy', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('firstName')
      const ref = createReference(['answers', 'firstName'])
      const cond = createConditionFunction('isRequired')
      const pred = createTestPredicate(ref, cond)
      const validation = createValidation(pred, 'Enter your first name')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { firstName: { current: 'John' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should compile multiple validations on one field', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('email')
      const ref1 = createReference(['answers', 'email'])
      const ref2 = createReference(['answers', 'email'])
      const v1 = createValidation(createTestPredicate(ref1, createConditionFunction('isRequired')), 'Enter an email')
      const v2 = createValidation(
        createTestPredicate(ref2, createConditionFunction('hasMaxLength', [100])),
        'Email too long',
      )
      block.properties.validWhen = [v1, v2]

      const ctx = createCtx({ answers: { email: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].message).toBe('Enter an email')
    })

    it('should skip validations when dependentWhen is false', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('conditionalField')
      const ref = createReference(['answers', 'conditionalField'])
      const validation = createValidation(createTestPredicate(ref, createConditionFunction('isRequired')), 'Required')
      block.properties.validWhen = [validation]

      const depRef = createReference(['answers', 'toggle'])
      const depCond = createConditionFunction('equals', ['yes'])
      block.properties.dependentWhen = createTestPredicate(depRef, depCond)

      const ctx = createCtx({
        answers: {
          toggle: { current: 'no' },
          conditionalField: { current: '' },
        },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should run validations when dependentWhen is true', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('conditionalField')
      const ref = createReference(['answers', 'conditionalField'])
      const validation = createValidation(createTestPredicate(ref, createConditionFunction('isRequired')), 'Required')
      block.properties.validWhen = [validation]

      const depRef = createReference(['answers', 'toggle'])
      const depCond = createConditionFunction('equals', ['yes'])
      block.properties.dependentWhen = createTestPredicate(depRef, depCond)

      const ctx = createCtx({
        answers: {
          toggle: { current: 'yes' },
          conditionalField: { current: '' },
        },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
    })

    it('should skip submissionOnly validations when not submitting', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Required on submit',
        { submissionOnly: true },
      )
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { name: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should run submissionOnly validations when submitting', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Required on submit',
        { submissionOnly: true },
      )
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { name: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, true)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures[0].message).toBe('Required on submit')
    })

    it('should run default group validations when groups are omitted', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const validation = createValidation(createTestPredicate(ref, createConditionFunction('isRequired')), 'Required')

      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { name: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures[0].message).toBe('Required')
    })

    it('should skip named group validations when the group is inactive', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('postcode')
      const ref = createReference(['answers', 'postcode'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Enter postcode',
        { groups: ['address'] },
      )

      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { postcode: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false, ['contact'])

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should run named group validations when the group is active', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('postcode')
      const ref = createReference(['answers', 'postcode'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Enter postcode',
        { groups: ['address'] },
      )

      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { postcode: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false, ['address'])

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures[0].message).toBe('Enter postcode')
    })

    it('should run multi-group validations when any group is active', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('postcode')
      const ref = createReference(['answers', 'postcode'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Enter postcode',
        { groups: ['lookup', 'continue'] },
      )

      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { postcode: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false, ['lookup'])

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures[0].message).toBe('Enter postcode')
    })

    it('should skip submissionOnly validations on entry validation even when group matches', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Required on submit',
        { groups: ['contact'], submissionOnly: true },
      )

      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { name: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false, ['contact'])

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should treat condition TypeError as validation failures', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('age')
      const ref = createReference(['answers', 'age'])
      const throwingCond = createConditionFunction('throwingCondition')
      const validation = createValidation(createTestPredicate(ref, throwingCond), 'Invalid age')
      block.properties.validWhen = [validation]

      const ctx = createCtx({
        answers: { age: { current: 'not-a-number' } },
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new TypeError('Type mismatch')
            },
          })),
        } as unknown as ValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures[0].message).toBe('Invalid age')
    })

    it('should throw runtime errors when validation conditions fail unexpectedly', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('age')
      const ref = createReference(['answers', 'age'])
      const throwingCond = createConditionFunction('throwingCondition')
      const validation = createValidation(createTestPredicate(ref, throwingCond), 'Invalid age')
      block.properties.validWhen = [validation]

      const ctx = createCtx({
        answers: { age: { current: 'not-a-number' } },
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('Unexpected failure')
            },
          })),
        } as unknown as ValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])

      // Assert
      try {
        await fn!(ctx, false)
        throw new Error('Expected throwingCondition to throw')
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected throwingCondition to throw the original Error')
        }

        expect(error.message).toBe('Unexpected failure')
        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'validation',
          functionName: 'throwingCondition',
          functionType: FunctionType.CONDITION,
        })
      }
    })

    it('should throw runtime errors when validation message evaluation fails', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const messageGenerator: FunctionASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: FunctionType.GENERATOR,
        id: ASTTestFactory.getId(),
        properties: { name: 'messageGenerator', arguments: [] },
      }
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        messageGenerator,
      )
      block.properties.validWhen = [validation]

      const ctx = createCtx({
        answers: { name: { current: '' } },
        conditions: {
          get: vi.fn((name: string) => {
            if (name === 'isRequired') {
              return { evaluate: () => false }
            }

            return {
              evaluate: () => {
                throw new Error('Message failed')
              },
            }
          }),
        } as unknown as ValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])

      // Assert
      try {
        await fn!(ctx, false)
        throw new Error('Expected messageGenerator to throw')
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected messageGenerator to throw the original Error')
        }

        expect(error.message).toBe('Message failed')
        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'validation',
          functionName: 'messageGenerator',
          functionType: FunctionType.GENERATOR,
        })
      }
    })
  })

  describe('predicates', () => {
    it('should compile AND predicates', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref1 = createReference(['answers', 'field'])
      const ref2 = createReference(['answers', 'field'])
      const andPred: AndPredicateASTNode = {
        type: ASTNodeType.PREDICATE,
        predicateType: PredicateType.AND,
        id: ASTTestFactory.getId(),
        properties: {
          operands: [
            createTestPredicate(ref1, createConditionFunction('isRequired')),
            createTestPredicate(ref2, createConditionFunction('hasMaxLength', [10])),
          ],
        },
      }
      const validation = createValidation(andPred, 'Invalid')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { field: { current: 'hello' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should compile OR predicates', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref1 = createReference(['answers', 'field'])
      const ref2 = createReference(['answers', 'field'])
      const orPred: OrPredicateASTNode = {
        type: ASTNodeType.PREDICATE,
        predicateType: PredicateType.OR,
        id: ASTTestFactory.getId(),
        properties: {
          operands: [
            createTestPredicate(ref1, createConditionFunction('equals', ['a'])),
            createTestPredicate(ref2, createConditionFunction('equals', ['b'])),
          ],
        },
      }
      const validation = createValidation(orPred, 'Must be a or b')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { field: { current: 'a' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should compile NOT predicates', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref = createReference(['answers', 'field'])
      const notPred: NotPredicateASTNode = {
        type: ASTNodeType.PREDICATE,
        predicateType: PredicateType.NOT,
        id: ASTTestFactory.getId(),
        properties: {
          operand: createTestPredicate(ref, createConditionFunction('equals', ['banned'])),
        },
      }
      const validation = createValidation(notPred, 'Value is banned')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { field: { current: 'ok' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should compile XOR predicates', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref1 = createReference(['answers', 'a'])
      const ref2 = createReference(['answers', 'b'])
      const xorPred: XorPredicateASTNode = {
        type: ASTNodeType.PREDICATE,
        predicateType: PredicateType.XOR,
        id: ASTTestFactory.getId(),
        properties: {
          operands: [
            createTestPredicate(ref1, createConditionFunction('isRequired')),
            createTestPredicate(ref2, createConditionFunction('isRequired')),
          ],
        },
      }
      const validation = createValidation(xorPred, 'Choose exactly one')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { a: { current: 'yes' }, b: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should compile negated TEST predicates', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref = createReference(['answers', 'field'])
      const pred = createTestPredicate(ref, createConditionFunction('equals', ['banned']), true)
      const validation = createValidation(pred, 'Value is banned')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { field: { current: 'banned' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
    })
  })

  describe('references', () => {
    it('should compile nested answer references', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('user')
      const ref = createReference(['answers', 'user', 'address', 'postcode'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Enter postcode',
      )
      block.properties.validWhen = [validation]

      const ctx = createCtx({
        answers: { user: { current: { address: { postcode: '' } } } },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
    })

    it('should compile Data references', () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref = createReference(['data', 'maxAge'])
      const answerRef = createReference(['answers', 'field'])
      const validation = createValidation(
        createTestPredicate(answerRef, createConditionFunction('hasMaxLength', [ref as unknown as number])),
        'Too long',
      )
      block.properties.validWhen = [validation]

      // Act
      const source = compiler.generateOnSubmitValidationSource(step, [block], [])

      // Assert
      expect(source).toContain('ctx.data?.["maxAge"]')
    })

    it('should compile Session references', () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const sessionRef = createReference(['session', 'userId'])
      const answerRef = createReference(['answers', 'field'])
      const validation = createValidation(
        createTestPredicate(answerRef, createConditionFunction('equals', [sessionRef as unknown])),
        'Must match session',
      )
      block.properties.validWhen = [validation]

      // Act
      const source = compiler.generateOnSubmitValidationSource(step, [block], [])

      // Assert
      expect(source).toContain('ctx.session')
    })
  })

  describe('domain validations', () => {
    it('should compile domain validations', async () => {
      // Arrange
      const step = createStep()
      const ref = createReference(['answers', 'password'])
      const pred = createTestPredicate(ref, createConditionFunction('isRequired'))
      const domainValidation = createValidation(pred, 'Password is required')

      const ctx = createCtx({ answers: { password: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [domainValidation])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.domainFailures).toHaveLength(1)
      expect(result.domainFailures[0].message).toBe('Password is required')
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should only run domain validations for active groups', async () => {
      // Arrange
      const step = createStep()
      const ref = createReference(['answers', 'password'])
      const pred = createTestPredicate(ref, createConditionFunction('isRequired'))
      const domainValidation = createValidation(pred, 'Password is required', { groups: ['security'] })

      const ctx = createCtx({ answers: { password: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [domainValidation])
      const inactiveResult = await fn!(ctx, false, ['default'])
      const activeResult = await fn!(ctx, false, ['security'])

      // Assert
      expect(inactiveResult.isValid).toBe(true)
      expect(inactiveResult.domainFailures).toHaveLength(0)
      expect(activeResult.isValid).toBe(false)
      expect(activeResult.domainFailures[0].message).toBe('Password is required')
    })
  })

  describe('generateOnSubmitValidationSource()', () => {
    it('should produce readable source code', () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('isRequired')),
        'Enter your name',
      )
      block.properties.validWhen = [validation]

      // Act
      const source = compiler.generateOnSubmitValidationSource(step, [block], [])

      // Assert
      expect(source).toContain('"use strict"')
      expect(source).toContain('const errors = []')
      expect(source).toContain('ctx.answers["name"]?.current')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('"isRequired"')
      expect(source).toContain('"Enter your name"')
      expect(source).toContain('return {')
    })
  })

  describe('details', () => {
    it('should include details in error output', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const ref = createReference(['answers', 'field'])
      const validation = createValidation(createTestPredicate(ref, createConditionFunction('isRequired')), 'Required', {
        details: { component: 'text-input', errorType: 'required' },
      })
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { field: { current: '' } } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.fieldFailures[0].details).toEqual({ component: 'text-input', errorType: 'required' })
    })
  })

  describe('iterators', () => {
    function createTemplateValue(value: unknown): TemplateValue {
      return new TemplateFactory(new NodeIDGenerator()).compile(value)
    }

    function createIterateNode(input: unknown, yieldTemplate: TemplateValue): IterateASTNode {
      return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withProperty('input', input)
        .withProperty('iterator', {
          type: IteratorType.MAP,
          yieldTemplate,
        })
        .build()
    }

    it('should compile iterator with static field code and validation', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'name',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['answers', '@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Enter a name',
                },
              },
            ],
          },
        }),
      )

      const ctx = createCtx({
        data: { items: [{ id: 1 }, { id: 2 }] },
        answers: { name: { current: '' } },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(2)
      expect(result.fieldFailures[0].blockId).toBe('compiled:name')
      expect(result.fieldFailures[0].blockCode).toBe('name')
      expect(result.fieldFailures[0].message).toBe('Enter a name')
      expect(result.fieldFailures[1].blockId).toBe('compiled:name')
      expect(result.fieldFailures[1].blockCode).toBe('name')
      expect(result.fieldFailures[1].message).toBe('Enter a name')
    })

    it('should resolve Self references for iterator fields with static field code', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'name',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Enter a name',
                },
              },
            ],
          },
        }),
      )

      const ctx = createCtx({
        data: { items: [{ id: 1 }, { id: 2 }] },
        answers: { name: { current: 'Ada' } },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should only run iterator validations for active groups', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'name',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  groups: ['items'],
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['answers', '@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Enter a name',
                },
              },
            ],
          },
        }),
      )

      const ctx = createCtx({
        data: { items: [{ id: 1 }] },
        answers: { name: { current: '' } },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const inactiveResult = await fn!(ctx, false, ['default'])
      const activeResult = await fn!(ctx, false, ['items'])

      // Assert
      expect(inactiveResult.isValid).toBe(true)
      expect(inactiveResult.fieldFailures).toHaveLength(0)
      expect(activeResult.isValid).toBe(false)
      expect(activeResult.fieldFailures[0].message).toBe('Enter a name')
    })

    it('should compile iterator with dynamic field code using Loop.Index0()', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: ASTTestFactory.formatExpression('item_%1', [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.REFERENCE,
                properties: { path: ['@loop', '0', 'index0'] },
              },
            ]),
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['answers', '@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Required',
                },
              },
            ],
          },
        }),
      )

      const ctx = createCtx({
        data: { items: ['a', 'b', 'c'] },
        answers: {
          item_0: { current: 'filled' },
          item_1: { current: '' },
          item_2: { current: 'filled' },
        },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].blockId).toBe('compiled:item_1')
      expect(result.fieldFailures[0].blockCode).toBe('item_1')
      expect(result.fieldFailures[0].message).toBe('Required')
    })

    it('should compile iterator validation against the raw item value', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'item',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['@scope', '0'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Item is required',
                },
              },
            ],
          },
        }),
      )
      const ctx = createCtx({
        data: { items: ['', 'Ada'] },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].message).toBe('Item is required')
    })

    it('should compile iterator validation over object maps with Item().key()', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: ASTTestFactory.formatExpression('item_%1', [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.REFERENCE,
                properties: { path: ['@scope', '0', '@key'] },
              },
            ]),
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['answers', '@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Required',
                },
              },
            ],
          },
        }),
      )
      const ctx = createCtx({
        data: { items: { alpha: 'a', beta: 'b' } },
        answers: {
          item_alpha: { current: 'filled' },
          item_beta: { current: '' },
        },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].blockCode).toBe('item_beta')
    })

    it('should compile iterator with Item().path() references in validation', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'people']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'person',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['@scope', '0', 'name'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Name is required',
                },
              },
            ],
          },
        }),
      )

      const ctx = createCtx({
        data: { people: [{ name: 'Alice' }, { name: '' }] },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].message).toBe('Name is required')
    })

    it('should compile field validWhen rules yielded by an iterator', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const iterateNode = createIterateNode(
        createReference(['data', 'requirements']),
        createTemplateValue(
          createValidation(
            createTestPredicate(createReference(['@self']), createConditionFunction('isRequired')),
            'Enter a name',
          ),
        ),
      )

      block.properties.validWhen = iterateNode

      const ctx = createCtx({
        data: { requirements: [{ id: 'first' }, { id: 'second' }] },
        answers: { name: { current: '' } },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(2)
      expect(result.fieldFailures[0].blockId).toBe(block.id)
      expect(result.fieldFailures[0].blockCode).toBe('name')
      expect(result.fieldFailures[0].message).toBe('Enter a name')
    })

    it('should resolve Self references inside field validWhen iterators', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const iterateNode = createIterateNode(
        createReference(['data', 'requirements']),
        createTemplateValue(
          createValidation(
            createTestPredicate(createReference(['@self']), createConditionFunction('isRequired')),
            'Enter a name',
          ),
        ),
      )

      block.properties.validWhen = iterateNode

      const ctx = createCtx({
        data: { requirements: [{ id: 'first' }, { id: 'second' }] },
        answers: { name: { current: 'Ada' } },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should compile field validWhen iterator rules with Item references', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('status')
      const iterateNode = createIterateNode(
        createReference(['data', 'checks']),
        createTemplateValue(
          createValidation(
            createTestPredicate(createReference(['@scope', '0', 'enabled']), createConditionFunction('equals', [true])),
            'Check must be enabled',
          ),
        ),
      )

      block.properties.validWhen = [iterateNode]

      const ctx = createCtx({
        data: { checks: [{ enabled: true }, { enabled: false }] },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [block], [], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].message).toBe('Check must be enabled')
    })

    it('should compile step validWhen rules yielded by an iterator', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'checks']),
        createTemplateValue(
          createValidation(
            createTestPredicate(createReference(['@scope', '0', 'passed']), createConditionFunction('equals', [true])),
            'All checks must pass',
          ),
        ),
      )

      const ctx = createCtx({
        data: { checks: [{ passed: true }, { passed: false }] },
      })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [iterateNode], [])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.domainFailures).toHaveLength(1)
      expect(result.domainFailures[0].message).toBe('All checks must pass')
    })

    it('should generate source with iterator loop', () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'field',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['answers', '@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Required',
                },
              },
            ],
          },
        }),
      )

      // Act
      const source = compiler.generateOnSubmitValidationSource(step, [], [], [iterateNode])

      // Assert
      expect(source).toContain('while (iteratorIndex < iteratorInput.length)')
      expect(source).toContain('const currentIteratorIndex = iteratorIndex;')
      expect(source).toContain('Array.isArray')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('"isRequired"')
      expect(source).toContain('blockId: "compiled:" + "field"')
    })

    it('should handle empty input arrays', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'items']),
        createTemplateValue({
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: {
            code: 'field',
            validWhen: [
              {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.VALIDATION,
                properties: {
                  condition: {
                    type: ASTNodeType.PREDICATE,
                    predicateType: PredicateType.TEST,
                    properties: {
                      subject: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: { path: ['answers', '@self'] },
                      },
                      condition: {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: FunctionType.CONDITION,
                        properties: { name: 'isRequired', arguments: [] },
                      },
                      negate: false,
                    },
                  },
                  message: 'Required',
                },
              },
            ],
          },
        }),
      )

      const ctx = createCtx({ data: { items: [] } })

      // Act
      const fn = compiler.compileOnSubmitValidation(step, [], [], [iterateNode])
      const result = await fn!(ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })
  })
})
