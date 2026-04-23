/* eslint-disable no-new-func */
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType, FunctionType, IteratorType, PredicateType } from '../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../types/structures.type'
import { FunctionASTNode, IterateASTNode, ReferenceASTNode } from '../../types/expressions.type'
import { TestPredicateASTNode } from '../../types/predicates.type'
import { TemplateValue } from '../../types/template.type'
import TemplateFactory from '../../nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../id-generators/NodeIDGenerator'
import FunctionRegistry from '../../registries/FunctionRegistry'
import StepAnswerPreparationCompiler, { AnswerPreparationContext } from './StepAnswerPreparationCompiler'

function createFieldBlock(code: string, props: Record<string, unknown> = {}): FieldBlockASTNode {
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
    properties: { name, arguments: args },
  } as FunctionASTNode
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

function createTestPredicate(subject: ReferenceASTNode, condition: FunctionASTNode): TestPredicateASTNode {
  return {
    type: ASTNodeType.PREDICATE,
    predicateType: PredicateType.TEST,
    id: ASTTestFactory.getId(),
    properties: { subject, condition, negate: false },
  } as TestPredicateASTNode
}

function createCtx(overrides: Partial<AnswerPreparationContext> = {}): AnswerPreparationContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: { method: 'POST' },
    conditions: {
      get: vi.fn((name: string) => {
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
    } as unknown as AnswerPreparationContext['conditions'],
    scope: [],
    post: {},
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

describe('StepAnswerPreparationCompiler', () => {
  let compiler: StepAnswerPreparationCompiler

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepAnswerPreparationCompiler()
  })

  describe('hybrid async compilation', () => {
    it('should keep compiled answer preparation synchronous when registry functions are sync', () => {
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

      // Act
      const source = compiler.generateSource([block], [], functionRegistry)
      const fn = compiler.compile([block], [], functionRegistry)
      const result = fn!(ctx)

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

      // Act
      const source = compiler.generateSource([block], [], functionRegistry)
      const fn = compiler.compile([block], [], functionRegistry)

      await fn!(ctx)

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

      // Act
      const source = compiler.generateSource([block], [], functionRegistry)
      const fn = compiler.compile([block], [], functionRegistry)

      await fn!(ctx)

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

      // Act
      const source = compiler.generateSource([block], [], functionRegistry)
      const fn = compiler.compile([block], [], functionRegistry)

      await fn!(ctx)

      // Assert
      expect(source).toContain('await')
      expect(ctx.answers.reference.current).toBe('ABC-123')
      expect(ctx.answers.reference.mutations[0]).toEqual({ value: 'ABC-123', source: 'default' })
    })
  })

  describe('POST path', () => {
    it('should extract POST value and push post mutation', () => {
      // Arrange
      const block = createFieldBlock('firstName')
      const ctx = createCtx({ post: { firstName: 'John' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.firstName).toBeDefined()
      expect(ctx.answers.firstName.current).toBe('John')
      expect(ctx.answers.firstName.mutations).toHaveLength(1)
      expect(ctx.answers.firstName.mutations[0]).toEqual({ value: 'John', source: 'post' })
    })

    it('should process multiple fields in order', () => {
      // Arrange
      const block1 = createFieldBlock('firstName')
      const block2 = createFieldBlock('lastName')
      const ctx = createCtx({ post: { firstName: 'John', lastName: 'Doe' } })

      // Act
      const source = compiler.generateSource([block1, block2])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.firstName.current).toBe('John')
      expect(ctx.answers.lastName.current).toBe('Doe')
    })

    it('should extract first non-empty for non-multiple fields when POST is array', () => {
      // Arrange
      const block = createFieldBlock('colour')
      const ctx = createCtx({ post: { colour: ['', ' ', 'red', 'blue'] as unknown as string } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.colour.current).toBe('red')
    })

    it('should keep full array for multiple: true fields', () => {
      // Arrange
      const block = createFieldBlock('tags', { multiple: true })
      const ctx = createCtx({ post: { tags: ['a', 'b', 'c'] as unknown as string } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual(['a', 'b', 'c'])
    })

    it('should normalize single value to array for multiple: true', () => {
      // Arrange
      const block = createFieldBlock('tags', { multiple: true })
      const ctx = createCtx({ post: { tags: 'single' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.tags.current).toEqual(['single'])
    })

    it('should skip POST processing for action-protected answers', () => {
      // Arrange
      const block = createFieldBlock('town')
      const ctx = createCtx({
        post: { town: 'Manchester' },
        answers: {
          town: {
            current: 'Birmingham',
            mutations: [{ value: 'Birmingham', source: 'action' }],
          },
        },
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.town.current).toBe('Birmingham')
      expect(ctx.answers.town.mutations).toHaveLength(1)
    })

    it('should push mutation with undefined when field not in POST data', () => {
      // Arrange
      const block = createFieldBlock('missing')
      const ctx = createCtx({ post: {} })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.missing.current).toBeUndefined()
      expect(ctx.answers.missing.mutations[0]).toEqual({ value: undefined, source: 'post' })
    })
  })

  describe('formatters', () => {
    it('should apply a single formatter and push processed mutation', () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter] })
      const ctx = createCtx({ post: { name: '  John  ' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('John')
      expect(ctx.answers.name.mutations).toHaveLength(2)
      expect(ctx.answers.name.mutations[0]).toEqual({ value: '  John  ', source: 'post' })
      expect(ctx.answers.name.mutations[1]).toEqual({ value: 'John', source: 'processed' })
    })

    it('should chain multiple formatters in sequence', () => {
      // Arrange
      const trim = createTransformerFunction('trim')
      const upper = createTransformerFunction('toUpperCase')
      const block = createFieldBlock('name', { formatters: [trim, upper] })
      const ctx = createCtx({ post: { name: '  hello  ' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('HELLO')
    })

    it('should not push processed mutation if formatter did not change value', () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter] })
      const ctx = createCtx({ post: { name: 'NoSpaces' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('NoSpaces')
      expect(ctx.answers.name.mutations).toHaveLength(1)
    })

    it('should keep previous value when formatter returns undefined', () => {
      // Arrange
      const noopFormatter = createTransformerFunction('nonexistent')
      const block = createFieldBlock('name', { formatters: [noopFormatter] })
      const ctx = createCtx({ post: { name: 'original' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('original')
    })

    it('should pass additional arguments to formatter', () => {
      // Arrange
      const truncate = createTransformerFunction('truncate', [3])
      const block = createFieldBlock('name', { formatters: [truncate] })
      const ctx = createCtx({ post: { name: 'hello world' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('hel')
    })
  })

  describe('dependentWhen', () => {
    it('should keep value when dependentWhen evaluates to true', () => {
      // Arrange
      const ref = createReference(['answers', 'showEmail'])
      const cond = createConditionFunction('isRequired')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        answers: { showEmail: { current: 'yes', mutations: [] } },
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.email.current).toBe('test@example.com')
    })

    it('should clear value when dependentWhen evaluates to false', () => {
      // Arrange
      const ref = createReference(['answers', 'showEmail'])
      const cond = createConditionFunction('isRequired')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        answers: { showEmail: { current: '', mutations: [] } },
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.email.current).toBeUndefined()
      const mutations = ctx.answers.email.mutations
      const lastMutation = mutations[mutations.length - 1]

      expect(lastMutation.source).toBe('dependentWhen')
    })

    it('should fail-open when dependentWhen expression throws', () => {
      // Arrange
      const ref = createReference(['answers', 'nonexistent', 'deep', 'path'])
      const cond = createConditionFunction('willThrow')
      const predicate = createTestPredicate(ref, cond)
      const block = createFieldBlock('email', { dependentWhen: predicate })
      const ctx = createCtx({
        post: { email: 'test@example.com' },
        conditions: {
          get: vi.fn(() => ({
            evaluate: () => {
              throw new Error('boom')
            },
          })),
        } as unknown as AnswerPreparationContext['conditions'],
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.email.current).toBe('test@example.com')
    })
  })

  describe('GET path', () => {
    it('should return existing answer without mutation', () => {
      // Arrange
      const block = createFieldBlock('name')
      const ctx = createCtx({
        request: { method: 'GET' },
        answers: { name: { current: 'existing', mutations: [] } },
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.name.current).toBe('existing')
      expect(ctx.answers.name.mutations).toHaveLength(0)
    })

    it('should resolve literal defaultValue and push default mutation', () => {
      // Arrange
      const block = createFieldBlock('country', { defaultValue: 'UK' })
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.country.current).toBe('UK')
      expect(ctx.answers.country.mutations[0]).toEqual({ value: 'UK', source: 'default' })
    })

    it('should resolve expression defaultValue', () => {
      // Arrange
      const defaultRef = createReference(['data', 'defaultCountry'])
      const block = createFieldBlock('country', { defaultValue: defaultRef })
      const ctx = createCtx({
        request: { method: 'GET' },
        data: { defaultCountry: 'US' },
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.country.current).toBe('US')
      expect(ctx.answers.country.mutations[0]).toEqual({ value: 'US', source: 'default' })
    })

    it('should resolve match expressions in defaultValue', () => {
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
        } as unknown as AnswerPreparationContext['conditions'],
      })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.country.current).toBe('United States')
      expect(ctx.answers.country.mutations[0]).toEqual({ value: 'United States', source: 'default' })
    })

    it('should push default mutation with undefined when no defaultValue', () => {
      // Arrange
      const block = createFieldBlock('optional')
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.optional.current).toBeUndefined()
      expect(ctx.answers.optional.mutations[0]).toEqual({ value: undefined, source: 'default' })
    })
  })

  describe('iterator template fields', () => {
    function createTemplateValue(value: unknown): TemplateValue {
      return new TemplateFactory(new NodeIDGenerator()).compile(value)
    }

    it('should process fields with static codes inside iterator', () => {
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
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.staticField).toBeDefined()
      expect(ctx.answers.staticField.current).toBe('value')
    })

    it('should resolve dynamic field codes from scope references', () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: {
            type: ASTNodeType.EXPRESSION,
            expressionType: ExpressionType.FORMAT,
            properties: {
              template: 'person_%1',
              arguments: [
                {
                  type: ASTNodeType.EXPRESSION,
                  expressionType: ExpressionType.REFERENCE,
                  properties: { path: ['@scope', 0, '@index'] },
                },
              ],
            },
          },
        },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const ctx = createCtx({
        post: { person_0: 'Alice', person_1: 'Bob' },
        data: { items: [{ name: 'a' }, { name: 'b' }] },
      })

      // Act
      const source = compiler.generateSource([], [iterateNode])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert
      expect(ctx.answers.person_0).toBeDefined()
      expect(ctx.answers.person_0.current).toBe('Alice')
      expect(ctx.answers.person_1).toBeDefined()
      expect(ctx.answers.person_1.current).toBe('Bob')
    })
  })

  describe('formatters do not run on GET', () => {
    it('should not apply formatters on GET request', () => {
      // Arrange
      const trimFormatter = createTransformerFunction('trim')
      const block = createFieldBlock('name', { formatters: [trimFormatter], defaultValue: '  spaced  ' })
      const ctx = createCtx({ request: { method: 'GET' } })

      // Act
      const source = compiler.generateSource([block])
      const fn = new Function('ctx', source)

      fn(ctx)

      // Assert — defaultValue is set as-is, no trimming
      expect(ctx.answers.name.current).toBe('  spaced  ')
    })
  })
})
