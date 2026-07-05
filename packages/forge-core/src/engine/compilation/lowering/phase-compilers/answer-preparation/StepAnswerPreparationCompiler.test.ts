/* eslint-disable no-new-func */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ASTTestFactory } from '../../../ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../../contracts/ast/enums'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  IteratorType,
  PredicateType,
} from '../../../../../authoring/types/enums'
import {
  FORMAT_STRING_GENERATOR_NAME,
  formatGeneratorsRegistry,
} from '../../../../../authoring/generators/formatGenerators'
import { FieldBlockASTNode } from '../../../../contracts/ast/structures.type'
import { FunctionASTNode, IterateASTNode, ReferenceASTNode } from '../../../../contracts/ast/expressions.type'
import { TestPredicateASTNode } from '../../../../contracts/ast/predicates.type'
import { TemplateValue } from '../../../../contracts/ast/template.type'
import TemplateFactory from '../../../ast/nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../../../ast/ast-state/NodeIDGenerator'
import FunctionRegistry from '../../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../../registries/ComponentRegistry'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../../errors/ForgeRuntimeEvaluationError'
import { generatedFunctionHelpers } from '../../function-construction/GeneratedFunctionHelpers'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import StepAnswerPreparationCompiler from './StepAnswerPreparationCompiler'
import type { CompiledAnswerPreparationFunction } from '../../../../contracts/compiled/compiledFunctions.type'
import type { CompiledAnswerPreparationContext } from '../../../../contracts/compiled/compiledContexts.type'
import type { RequestExecutionContext } from '../../../../contracts/runtime/RequestExecutionContext.type'
import WorkContext from '../../../../runtime/evaluation/work/WorkContext'
import WorkExecutor from '../../../../runtime/evaluation/work/WorkExecutor'
import { isWorkTask } from '../../../../runtime/evaluation/work/workTask'
import WorkTaskFactory from '../../../../runtime/evaluation/work/WorkTaskFactory'

function createSyncRegistry(...funcNames: string[]): FunctionRegistry {
  const registry = new FunctionRegistry()
  const entries: Record<string, { name: string; isAsync: false; evaluate: () => undefined }> = {}

  funcNames.forEach(name => {
    entries[name] = { name, isAsync: false, evaluate: () => undefined }
  })
  registry.register(entries)

  return registry
}

function createSyncCompiler(...funcNames: string[]): StepAnswerPreparationCompiler {
  return new StepAnswerPreparationCompiler({
    functionRegistry: createSyncRegistry(...funcNames),
    componentRegistry: new ComponentRegistry(),
  })
}

function createFieldBlock(code: unknown, props: Record<string, unknown> = {}): FieldBlockASTNode {
  const builder = ASTTestFactory.block('text-input', BlockType.FIELD)
    .withProperty('code', code)

  Object.entries(props).forEach(([key, value]) => {
    builder.withProperty(key, value)
  })

  return builder.build() as FieldBlockASTNode
}

function createTransformerFunction(name: string, args: unknown[] = []): FunctionASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: FunctionType.TRANSFORMER,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { name, arguments: args },
  } as FunctionASTNode
}

function createReference(path: (string | number)[]): ReferenceASTNode {
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

function createTestPredicate(subject: ReferenceASTNode, condition: FunctionASTNode): TestPredicateASTNode {
  return {
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: { subject, condition, negate: false },
  } as TestPredicateASTNode
}

function createCtx(overrides: Partial<CompiledAnswerPreparationContext> = {}): CompiledAnswerPreparationContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: { method: 'POST' },
    conditions: {
      get: vi.fn((name: string) => {
        if (name === FORMAT_STRING_GENERATOR_NAME) {
          return formatGeneratorsRegistry.build()[FORMAT_STRING_GENERATOR_NAME]
        }

        if (name === 'trim') {
          return { evaluate: (value: unknown) => (typeof value === 'string' ? value.trim() : value) }
        }

        if (name === 'toUpperCase') {
          return { evaluate: (value: unknown) => (typeof value === 'string' ? value.toUpperCase() : value) }
        }

        if (name === 'isRequired') {
          return {
            evaluate: (value: unknown) =>
              value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
          }
        }

        if (name === 'truncate') {
          return {
            evaluate: (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : value),
          }
        }

        return { evaluate: () => undefined }
      }),
    } as unknown as CompiledAnswerPreparationContext['conditions'],
    post: {},
    components: new ComponentRegistry(),
    workTasks: WorkTaskFactory,
    ...overrides,
  }
}

function createIterateNode(input: unknown, yieldTemplate: TemplateValue): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    properties: {
      input,
      iterator: {
        type: IteratorType.MAP,
        yieldTemplate,
      },
    },
  } as unknown as IterateASTNode
}

async function runGeneratedSource(source: string, ctx: CompiledAnswerPreparationContext): Promise<void> {
  const fn = new Function('ctx', '_forgeHelpers', '_forgeRuntimeDiagnostics', source)
  const task = fn(ctx, generatedFunctionHelpers, undefined) as unknown

  await executeAnswerPreparationTask(task, ctx)
}

async function executeAnswerPreparation(
  fn: CompiledAnswerPreparationFunction,
  ctx: CompiledAnswerPreparationContext,
): Promise<void> {
  const task = await fn(ctx)

  await executeAnswerPreparationTask(task, ctx)
}

async function executeAnswerPreparationTask(task: unknown, ctx: CompiledAnswerPreparationContext): Promise<void> {
  if (!isWorkTask(task)) {
    throw new Error('Expected answer preparation task')
  }

  // The task's run-closures mutate `ctx.answers`; thread a RequestExecutionContext
  // whose context.answers aliases it, so the trace reads the same store.
  const requestContext = {
    context: { domain: { answers: ctx.answers, data: ctx.data }, evaluation: {}, request: {} },
  } as unknown as RequestExecutionContext

  await new WorkExecutor().execute(task, new WorkContext(requestContext))
}

describe('StepAnswerPreparationCompiler', () => {
  let compiler: StepAnswerPreparationCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepAnswerPreparationCompiler(dependencies)
  })

  describe('compile()', () => {
    it('should return an empty answer preparation task when no fields are configured', async () => {
      // Arrange
      const ctx = createCtx()

      // Act
      const fn = compiler.compile([])

      await executeAnswerPreparation(fn, ctx)

      // Assert
      expect(ctx.answers).toEqual({})
    })
  })

  describe('hybrid async compilation', () => {
    it('should keep compiled answer preparation synchronous when registry functions are sync', async () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter] })
      const functionRegistry = new FunctionRegistry()
      const ctx = createCtx({
        post: { name: '  Ada  ' },
        conditions: functionRegistry,
      })

      functionRegistry.register({
        trim: {
          name: 'trim',
          isAsync: false,
          evaluate: (value: unknown) => (typeof value === 'string' ? value.trim() : value),
        },
      })

      const localCompiler = new StepAnswerPreparationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const source = localCompiler.generateSource([block], [])
      const fn = localCompiler.compile([block], [])
      const result = fn!(ctx)

      await executeAnswerPreparationTask(result, ctx)

      // Assert
      expect(source).not.toContain('await')
      expect(result).not.toBeInstanceOf(Promise)
      expect(ctx.answers.name.current).toBe('Ada')
    })

    it('should await async formatter functions in sequence', async () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter] })
      const functionRegistry = new FunctionRegistry()
      const ctx = createCtx({
        post: { name: '  Ada  ' },
        conditions: functionRegistry,
      })

      functionRegistry.register({
        trim: {
          name: 'trim',
          isAsync: true,
          evaluate: async (value: unknown) => (typeof value === 'string' ? value.trim() : value),
        },
      })

      const localCompiler = new StepAnswerPreparationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const source = localCompiler.generateSource([block], [])
      const fn = localCompiler.compile([block], [])

      await executeAnswerPreparation(fn!, ctx)

      // Assert
      expect(source).toContain('await')
      expect(ctx.answers.name.current).toBe('Ada')
      expect(ctx.answers.name.mutations[1]).toEqual({ value: 'Ada', source: 'processed' })
    })

    it('should await async dependentWhen predicates', async () => {
      // Arrange
      const ref = createReference(['answers', 'showEmail'])
      const cond = createConditionFunction('isRequired')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const functionRegistry = new FunctionRegistry()
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        answers: { showEmail: { current: '', mutations: [] } },
        conditions: functionRegistry,
      })

      functionRegistry.register({
        isRequired: {
          name: 'isRequired',
          isAsync: true,
          evaluate: async (value: unknown) =>
            value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== ''),
        },
      })

      const localCompiler = new StepAnswerPreparationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const source = localCompiler.generateSource([block], [])
      const fn = localCompiler.compile([block], [])

      await executeAnswerPreparation(fn!, ctx)

      // Assert
      expect(source).toContain('await')
      expect(ctx.answers.email.current).toBeUndefined()
      expect(ctx.answers.email.mutations[ctx.answers.email.mutations.length - 1])
        .toEqual({ value: undefined, source: 'dependentWhen' })
    })

    it('should await async defaultValue generators', async () => {
      // Arrange
      const block = createFieldBlock('reference', { defaultValue: createGeneratorFunction('nextReference') })
      const functionRegistry = new FunctionRegistry()
      const ctx = createCtx({
        request: { method: 'GET' },
        conditions: functionRegistry,
      })

      functionRegistry.register({
        nextReference: {
          name: 'nextReference',
          isAsync: true,
          evaluate: async () => 'ABC-123',
        },
      })

      const localCompiler = new StepAnswerPreparationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })

      // Act
      const source = localCompiler.generateSource([block], [])
      const fn = localCompiler.compile([block], [])

      await executeAnswerPreparation(fn!, ctx)

      // Assert
      expect(source).toContain('await')
      expect(ctx.answers.reference.current).toBe('ABC-123')
      expect(ctx.answers.reference.mutations[0]).toEqual({ value: 'ABC-123', source: 'default' })
    })
  })

  describe('POST path', () => {
    it('should extract POST value and push post mutation', async () => {
      // Arrange
      const block = createFieldBlock('firstName')
      const ctx = createCtx({ post: { firstName: 'John' } })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.firstName).toBeDefined()
      expect(ctx.answers.firstName.current).toBe('John')
      expect(ctx.answers.firstName.mutations).toHaveLength(1)
      expect(ctx.answers.firstName.mutations[0]).toEqual({ value: 'John', source: 'post' })
    })

    it('should extract POST value when a registered field has dynamic code', async () => {
      // Arrange
      const dynamicCode = createGeneratorFunction('fieldCode')
      const block = createFieldBlock(dynamicCode)
      const localCompiler = createSyncCompiler('fieldCode')
      const ctx = createCtx({
        post: { firstName: 'John' },
        conditions: {
          get: vi.fn((name: string) => {
            if (name === 'fieldCode') {
              return { evaluate: () => 'firstName' }
            }

            return { evaluate: () => undefined }
          }),
        } as unknown as CompiledAnswerPreparationContext['conditions'],
      })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(source).toContain('const fieldCode = String(')
      expect(ctx.answers.firstName).toBeDefined()
      expect(ctx.answers.firstName.current).toBe('John')
      expect(ctx.answers.firstName.mutations[0]).toEqual({ value: 'John', source: 'post' })
    })

    it('should process multiple fields in order', async () => {
      // Arrange
      const block1 = createFieldBlock('firstName')
      const block2 = createFieldBlock('lastName')
      const ctx = createCtx({ post: { firstName: 'John', lastName: 'Doe' } })

      // Act
      const source = compiler.generateSource([block1, block2])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.firstName.current).toBe('John')
      expect(ctx.answers.lastName.current).toBe('Doe')
    })

    it('should extract first non-empty for non-multiple fields when POST is array', async () => {
      // Arrange
      const block = createFieldBlock('colour')
      const ctx = createCtx({ post: { colour: ['', ' ', 'red', 'blue'] as unknown as string } })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.colour.current).toBe('red')
    })

    it('should keep full array for multiple: true fields', async () => {
      // Arrange
      const block = createFieldBlock('tags', { multiple: true })
      const ctx = createCtx({ post: { tags: ['a', 'b', 'c'] as unknown as string } })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual(['a', 'b', 'c'])
    })

    it('should normalize single value to array for multiple: true', async () => {
      // Arrange
      const block = createFieldBlock('tags', { multiple: true })
      const ctx = createCtx({ post: { tags: 'single' } })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual(['single'])
    })

    it('should push mutation with undefined when field not in POST data', async () => {
      // Arrange
      const block = createFieldBlock('missing')
      const ctx = createCtx({ post: {} })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.missing.current).toBeUndefined()
      expect(ctx.answers.missing.mutations[0]).toEqual({ value: undefined, source: 'post' })
    })
  })

  describe('formatters', () => {
    it('should apply a single formatter and push processed mutation', async () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter] })
      const localCompiler = createSyncCompiler('trim')
      const ctx = createCtx({ post: { name: '  John  ' } })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('John')
      expect(ctx.answers.name.mutations).toHaveLength(2)
      expect(ctx.answers.name.mutations[0]).toEqual({ value: '  John  ', source: 'post' })
      expect(ctx.answers.name.mutations[1]).toEqual({ value: 'John', source: 'processed' })
    })

    it('should chain multiple formatters in sequence', async () => {
      // Arrange
      const trim = createTransformerFunction('trim')
      const upper = createTransformerFunction('toUpperCase')
      const block = createFieldBlock('name', { formatters: [trim, upper] })
      const localCompiler = createSyncCompiler('trim', 'toUpperCase')
      const ctx = createCtx({ post: { name: '  hello  ' } })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('HELLO')
    })

    it('should not push processed mutation if formatter did not change value', async () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter] })
      const localCompiler = createSyncCompiler('trim')
      const ctx = createCtx({ post: { name: 'NoSpaces' } })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('NoSpaces')
      expect(ctx.answers.name.mutations).toHaveLength(1)
    })

    it('should keep previous value when formatter returns undefined', async () => {
      // Arrange
      const noopFormatter = createTransformerFunction('nonexistent')
      const block = createFieldBlock('name', { formatters: [noopFormatter] })
      const localCompiler = createSyncCompiler('nonexistent')
      const ctx = createCtx({ post: { name: 'original' } })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('original')
    })

    it('should keep submitted value and skip remaining formatters when a formatter throws TypeError', async () => {
      // Arrange
      const toNumberFormatter = createTransformerFunction('toNumber')
      const afterFormatter = createTransformerFunction('after')
      const afterEvaluate = vi.fn(() => 'should not run')
      const block = createFieldBlock('age', { formatters: [toNumberFormatter, afterFormatter] })
      const localCompiler = createSyncCompiler('toNumber', 'after')
      const ctx = createCtx({
        post: { age: 'abc' },
        conditions: {
          get: vi.fn((name: string) => {
            if (name === 'toNumber') {
              return {
                evaluate: () => {
                  throw new TypeError('Invalid number')
                },
              }
            }

            if (name === 'after') {
              return { evaluate: afterEvaluate }
            }

            return { evaluate: () => undefined }
          }),
        } as unknown as CompiledAnswerPreparationContext['conditions'],
      })

      // Act
      const fn = localCompiler.compile([block])

      await executeAnswerPreparation(fn!, ctx)

      // Assert
      expect(afterEvaluate).not.toHaveBeenCalled()
      expect(ctx.answers.age.current).toBe('abc')
      expect(ctx.answers.age.mutations).toEqual([{ value: 'abc', source: 'post' }])
    })

    it('should throw runtime errors when formatter evaluation fails', async () => {
      // Arrange
      const formatter = createTransformerFunction('explode')
      const block = createFieldBlock('name', { formatters: [formatter] })
      const localCompiler = createSyncCompiler('explode')
      const ctx = createCtx({
        post: { name: 'original' },
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('Formatter failed')
            },
          })),
        } as unknown as CompiledAnswerPreparationContext['conditions'],
      })

      // Act
      const fn = localCompiler.compile([block])

      // Assert
      await expect(executeAnswerPreparation(fn!, ctx)).rejects.toThrow('Formatter failed')

      try {
        await executeAnswerPreparation(fn!, ctx)
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected explode to throw the original Error')
        }

        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'answer-preparation',
          functionName: 'explode',
          functionType: FunctionType.TRANSFORMER,
        })
      }
    })

    it('should pass additional arguments to formatter', async () => {
      // Arrange
      const truncate = createTransformerFunction('truncate', [3])
      const block = createFieldBlock('name', { formatters: [truncate] })
      const localCompiler = createSyncCompiler('truncate')
      const ctx = createCtx({ post: { name: 'hello world' } })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('hel')
    })
  })

  describe('dependentWhen', () => {
    it('should keep value when dependentWhen evaluates to true', async () => {
      // Arrange
      const ref = createReference(['answers', 'showEmail'])
      const cond = createConditionFunction('isRequired')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        answers: { showEmail: { current: 'yes', mutations: [] } },
      })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.email.current).toBe('test@example.com')
    })

    it('should clear value when dependentWhen evaluates to false', async () => {
      // Arrange
      const ref = createReference(['answers', 'showEmail'])
      const cond = createConditionFunction('isRequired')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        answers: { showEmail: { current: '', mutations: [] } },
      })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.email.current).toBeUndefined()
      const mutations = ctx.answers.email.mutations
      const lastMutation = mutations[mutations.length - 1]

      expect(lastMutation.source).toBe('dependentWhen')
    })

    it('should throw runtime errors when dependentWhen expression throws', async () => {
      // Arrange
      const ref = createReference(['answers', 'nonexistent', 'deep', 'path'])
      const cond = createConditionFunction('willThrow')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const localCompiler = createSyncCompiler('willThrow')
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('boom')
            },
          })),
        } as unknown as CompiledAnswerPreparationContext['conditions'],
      })

      // Act
      const fn = localCompiler.compile([block])

      // Assert
      await expect(executeAnswerPreparation(fn!, ctx)).rejects.toThrow('boom')

      try {
        await executeAnswerPreparation(fn!, ctx)
      } catch (error) {
        if (!(error instanceof Error)) {
          throw new Error('Expected willThrow to throw the original Error')
        }

        expect(getForgeRuntimeEvaluationDiagnostics(error)).toMatchObject({
          phase: 'answer-preparation',
          functionName: 'willThrow',
          functionType: FunctionType.CONDITION,
        })
      }
    })
  })

  describe('GET path', () => {
    it('should return existing answer without mutation', async () => {
      // Arrange
      const block = createFieldBlock('name')
      const ctx = createCtx({
        request: { method: 'GET' },
        answers: { name: { current: 'existing', mutations: [] } },
      })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('existing')
      expect(ctx.answers.name.mutations).toHaveLength(0)
    })

    it('should resolve literal defaultValue and push default mutation', async () => {
      // Arrange
      const block = createFieldBlock('country', { defaultValue: 'UK' })
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.country.current).toBe('UK')
      expect(ctx.answers.country.mutations[0]).toEqual({ value: 'UK', source: 'default' })
    })

    it('should resolve expression defaultValue', async () => {
      // Arrange
      const defaultRef = createReference(['data', 'defaultCountry'])
      const block = createFieldBlock('country', { defaultValue: defaultRef })
      const ctx = createCtx({
        request: { method: 'GET' },
        data: { defaultCountry: 'US' },
      })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.country.current).toBe('US')
      expect(ctx.answers.country.mutations[0]).toEqual({ value: 'US', source: 'default' })
    })

    it('should resolve match expressions in defaultValue', async () => {
      // Arrange
      const defaultMatch = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          {
            predicate: createTestPredicate(
              createReference(['data', 'defaultCountry']),
              createConditionFunction('equals', ['US']),
            ),
            value: 'United States',
          },
        ])
        .withProperty('otherwise', 'Unknown')
        .build()
      const block = createFieldBlock('country', { defaultValue: defaultMatch })
      const localCompiler = createSyncCompiler('equals')
      const ctx = createCtx({
        request: { method: 'GET' },
        data: { defaultCountry: 'US' },
        conditions: {
          get: vi.fn((name: string) => {
            if (name === 'equals') {
              return {
                evaluate: (value: unknown, expected: unknown) => value === expected,
              }
            }

            return { evaluate: () => undefined }
          }),
        } as unknown as CompiledAnswerPreparationContext['conditions'],
      })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.country.current).toBe('United States')
      expect(ctx.answers.country.mutations[0]).toEqual({ value: 'United States', source: 'default' })
    })

    it('should push default mutation with undefined when no defaultValue', async () => {
      // Arrange
      const block = createFieldBlock('optional')
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = compiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.optional.current).toBeUndefined()
      expect(ctx.answers.optional.mutations[0]).toEqual({ value: undefined, source: 'default' })
    })
  })

  describe('iterator template fields', () => {
    function createTemplateValue(value: unknown): TemplateValue {
      return new TemplateFactory(new NodeIDGenerator()).compile(value)
    }

    it('should process fields with static codes inside iterator', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'staticField',
        },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const ctx = createCtx({
        post: { staticField: 'value' },
        data: { items: [{ name: 'a' }, { name: 'b' }] },
      })

      // Act
      const source = compiler.generateSource([], [iterateNode])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.staticField).toBeDefined()
      expect(ctx.answers.staticField.current).toBe('value')
    })

    it('should resolve dynamic field codes from scope references', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: ASTTestFactory.formatExpression('person_%1', [
            {
              type: ASTNodeType.EXPRESSION,
              expressionType: ExpressionType.REFERENCE,
              properties: { path: ['@loop', 0, 'index0'] },
            },
          ]),
        },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const localCompiler = createSyncCompiler(FORMAT_STRING_GENERATOR_NAME)
      const ctx = createCtx({
        post: { person_0: 'Alice', person_1: 'Bob' },
        data: { items: [{ name: 'a' }, { name: 'b' }] },
      })

      // Act
      const source = localCompiler.generateSource([], [iterateNode])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.person_0).toBeDefined()
      expect(ctx.answers.person_0.current).toBe('Alice')
      expect(ctx.answers.person_1).toBeDefined()
      expect(ctx.answers.person_1.current).toBe('Bob')
    })

    it('should process fields inside nested iterators with parent and child loop scope', async () => {
      // Arrange
      const memberField = createFieldBlock(
        ASTTestFactory.formatExpression('team_%1_member_%2', [
          createReference(['@loop', 1, 'index0']),
          createReference(['@loop', 0, 'index0']),
        ]),
      )
      const innerIterator = createIterateNode(
        createReference(['@scope', 0, 'members']),
        createTemplateValue(memberField),
      )
      const template = createTemplateValue([innerIterator])
      const iterateNode = createIterateNode(createReference(['data', 'teams']), template)
      const localCompiler = createSyncCompiler(FORMAT_STRING_GENERATOR_NAME)
      const ctx = createCtx({
        post: {
          team_0_member_0: 'Ada',
          team_0_member_1: 'Grace',
          team_1_member_0: 'Linus',
        },
        data: {
          teams: [
            { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
            { name: 'Beta', members: [{ name: 'Linus' }] },
          ],
        },
      })

      // Act
      const source = localCompiler.generateSource([], [iterateNode])

      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.team_0_member_0.current).toBe('Ada')
      expect(ctx.answers.team_0_member_1.current).toBe('Grace')
      expect(ctx.answers.team_1_member_0.current).toBe('Linus')
    })
  })

  describe('formatters do not run on GET', () => {
    it('should not apply formatters on GET request', async () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter], defaultValue: '  spaced  ' })
      const localCompiler = createSyncCompiler('trim')
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert — defaultValue is set as-is, no trimming
      expect(ctx.answers.name.current).toBe('  spaced  ')
    })
  })

  describe('parsers', () => {
    it('should set parsed value without changing current value on GET request', async () => {
      // Arrange
      const parseIso = createTransformerFunction('parseIso')
      const block = createFieldBlock('dateOfBirth', { parsers: [parseIso] })
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        parseIso: {
          name: 'parseIso',
          isAsync: false,
          evaluate: (value: unknown) => {
            if (typeof value !== 'string') {
              return undefined
            }

            const [year, month, day] = value.split('-')

            return { year, month, day }
          },
        },
      })

      const localCompiler = new StepAnswerPreparationCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const ctx = createCtx({
        request: { method: 'GET' },
        answers: {
          dateOfBirth: {
            current: '1980-03-31',
            mutations: [],
          },
        },
        conditions: functionRegistry,
      })

      // Act
      const source = localCompiler.generateSource([block])
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.dateOfBirth.current).toBe('1980-03-31')
      expect(ctx.answers.dateOfBirth.parsed).toEqual({
        year: '1980',
        month: '03',
        day: '31',
      })
    })
  })
})
