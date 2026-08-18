import { beforeEach, describe, expect, it, vi } from 'vitest'
import AuthoredValueClassifier from '../../../chassis/compilation/analysis/shared/AuthoredValueClassifier'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType, PredicateType } from '../../../../authoring/types/enums'
import {
  FORMAT_STRING_GENERATOR_NAME,
  formatGeneratorsRegistry,
} from '../../../../built-ins/functions/generators/formatGenerators'
import { FieldBlockASTNode, StepASTNode } from '../../../chassis/contracts/ast/structures.type'
import {
  FunctionASTNode,
  IterateASTNode,
  ReferenceASTNode,
  ValidationASTNode,
} from '../../../chassis/contracts/ast/expressions.type'
import { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import { compileTemplate } from '../../../chassis/compilation/ast/nodes/template'
import { NodeIDGenerator } from '../../../chassis/compilation/ast/ast-state/NodeIDGenerator'
import {
  TestPredicateASTNode,
  AndPredicateASTNode,
  OrPredicateASTNode,
  NotPredicateASTNode,
  XorPredicateASTNode,
} from '../../../chassis/contracts/ast/predicates.type'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import { buildStepFieldModels } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import { classifyValidationRules, hasConfiguredValue } from '../../../chassis/contracts/models/validationRules'
import type { ValidationModel } from '../contracts/validationModel.type'
import StepValidationCompiler from './StepValidationCompiler'
import type { CompiledValidationContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import type {
  CompiledValidationFunction,
  CompiledValidationWorkTask,
} from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type { StepValidityResult } from '../contracts/stepValidityResult.type'
import type { ValidationView } from '../contracts/validationView.type'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { isWorkTask } from '../../../chassis/work/workTask'
import type { WorkTask } from '../../../chassis/contracts/work/work.type'
import { workTaskBuilders } from '../../../chassis/runtime/context/compiledEvaluationContext'

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
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { path },
  } as ReferenceASTNode
}

function createConditionFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.CONDITION,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createGeneratorFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.GENERATOR,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
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
    diagnostics: ASTTestFactory.diagnostics(),
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
    diagnostics: ASTTestFactory.diagnostics(),
    properties: {
      condition,
      message,
      submissionOnly: options.submissionOnly,
      details: options.details,
      groups: options.groups,
    },
  } as ValidationASTNode
}

function createCtx(overrides: Partial<CompiledValidationContext> = {}): CompiledValidationContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: {},
    workTasks: workTaskBuilders,
    conditions: {
      get: vi.fn((name: string) => {
        if (name === FORMAT_STRING_GENERATOR_NAME) {
          return formatGeneratorsRegistry.build()[FORMAT_STRING_GENERATOR_NAME]
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
    } as unknown as CompiledValidationContext['conditions'],
    ...overrides,
  }
}

async function executeValidation(
  fn: CompiledValidationFunction,
  ctx: CompiledValidationContext,
  includeSubmissionOnly: boolean,
  groups: string[] = ['default'],
): Promise<ValidationView> {
  const task = await fn(ctx, { groups, includeSubmissionOnly })
  const stored = await executeValidationTask(task, ctx)

  return {
    isValid: stored.fieldFailures.length === 0 && stored.domainFailures.length === 0,
    fieldFailures: stored.fieldFailures,
    domainFailures: stored.domainFailures,
  }
}

async function executeValidationTask(
  task: CompiledValidationWorkTask,
  ctx: CompiledValidationContext,
): Promise<StepValidityResult> {
  if (!isStepValidationWorkTask(task)) {
    throw new Error('Expected compiled validation to return a work task')
  }

  return (await new WorkExecutor().execute(task, new WorkContext(ctx))).output
}

function isStepValidationWorkTask(value: unknown): value is WorkTask<'validation.step', unknown> {
  return isWorkTask(value)
}

function valModel(
  stepNode: unknown,
  fieldBlocks: FieldBlockASTNode[],
  validWhen?: unknown,
  iterateNodes: IterateASTNode[] = [],
): ValidationModel {
  return {
    label: undefined,
    hasValidation: true,
    fields: buildStepFieldModels({ fieldBlocks, iterateNodes }).filter(field => field.validation !== undefined),
    domainRules: hasConfiguredValue(validWhen)
      ? classifyValidationRules(validWhen, value => new AuthoredValueClassifier().classify(value))
      : undefined,
    entryValidation: [],
  }
}

describe('StepValidationCompiler', () => {
  let compiler: StepValidationCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  dependencies.functionRegistry.register({
    equals: { name: 'equals', isAsync: true, evaluate: () => undefined },
    FormatString: { name: 'FormatString', isAsync: true, evaluate: () => undefined },
    hasMaxLength: { name: 'hasMaxLength', isAsync: true, evaluate: () => undefined },
    isRequired: { name: 'isRequired', isAsync: true, evaluate: () => undefined },
    messageGenerator: { name: 'messageGenerator', isAsync: true, evaluate: () => undefined },
    throwingCondition: { name: 'throwingCondition', isAsync: true, evaluate: () => undefined },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepValidationCompiler(dependencies)
  })

  describe('compileStepValidation()', () => {
    it('should return an empty validation task when no validation rules are configured', async () => {
      // Arrange
      const step = createStep()
      const ctx = createCtx()

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [], undefined))
      const result = await executeValidationTask(
        await fn(ctx, { groups: ['default'], includeSubmissionOnly: false }),
        ctx,
      )

      // Assert
      expect(result).toEqual({ fieldFailures: [], domainFailures: [] })
    })
    it('should keep compiled validation synchronous when registry functions are sync', async () => {
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

      const localCompiler = new StepValidationCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = localCompiler.generateStepValidationSource(valModel(step, [block], [], []))
      const fn = localCompiler.compileStepValidation(valModel(step, [block], [], []))
      const ctx = createCtx({
        answers: { firstName: { current: 'Ada' } },
        conditions: functionRegistry,
      })
      const task = fn!(ctx, { groups: ['default'], includeSubmissionOnly: false })

      // Assert
      expect(source).not.toContain('await')
      expect(source).not.toContain('async function')
      expect(task).not.toBeInstanceOf(Promise)

      if (task instanceof Promise) {
        throw new Error('Expected sync validation task')
      }

      const result = await executeValidationTask(task, ctx)

      expect(result.fieldFailures).toHaveLength(0)
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

      const localCompiler = new StepValidationCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = localCompiler.generateStepValidationSource(valModel(step, [block], [], []))
      const fn = localCompiler.compileStepValidation(valModel(step, [block], [], []))
      const result = await executeValidation(
        fn!,
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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))

      // Assert
      expect(fn).toBeDefined()
      const result = await executeValidation(fn!, ctx, false)
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

      const localCompiler = new StepValidationCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = localCompiler.generateStepValidationSource(valModel(step, [block], [], []))
      const fn = localCompiler.compileStepValidation(valModel(step, [block], [], []))
      const result = await executeValidation(
        fn!,
        createCtx({
          answers: { '123': { current: '' } },
          conditions: functionRegistry,
        }),
        false,
      )

      // Assert
      expect(source).toContain('String(')
      expect(source).toContain('function validateField()')
      expect(source).toContain('function evaluate_field_condition()')
      expect(source).not.toContain('validate_123')
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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, true)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false, ['contact'])

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })

    it('should not evaluate submissionOnly rule conditions outside the active groups', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('title')
      const ref = createReference(['answers', 'title'])
      const throwingCond = createConditionFunction('throwingCondition')
      const validation = createValidation(createTestPredicate(ref, throwingCond), 'Publish rule', {
        groups: ['publish'],
        submissionOnly: true,
      })

      block.properties.validWhen = [validation]

      const ctx = createCtx({
        answers: { title: { current: '' } },
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('Rule condition must not run')
            },
          })),
        } as unknown as CompiledValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, true, ['save'])

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false, ['address'])

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false, ['lookup'])

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false, ['contact'])

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
        } as unknown as CompiledValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
        } as unknown as CompiledValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [block], []))

      // Assert
      try {
        await executeValidation(fn!, ctx, false)
        throw new Error('Expected throwingCondition to throw')
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected throwingCondition to throw the original Error')
        }

        expect(error.message).toBe('Failed to evaluate compiled Forge validation function: Unexpected failure')
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
        diagnostics: ASTTestFactory.diagnostics(),
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
        } as unknown as CompiledValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [block], []))

      // Assert
      try {
        await executeValidation(fn!, ctx, false)
        throw new Error('Expected messageGenerator to throw')
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected messageGenerator to throw the original Error')
        }

        expect(error.message).toBe('Failed to evaluate compiled Forge validation function: Message failed')
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
        diagnostics: ASTTestFactory.diagnostics(),
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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
    })

    it('should compile OR predicates', async () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('field')
      const evaluateEquals = vi.fn((value: unknown, expected: unknown) => value === expected)
      const ref1 = createReference(['answers', 'field'])
      const ref2 = createReference(['answers', 'field'])
      const orPred: OrPredicateASTNode = {
        type: ASTNodeType.PREDICATE,
        predicateType: PredicateType.OR,
        id: ASTTestFactory.getId(),
        diagnostics: ASTTestFactory.diagnostics(),
        properties: {
          operands: [
            createTestPredicate(ref1, createConditionFunction('equals', ['a'])),
            createTestPredicate(ref2, createConditionFunction('equals', ['b'])),
          ],
        },
      }
      const validation = createValidation(orPred, 'Must be a or b')
      block.properties.validWhen = [validation]

      const ctx = createCtx({
        answers: { field: { current: 'a' } },
        conditions: {
          get: vi.fn(() => ({ evaluate: evaluateEquals })),
        } as unknown as CompiledValidationContext['conditions'],
      })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(evaluateEquals).toHaveBeenCalledOnce()
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
        diagnostics: ASTTestFactory.diagnostics(),
        properties: {
          operand: createTestPredicate(ref, createConditionFunction('equals', ['banned'])),
        },
      }
      const validation = createValidation(notPred, 'Value is banned')
      block.properties.validWhen = [validation]

      const ctx = createCtx({ answers: { field: { current: 'ok' } } })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
        diagnostics: ASTTestFactory.diagnostics(),
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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const source = compiler.generateStepValidationSource(valModel(step, [block], []))

      // Assert
      expect(source).toContain('ctx.data?.maxAge')
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
      const source = compiler.generateStepValidationSource(valModel(step, [block], []))

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
      const fn = compiler.compileStepValidation(valModel(step, [], [domainValidation]))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [], [domainValidation]))
      const inactiveResult = await executeValidation(fn!, ctx, false, ['default'])
      const activeResult = await executeValidation(fn!, ctx, false, ['security'])

      // Assert
      expect(inactiveResult.isValid).toBe(true)
      expect(inactiveResult.domainFailures).toHaveLength(0)
      expect(activeResult.isValid).toBe(false)
      expect(activeResult.domainFailures[0].message).toBe('Password is required')
    })
  })

  describe('generateStepValidationSource()', () => {
    it('should produce readable source code', () => {
      // Arrange
      const step = createStep()
      const block = createFieldBlock('name')
      const ref = createReference(['answers', 'name'])
      const validation = createValidation(
        createTestPredicate(ref, createConditionFunction('hasMaxLength', [10])),
        'Enter your name',
      )
      block.properties.validWhen = [validation]

      // Act
      const source = compiler.generateStepValidationSource(valModel(step, [block], []))

      // Assert
      expect(source).toContain('"use strict"')
      expect(source).toContain(
        [
          '// --- Active validation groups ---',
          '// Use the default group when the request does not select one.',
          'const requestedGroups = filter.groups.length > 0 ? filter.groups : ["default"];',
          'const activeGroups = new Set(requestedGroups);',
          '',
          'function ruleIsActive(rule) {',
          '  // Use the default group when the rule does not declare one.',
          '  const ruleGroups = Array.isArray(rule.groups) && rule.groups.length > 0 ? rule.groups : ["default"];',
          '',
          '  // A rule runs when any of its groups is active.',
          '  const hasActiveGroup = ruleGroups.some(',
          '    function isActiveValidationGroup(group) {',
          '      return activeGroups.has(group);',
          '    }',
          '  );',
          '',
          '  if (!hasActiveGroup) {',
          '    return false;',
          '  }',
          '',
          '  // Submission-only rules are skipped unless this validation run includes them.',
          '  const submissionOnlyIsIncluded = filter.includeSubmissionOnly === true;',
          '',
          '  return rule.submissionOnly !== true || submissionOnlyIsIncluded;',
          '}',
        ].join('\n'),
      )
      expect(source).not.toContain('Object.create(null)')
      expect(source).not.toContain('registerActiveValidationGroup')
      expect(source).not.toContain('String(activeGroup)')
      expect(source).not.toContain('const errors = []')
      expect(source).toContain('async function validate_name()')
      expect(source).toContain('run: validate_name')
      expect(source).not.toContain('run: async function validate_name')
      expect(source).not.toContain('function validate_name_results(results)')
      expect(source).not.toContain('function create_name_validation()')
      expect(source).not.toContain('function evaluate_name_validation()')
      expect(source).toContain('condition: async function evaluate_name_condition()')
      expect(source).not.toContain('function evaluate_name_hasMaxLength()')
      expect(source).not.toContain('function evaluate_name_message()')
      expect(source).not.toContain('function evaluate_name_details()')
      expect(source).toContain('const subject =')
      expect(source).toContain('const functionArgument1 = 10')
      expect(source).toContain('return (await _forgeHelpers.evaluateFunctionAsync(')
      expect(source).not.toContain('evaluateTracked')
      expect(source).not.toContain('const functionResult')
      expect(source).not.toContain('const conditionResult')
      expect(source).not.toContain('_forgeHelpers.evaluateValidationCondition')
      expect(source).toContain(
        [
          '      return await _forgeHelpers.collectFieldValidationFailuresAsync(',
          '        validationRules,',
          '        ruleIsActive,',
          '        { blockId: "compile_ast:2", blockCode: "name" }',
          '      );',
        ].join('\n'),
      )
      expect(source).not.toContain('const validationStack = [results]')
      expect(source).not.toContain('RuntimeValueCompiler.compileArrayValue')
      expect(source).toContain(
        [
          '      const validationRules = [',
          '        {',
          '          condition: async function evaluate_name_condition() {',
          '            const subject = ctx.answers.name?.current;',
          '            const functionArgument1 = 10;',
          '',
          '            return (await _forgeHelpers.evaluateFunctionAsync(',
          '              ctx,',
          '              _forgeRuntimeDiagnostics,',
          '              0,',
          '              "hasMaxLength",',
          '              [subject, functionArgument1]',
          '            ));',
          '          },',
          '          message: "Enter your name",',
          '          submissionOnly: false',
          '        }',
          '      ];',
        ].join('\n'),
      )
      expect(source).toContain('ctx.answers.name?.current')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('"hasMaxLength"')
      expect(source).toMatch(/_forgeRuntimeDiagnostics,\s+\d+,/)
      expect(source).not.toContain('"nodeId"')
      expect(source).not.toContain('"formattedPath"')
      expect(source).not.toContain('"functionType"')
      expect(source).not.toContain('"definedAt"')
      expect(source).toContain('"Enter your name"')
      expect(source).toContain('ctx.workTasks.fieldValidation("field:compile_ast:2"')
      expect(source).not.toContain('"field:" + String')
      expect(source).not.toContain('details: undefined')
      expect(source).toContain('return ctx.workTasks.stepValidation(fieldValidations, domainValidations)')
    })

    it('should emit only the empty validation task when no rules are configured', () => {
      // Arrange
      const step = createStep()

      // Act
      const source = compiler.generateStepValidationSource(valModel(step, [], undefined))

      // Assert
      expect(source).toContain('// This step declares no validation rules.')
      expect(source).toContain('return ctx.workTasks.stepValidation([], [])')
      expect(source).not.toContain('ruleIsActive')
      expect(source).not.toContain('const fieldValidations')
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
      const fn = compiler.compileStepValidation(valModel(step, [block], []))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.fieldFailures[0].details).toEqual({ component: 'text-input', errorType: 'required' })
    })
  })

  describe('iterators', () => {
    function createTemplateValue(value: unknown): TemplateValue {
      return compileTemplate(value, new NodeIDGenerator())
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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(2)
      expect(result.fieldFailures[0].blockId).toBe('compiled:template:1:0')
      expect(result.fieldFailures[0].blockCode).toBe('name')
      expect(result.fieldFailures[0].message).toBe('Enter a name')
      expect(result.fieldFailures[1].blockId).toBe('compiled:template:1:1')
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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const inactiveResult = await executeValidation(fn!, ctx, false, ['default'])
      const activeResult = await executeValidation(fn!, ctx, false, ['items'])

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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toHaveLength(1)
      expect(result.fieldFailures[0].blockId).toBe('compiled:template:1:1')
      expect(result.fieldFailures[0].blockCode).toBe('item_1')
      expect(result.fieldFailures[0].message).toBe('Required')
    })

    it('should compile nested iterator field validations in nested loop scope', async () => {
      // Arrange
      const step = createStep()
      const iterateNode = createIterateNode(
        createReference(['data', 'teams']),
        createTemplateValue([
          {
            type: ASTNodeType.EXPRESSION,
            expressionType: ExpressionType.ITERATE,
            properties: {
              input: {
                type: ASTNodeType.EXPRESSION,
                expressionType: ExpressionType.REFERENCE,
                properties: { path: ['@scope', 0, 'members'] },
              },
              iterator: {
                type: IteratorType.MAP,
                yieldTemplate: [
                  {
                    type: ASTNodeType.BLOCK,
                    variant: 'text-input',
                    blockType: BlockType.FIELD,
                    properties: {
                      code: ASTTestFactory.formatExpression('team_%1_member_%2', [
                        {
                          type: ASTNodeType.EXPRESSION,
                          expressionType: ExpressionType.REFERENCE,
                          properties: { path: ['@loop', '1', 'index0'] },
                        },
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
                  },
                ],
              },
            },
          },
        ]),
      )
      const ctx = createCtx({
        data: {
          teams: [{ members: [{}, {}] }, { members: [{}] }],
        },
        answers: {
          team_0_member_0: { current: 'Alice' },
          team_0_member_1: { current: '' },
          team_1_member_0: { current: '' },
        },
      })

      // Act
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.isValid).toBe(false)
      expect(result.fieldFailures).toEqual([
        expect.objectContaining({
          blockId: 'compiled:template:3:0:1',
          blockCode: 'team_0_member_1',
          message: 'Required',
        }),
        expect.objectContaining({
          blockId: 'compiled:template:3:1:0',
          blockCode: 'team_1_member_0',
          message: 'Required',
        }),
      ])
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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], [], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], [], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [block], [], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const fn = compiler.compileStepValidation(valModel(step, [], [iterateNode], []))
      const result = await executeValidation(fn!, ctx, false)

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
      const source = compiler.generateStepValidationSource(valModel(step, [], [], [iterateNode]))

      // Assert
      expect(source).toContain('while (iteratorIndex < iteratorInput.length)')
      expect(source).toContain('const currentIteratorIndex = iteratorIndex;')
      expect(source).toContain('Array.isArray')
      expect(source).toContain('_forgeHelpers.evaluateFunction')
      expect(source).toContain('"isRequired"')
      expect(source).toContain('blockId: "compiled:template:1:" + [currentIteratorIndex].join(":")')
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
      const fn = compiler.compileStepValidation(valModel(step, [], [], [iterateNode]))
      const result = await executeValidation(fn!, ctx, false)

      // Assert
      expect(result.isValid).toBe(true)
      expect(result.fieldFailures).toHaveLength(0)
    })
  })
})
