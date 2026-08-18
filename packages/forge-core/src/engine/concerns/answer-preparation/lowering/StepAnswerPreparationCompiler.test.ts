/* eslint-disable no-new-func */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z, type ZodType } from 'zod'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType, PredicateType } from '../../../../authoring/types/enums'
import {
  FORMAT_STRING_GENERATOR_NAME,
  formatGeneratorsRegistry,
} from '../../../../built-ins/functions/generators/formatGenerators'
import { FieldBlockASTNode } from '../../../chassis/contracts/ast/structures.type'
import { FunctionASTNode, IterateASTNode, ReferenceASTNode } from '../../../chassis/contracts/ast/expressions.type'
import { TestPredicateASTNode } from '../../../chassis/contracts/ast/predicates.type'
import { TemplateValue } from '../../../chassis/contracts/ast/template.type'
import { compileTemplate } from '../../../chassis/compilation/ast/nodes/template'
import { NodeIDGenerator } from '../../../chassis/compilation/ast/ast-state/NodeIDGenerator'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import { generatedFunctionRuntimeLibrary } from '../../../chassis/compilation/lowering/generatedFunctionRuntimeLibrary'
import type { CompilationDependencies } from '../../../chassis/compilation/lowering/compilationDependencies.type'
import { buildStepFieldModels } from '../../../chassis/compilation/analysis/testing-helpers/analysisContexts'
import type { AnswerPreparationModel } from '../contracts/answerPreparationModel.type'
import StepAnswerPreparationCompiler from './StepAnswerPreparationCompiler'
import type { CompiledAnswerPreparationFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type { CompiledAnswerPreparationContext } from '../../../chassis/contracts/compiled/compiledContexts.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import WorkContext from '../../../chassis/work/WorkContext'
import WorkExecutor from '../../../chassis/work/WorkExecutor'
import { isWorkTask } from '../../../chassis/work/workTask'
import { workTaskBuilders } from '../../../chassis/runtime/context/compiledEvaluationContext'

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

interface TestComponentEntry {
  readonly variant: string
  readonly inputSchema?: ZodType
  readonly multiple?: boolean
}

function createComponentRegistry(...entries: TestComponentEntry[]): ComponentRegistry {
  const registry = new ComponentRegistry()

  registry.registerMany(entries.map(entry => ({ ...entry, render: () => '' })))

  return registry
}

let modelComponentRegistry: ComponentRegistry | undefined

function createComponentCompiler(componentRegistry: ComponentRegistry): StepAnswerPreparationCompiler {
  modelComponentRegistry = componentRegistry

  return new StepAnswerPreparationCompiler({
    functionRegistry: new FunctionRegistry(),
    componentRegistry,
  })
}

function prepModel(fieldBlocks: FieldBlockASTNode[], iterateNodes: IterateASTNode[] = []): AnswerPreparationModel {
  return {
    label: undefined,
    fields: buildStepFieldModels({ fieldBlocks, iterateNodes, componentRegistry: modelComponentRegistry }),
  }
}

function createFieldBlock(
  code: unknown,
  props: Record<string, unknown> = {},
  variant = 'text-input',
): FieldBlockASTNode {
  const builder = ASTTestFactory.block(variant, BlockType.FIELD)
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
    workTasks: workTaskBuilders,
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

async function runGeneratedSource(
  source: string,
  ctx: CompiledAnswerPreparationContext,
  diagnostics: unknown = undefined,
): Promise<void> {
  const fn = new Function('ctx', '_forgeHelpers', '_forgeRuntimeDiagnostics', source)
  const task = fn(ctx, generatedFunctionRuntimeLibrary, diagnostics) as unknown

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

  // The task's run-closures mutate `ctx.answers`; thread a RequestState
  // whose context.answers aliases it, so the trace reads the same store.
  const requestContext = {
    context: { domain: { answers: ctx.answers, data: ctx.data }, evaluation: {}, request: {} },
  } as unknown as RequestState

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
    modelComponentRegistry = undefined
    compiler = new StepAnswerPreparationCompiler(dependencies)
  })

  describe('compile()', () => {
    it('should return an empty answer preparation task when no fields are configured', async () => {
      // Arrange
      const ctx = createCtx()

      // Act
      const fn = compiler.compile(prepModel([]))

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
      const source = localCompiler.generateSource(prepModel([block], []))
      const fn = localCompiler.compile(prepModel([block], []))
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
      const source = localCompiler.generateSource(prepModel([block], []))
      const fn = localCompiler.compile(prepModel([block], []))

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
      const source = localCompiler.generateSource(prepModel([block], []))
      const fn = localCompiler.compile(prepModel([block], []))

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
      const source = localCompiler.generateSource(prepModel([block], []))
      const fn = localCompiler.compile(prepModel([block], []))

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
      const source = compiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = compiler.generateSource(prepModel([block1, block2]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.firstName.current).toBe('John')
      expect(ctx.answers.lastName.current).toBe('Doe')
    })

    it('should prepare every field through the shared runtime library', () => {
      // Arrange
      const firstName = createFieldBlock('firstName')
      const lastName = createFieldBlock('lastName')

      // Act
      const source = compiler.generateSource(prepModel([firstName, lastName]))

      // Assert
      expect(source).toContain('const fieldDefinitions = [];')
      expect(source).toContain(
        'const prepareFieldAnswer = answerPreparationMode === "POST" ? _forgeHelpers.preparePostedFieldAnswerGroup : _forgeHelpers.prepareStoredFieldAnswerGroup;',
      )
      expect(source).toContain('const fieldGroups = _forgeHelpers.groupFieldDefinitionsByCode(fieldDefinitions);')
      expect(source).toContain('const fieldPreparations = fieldGroups.map(')
      expect(source).toContain('return prepareFieldAnswer(ctx, fieldGroup);')
      expect(source).not.toContain('function preparePostedFieldAnswer')
      expect(source).not.toContain('function prepareStoredFieldAnswer')
      expect(source).not.toContain('compileRegisteredField')
    })

    it('should extract first non-empty for non-multiple fields when POST is array', async () => {
      // Arrange
      const block = createFieldBlock('colour')
      const ctx = createCtx({ post: { colour: ['', ' ', 'red', 'blue'] as unknown as string } })

      // Act
      const source = compiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.colour.current).toBe('red')
    })

    it('should push mutation with undefined when field not in POST data', async () => {
      // Arrange
      const block = createFieldBlock('missing')
      const ctx = createCtx({ post: {} })

      // Act
      const source = compiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.missing.current).toBeUndefined()
      expect(ctx.answers.missing.mutations[0]).toEqual({ value: undefined, source: 'post' })
    })
  })

  describe('component input schema', () => {
    it('should keep the full array when the component entry declares multiple', async () => {
      // Arrange
      const componentRegistry = createComponentRegistry({ variant: 'checkbox', multiple: true })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('tags', {}, 'checkbox')
      const ctx = createCtx({ post: { tags: ['a', 'b', 'c'] as unknown as string }, components: componentRegistry })

      // Act
      const source = localCompiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual(['a', 'b', 'c'])
    })

    it('should normalize a single value to an array when the component entry declares multiple', async () => {
      // Arrange
      const componentRegistry = createComponentRegistry({ variant: 'checkbox', multiple: true })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('tags', {}, 'checkbox')
      const ctx = createCtx({ post: { tags: 'single' }, components: componentRegistry })

      // Act
      const source = localCompiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual(['single'])
    })

    it('should mark the field definition as validating input for a variant that declares an input schema', () => {
      // Arrange
      const componentRegistry = createComponentRegistry({ variant: 'text-input', inputSchema: z.string() })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('name', {}, 'text-input')

      // Act
      const source = localCompiler.generateSource(prepModel([block]))

      // Assert
      expect(source).toContain('component: "text-input"')
      expect(source).toContain('validatesInput: true')
    })

    it('should mark the field definition as not validating input for a variant without an input schema', () => {
      // Arrange
      const componentRegistry = createComponentRegistry({ variant: 'text-input' })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('name', {}, 'text-input')

      // Act
      const source = localCompiler.generateSource(prepModel([block]))

      // Assert
      expect(source).toContain('validatesInput: false')
    })

    it('should drop a value that fails the input schema to undefined before the post mutation', async () => {
      // Arrange
      const componentRegistry = createComponentRegistry({ variant: 'text-input', inputSchema: z.string() })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('name', {}, 'text-input')
      const ctx = createCtx({
        post: { name: { nested: 'object' } as unknown as string },
        components: componentRegistry,
      })

      // Act
      const source = localCompiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBeUndefined()
      expect(ctx.answers.name.mutations[0]).toEqual({ value: undefined, source: 'post' })
    })

    it('should drop a bad shape to an empty array when the entry declares multiple', async () => {
      // Arrange
      const componentRegistry = createComponentRegistry({
        variant: 'checkbox',
        inputSchema: z.array(z.string()),
        multiple: true,
      })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('tags', {}, 'checkbox')
      const ctx = createCtx({
        post: { tags: { nested: 'object' } as unknown as string },
        components: componentRegistry,
      })

      // Act
      const source = localCompiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual([])
      expect(ctx.answers.tags.mutations[0]).toEqual({ value: [], source: 'post' })
    })

    it('should keep a value that passes the input schema unchanged', async () => {
      // Arrange
      const componentRegistry = createComponentRegistry({ variant: 'text-input', inputSchema: z.string() })
      const localCompiler = createComponentCompiler(componentRegistry)
      const block = createFieldBlock('name', {}, 'text-input')
      const ctx = createCtx({ post: { name: 'Ada' }, components: componentRegistry })

      // Act
      const source = localCompiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('Ada')
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const fn = localCompiler.compile(prepModel([block]))

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
      const fn = localCompiler.compile(prepModel([block]))

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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const fn = localCompiler.compile(prepModel([block]))

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

  describe('same-code variant groups', () => {
    function createVariant(
      code: string,
      dependencyFlag: string,
      props: Record<string, unknown> = {},
    ): FieldBlockASTNode {
      const ref = createReference(['answers', dependencyFlag])
      const cond = createConditionFunction('isRequired')

      return createFieldBlock(code, { dependentWhen: createTestPredicate(ref, cond), ...props })
    }

    function activeFlag(): { current: string; mutations: never[] } {
      return { current: 'yes', mutations: [] }
    }

    it('should keep the submitted value when the active variant is not the last declared', async () => {
      // Arrange
      const variants = [
        createVariant('employed', 'showA'),
        createVariant('employed', 'showB'),
        createVariant('employed', 'showC'),
      ]
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        post: { employed: 'yes' },
        answers: { showA: activeFlag() },
      })

      // Act
      const source = localCompiler.generateSource(prepModel(variants))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.employed.current).toBe('yes')
      expect(ctx.answers.employed.mutations).toEqual([{ value: 'yes', source: 'post' }])
    })

    it('should prepare with the middle variant when it alone is active', async () => {
      // Arrange
      const variants = [
        createVariant('employed', 'showA'),
        createVariant('employed', 'showB'),
        createVariant('employed', 'showC'),
      ]
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        post: { employed: 'no' },
        answers: { showB: activeFlag() },
      })

      // Act
      const source = localCompiler.generateSource(prepModel(variants))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.employed.current).toBe('no')
    })

    it('should clear the answer once when no variant is active on POST', async () => {
      // Arrange
      const variants = [createVariant('employed', 'showA'), createVariant('employed', 'showB')]
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        post: { employed: 'yes' },
        answers: { employed: { current: 'stale', mutations: [] } },
      })

      // Act
      const source = localCompiler.generateSource(prepModel(variants))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.employed.current).toBeUndefined()
      expect(ctx.answers.employed.mutations).toEqual([{ value: undefined, source: 'dependentWhen' }])
    })

    it('should apply only the active variant formatters when variants differ', async () => {
      // Arrange
      const variants = [
        createVariant('employed', 'showA', { formatters: [createTransformerFunction('trim')] }),
        createVariant('employed', 'showB', { formatters: [createTransformerFunction('toUpperCase')] }),
      ]
      const localCompiler = createSyncCompiler('isRequired', 'trim', 'toUpperCase')
      const ctx = createCtx({
        post: { employed: '  yes  ' },
        answers: { showB: activeFlag() },
      })

      // Act
      const source = localCompiler.generateSource(prepModel(variants))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.employed.current).toBe('  YES  ')
    })

    it('should apply only the active variant default on GET', async () => {
      // Arrange
      const variants = [
        createVariant('employed', 'showA', { defaultValue: 'default-a' }),
        createVariant('employed', 'showB', { defaultValue: 'default-b' }),
      ]
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        request: { method: 'GET' },
        answers: { showB: activeFlag() },
      })

      // Act
      const source = localCompiler.generateSource(prepModel(variants))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.employed.current).toBe('default-b')
    })

    it('should skip defaults on GET when no variant is active', async () => {
      // Arrange
      const variants = [
        createVariant('employed', 'showA', { defaultValue: 'default-a' }),
        createVariant('employed', 'showB', { defaultValue: 'default-b' }),
      ]
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = localCompiler.generateSource(prepModel(variants))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.employed).toBeUndefined()
    })

    it('should create one preparation task per code group', async () => {
      // Arrange
      const variants = [createVariant('employed', 'showA'), createVariant('employed', 'showB')]
      const other = createFieldBlock('name')
      const localCompiler = createSyncCompiler('isRequired')
      const ctx = createCtx({
        post: { employed: 'yes', name: 'Jo' },
        answers: { showA: activeFlag() },
      })
      const fieldAnswerPreparation = vi.spyOn(workTaskBuilders, 'fieldAnswerPreparation')

      // Act
      const source = localCompiler.generateSource(prepModel([...variants, other]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(fieldAnswerPreparation).toHaveBeenCalledTimes(2)
      expect(fieldAnswerPreparation).toHaveBeenCalledWith('field:employed', expect.anything())
      expect(fieldAnswerPreparation).toHaveBeenCalledWith('field:name', expect.anything())
      fieldAnswerPreparation.mockRestore()
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
      const source = compiler.generateSource(prepModel([block]))
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
      const source = compiler.generateSource(prepModel([block]))
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
      const source = compiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = compiler.generateSource(prepModel([block]))
      await runGeneratedSource(source, ctx)

      // Assert
      expect(ctx.answers.optional.current).toBeUndefined()
      expect(ctx.answers.optional.mutations[0]).toEqual({ value: undefined, source: 'default' })
    })
  })

  describe('iterator template fields', () => {
    function createTemplateValue(value: unknown): TemplateValue {
      return compileTemplate(value, new NodeIDGenerator())
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
      const source = compiler.generateSource(prepModel([], [iterateNode]))
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
      const source = localCompiler.generateSource(prepModel([], [iterateNode]))
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
      const source = localCompiler.generateSource(prepModel([], [iterateNode]))

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
      const source = localCompiler.generateSource(prepModel([block]))
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
      const source = localCompiler.generateSource(prepModel([block]))
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
