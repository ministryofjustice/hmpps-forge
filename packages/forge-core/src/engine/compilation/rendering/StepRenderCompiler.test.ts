/* eslint-disable no-new-func */
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { BlockType, ExpressionType, FunctionType, IteratorType, PredicateType } from '../../../authoring/types/enums'
import { ASTNodeType } from '../../types/enums'
import { BlockASTNode, StepASTNode } from '../../types/structures.type'
import { IterateASTNode, ReferenceASTNode } from '../../types/expressions.type'
import { TemplateValue } from '../../types/template.type'
import TemplateFactory from '../../nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../id-generators/NodeIDGenerator'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ForgeRuntimeEvaluationError from '../../errors/ForgeRuntimeEvaluationError'
import StepRenderCompiler, { CompiledBlock, RenderCompilationContext } from './StepRenderCompiler'

function createStep(): StepASTNode {
  return ASTTestFactory.step()
    .withPath('/step')
    .withTitle('Step')
    .build()
}

function createStepWithBlocks(blocks: BlockASTNode[]): StepASTNode {
  return ASTTestFactory.step()
    .withPath('/step')
    .withTitle('Step')
    .withProperty('blocks', blocks)
    .build()
}

function createReference(path: string[]): ReferenceASTNode {
  return ASTTestFactory.reference(path)
}

function createFieldBlock(code: string, defaultValue: ReferenceASTNode): BlockASTNode {
  return ASTTestFactory.block('text-input', BlockType.FIELD)
    .withProperty('code', code)
    .withProperty('defaultValue', defaultValue)
    .build()
}

function createCollectionBlock(collection: IterateASTNode): BlockASTNode {
  return ASTTestFactory.block('collection-block', BlockType.BASIC)
    .withProperty('collection', collection)
    .build()
}

function createTemplate(value: unknown): TemplateValue {
  return new TemplateFactory(new NodeIDGenerator()).compile(value)
}

function createIterateNode(
  yieldTemplate: TemplateValue,
  input: ReferenceASTNode = createReference(['data', 'members']),
): IterateASTNode {
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
  }
}

function createCtx(overrides: Partial<RenderCompilationContext> = {}): RenderCompilationContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    post: {},
    request: { method: 'GET' },
    conditions: {
      get: vi.fn(() => ({ evaluate: () => undefined })),
    } as unknown as RenderCompilationContext['conditions'],
    ...overrides,
  }
}

describe('StepRenderCompiler', () => {
  let compiler: StepRenderCompiler

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepRenderCompiler()
  })

  describe('compile()', () => {
    it('should keep compiled render synchronous when registry functions are sync', () => {
      // Arrange
      const title = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'renderTitle', ['Ada'])
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('content', title)
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        renderTitle: {
          name: 'renderTitle',
          isAsync: false,
          evaluate: (name: unknown) => `Hello ${String(name)}`,
        },
      })

      // Act
      const source = compiler.generateSource(createStepWithBlocks([block]), [], [], functionRegistry)
      const compiled = compiler.compile(createStepWithBlocks([block]), [], [], functionRegistry)
      const result = compiled!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(source).not.toContain('await')
      expect(result).not.toBeInstanceOf(Promise)

      if (result instanceof Promise) {
        throw new Error('Expected sync render result')
      }

      expect(result.blocks[0].properties.content).toBe('Hello Ada')
    })

    it('should await async generator expressions when registry functions are async', async () => {
      // Arrange
      const title = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'renderTitle', ['Ada'])
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('content', title)
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        renderTitle: {
          name: 'renderTitle',
          isAsync: true,
          evaluate: async (name: unknown) => `Hello ${String(name)}`,
        },
      })

      // Act
      const source = compiler.generateSource(createStepWithBlocks([block]), [], [], functionRegistry)
      const compiled = compiler.compile(createStepWithBlocks([block]), [], [], functionRegistry)
      const result = await compiled!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(source).toContain('await')
      expect(result.blocks[0].properties.content).toBe('Hello Ada')
    })

    it('should not mutate source collection objects when rendering iterator blocks', () => {
      // Arrange
      const member: Record<string, unknown> = { memberName: 'Ada' }
      const members = [member]
      const field = createFieldBlock('memberName_0', createReference(['@scope', '0', 'memberName']))
      const iterateNode = createIterateNode(createTemplate([field]))
      const compiled = compiler.compile(createStep(), [], [iterateNode])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(createCtx({ data: { members } }))

      // Assert
      expect(result.blocks).toHaveLength(1)
      expect(member).toEqual({ memberName: 'Ada' })
      expect(JSON.stringify(members)).toBe('[{"memberName":"Ada"}]')
    })

    it('should resolve Item value to the original iterator item when rendering iterator blocks', () => {
      // Arrange
      const member: Record<string, unknown> = { memberName: 'Ada' }
      const members = [member]
      const field = createFieldBlock('memberName_0', createReference(['@scope', '0']))
      const iterateNode = createIterateNode(createTemplate([field]))
      const compiled = compiler.compile(createStep(), [], [iterateNode])
      const source = compiler.generateSource(createStep(), [], [iterateNode])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(createCtx({ data: { members } }))

      // Assert
      expect(result.blocks[0].properties.defaultValue).toBe(member)
      expect(result.blocks[0].properties.value).toBe(member)
      expect(result.blocks[0].properties.value).not.toHaveProperty('@index')
      expect(result.blocks[0].properties.value).not.toHaveProperty('@item')
      expect(source).not.toContain('"@type"')
      expect(source).not.toContain('"@item"')
    })

    it('should evaluate generator expressions when rendering block properties', () => {
      // Arrange
      const addressDisplay = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'renderAddress', [
        {
          template: '{{ line1 }}<br>{{ town }}',
          data: {
            line1: createReference(['answers', 'addressLine1']),
            town: createReference(['answers', 'addressTown']),
          },
        },
      ])
      const block = ASTTestFactory.block('summary-row', BlockType.BASIC)
        .withProperty('html', addressDisplay)
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      const get = vi.fn((name: string) => {
        if (name === 'renderAddress') {
          return {
            evaluate: (props: { template: string; data: { line1: unknown; town: unknown } }) =>
              props.template
                .replace('{{ line1 }}', String(props.data.line1))
                .replace('{{ town }}', String(props.data.town)),
          }
        }

        return undefined
      })

      // Act
      const result = compiled(
        createCtx({
          answers: {
            addressLine1: { current: '123 Example Street' },
            addressTown: { current: 'London' },
          },
          conditions: { get } as unknown as RenderCompilationContext['conditions'],
        }),
      )

      // Assert
      expect(result.blocks[0].properties.html).toBe('123 Example Street<br>London')
    })

    it('should evaluate post references when rendering block properties', () => {
      // Arrange
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('content', createReference(['post', 'action']))
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(createCtx({ post: { action: 'find-address' }, request: { method: 'POST' } }))

      // Assert
      expect(result.blocks[0].properties.content).toBe('find-address')
    })

    it('should render action-set field values after POST preparation', () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('addressTown')
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(
        createCtx({
          request: { method: 'POST' },
          answers: {
            addressTown: {
              current: 'London',
              mutations: [
                { source: 'post', value: undefined },
                { source: 'action', value: 'London' },
              ],
            },
          },
        }),
      )

      // Assert
      expect(result.blocks[0].properties.value).toBe('London')
    })

    it('should render raw POST field values when only formatter processing follows', () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('email')
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(
        createCtx({
          request: { method: 'POST' },
          answers: {
            email: {
              current: 'TEST@EXAMPLE.COM',
              mutations: [
                { source: 'post', value: 'test@example.com' },
                { source: 'processed', value: 'TEST@EXAMPLE.COM' },
              ],
            },
          },
        }),
      )

      // Assert
      expect(result.blocks[0].properties.value).toBe('test@example.com')
    })

    it('should evaluate generator expressions inside iterator yield templates', () => {
      // Arrange
      const members = [{ memberName: 'Ada' }]
      const templateBlock = ASTTestFactory.block('summary-row', BlockType.BASIC)
        .withProperty(
          'html',
          ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'renderMember', [
            {
              template: '{{ memberName }}<br>Member',
              data: {
                memberName: createReference(['@scope', '0', 'memberName']),
              },
            },
          ]),
        )
        .build()
      const iterateNode = createIterateNode(createTemplate([templateBlock]))
      const compiled = compiler.compile(createStep(), [], [iterateNode])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      const get = vi.fn((name: string) => {
        if (name === 'renderMember') {
          return {
            evaluate: (props: { template: string; data: { memberName: unknown } }) =>
              props.template.replace('{{ memberName }}', String(props.data.memberName)),
          }
        }

        return undefined
      })

      // Act
      const result = compiled(
        createCtx({
          data: { members },
          conditions: { get } as unknown as RenderCompilationContext['conditions'],
        }),
      )

      // Assert
      expect(result.blocks[0].properties.html).toBe('Ada<br>Member')
    })

    it('should evaluate Loop metadata inside iterator blocks', () => {
      // Arrange
      const members = [{ memberName: 'Ada' }, null, { memberName: 'Grace' }, { memberName: 'Linus' }]
      const templateBlock = ASTTestFactory.block('loop-row', BlockType.BASIC)
        .withProperty('index', createReference(['@loop', '0', 'index']))
        .withProperty('index0', createReference(['@loop', '0', 'index0']))
        .withProperty('revIndex', createReference(['@loop', '0', 'revindex']))
        .withProperty('revIndex0', createReference(['@loop', '0', 'revindex0']))
        .withProperty('first', createReference(['@loop', '0', 'first']))
        .withProperty('last', createReference(['@loop', '0', 'last']))
        .withProperty('length', createReference(['@loop', '0', 'length']))
        .withProperty('memberName', createReference(['@scope', '0', 'memberName']))
        .build()
      const iterateNode = createIterateNode(createTemplate([templateBlock]))
      const compiled = compiler.compile(createStep(), [], [iterateNode])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(createCtx({ data: { members } }))

      // Assert
      expect(result.blocks.map(block => block.properties)).toMatchObject([
        {
          index: 1,
          index0: 0,
          revIndex: 3,
          revIndex0: 2,
          first: true,
          last: false,
          length: 3,
          memberName: 'Ada',
        },
        {
          index: 2,
          index0: 1,
          revIndex: 2,
          revIndex0: 1,
          first: false,
          last: false,
          length: 3,
          memberName: 'Grace',
        },
        {
          index: 3,
          index0: 2,
          revIndex: 1,
          revIndex0: 0,
          first: false,
          last: true,
          length: 3,
          memberName: 'Linus',
        },
      ])
    })

    it('should evaluate parent Loop metadata inside nested iterator expressions', () => {
      // Arrange
      const teams = [
        { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
        { name: 'Beta', members: [{ name: 'Linus' }] },
      ]
      const innerIterateNode: IterateASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.ITERATE,
        id: ASTTestFactory.getId(),
        properties: {
          input: createReference(['@scope', '0', 'members']),
          iterator: {
            type: IteratorType.MAP,
            yieldTemplate: createTemplate({
              teamIndex: createReference(['@loop', '1', 'index']),
              teamIndex0: createReference(['@loop', '1', 'index0']),
              memberIndex: createReference(['@loop', '0', 'index']),
              teamName: createReference(['@scope', '1', 'name']),
              memberName: createReference(['@scope', '0', 'name']),
            }),
          },
        },
      }
      const templateBlock = ASTTestFactory.block('team-row', BlockType.BASIC)
        .withProperty('teamName', createReference(['@scope', '0', 'name']))
        .withProperty('members', innerIterateNode)
        .build()
      const iterateNode = createIterateNode(createTemplate([templateBlock]), createReference(['data', 'teams']))
      const compiled = compiler.compile(createStep(), [], [iterateNode])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(createCtx({ data: { teams } }))

      // Assert
      expect(result.blocks[0].properties.members).toEqual([
        { teamIndex: 1, teamIndex0: 0, memberIndex: 1, teamName: 'Alpha', memberName: 'Ada' },
        { teamIndex: 1, teamIndex0: 0, memberIndex: 2, teamName: 'Alpha', memberName: 'Grace' },
      ])
      expect(result.blocks[1].properties.members).toEqual([
        { teamIndex: 2, teamIndex0: 1, memberIndex: 1, teamName: 'Beta', memberName: 'Linus' },
      ])
    })

    it('should keep newly added inline iterator fields blank when existing rows have POST values', () => {
      // Arrange
      const collection = createCollectionBlock(
        createIterateNode(
          createTemplate([
            {
              type: ASTNodeType.BLOCK,
              variant: 'text-input',
              blockType: BlockType.FIELD,
              properties: {
                code: {
                  type: ASTNodeType.EXPRESSION,
                  expressionType: ExpressionType.FORMAT,
                  properties: {
                    template: 'memberName_%1',
                    arguments: [
                      {
                        type: ASTNodeType.EXPRESSION,
                        expressionType: ExpressionType.REFERENCE,
                        properties: {
                          path: ['@loop', 0, 'index0'],
                        },
                      },
                    ],
                  },
                },
                defaultValue: {
                  type: ASTNodeType.EXPRESSION,
                  expressionType: ExpressionType.REFERENCE,
                  properties: {
                    path: ['@scope', 0, 'memberName'],
                  },
                },
              },
            },
          ]),
        ),
      )
      const compiled = compiler.compile(createStepWithBlocks([collection]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(
        createCtx({
          data: {
            members: [{ memberName: 'Alice' }, { memberName: '' }],
          },
          request: { method: 'POST' },
          answers: {
            memberName_0: {
              current: 'Alice',
              mutations: [
                { source: 'post', value: 'Alice' },
                { source: 'action', value: 'Alice' },
              ],
            },
            memberName_1: {
              current: '',
              mutations: [{ source: 'action', value: '' }],
            },
          },
        }),
      )

      // Assert
      const rows = result.blocks[0].properties.collection as Array<Array<CompiledBlock>>

      expect(rows).toHaveLength(2)
      expect(rows[0][0].properties.code).toBe('memberName_0')
      expect(rows[0][0].properties.value).toBe('Alice')
      expect(rows[1][0].properties.code).toBe('memberName_1')
      expect(rows[1][0].properties.value).toBe('')
    })

    it('should compile summary-list rows with match expressions and visibleWhen predicates', () => {
      // Arrange
      const visitType = createReference(['answers', 'visitType'])
      const equalsPhone = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['phone'])
      const equalsVideo = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['video'])
      const phoneVisibleWhen = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: visitType,
        condition: equalsPhone,
      })
      const visitTypeLabel = ASTTestFactory.expression(ExpressionType.MATCH)
        .withProperty('branches', [
          {
            predicate: ASTTestFactory.predicate(PredicateType.TEST, {
              subject: visitType,
              condition: equalsPhone,
            }),
            value: 'Phone call',
          },
          {
            predicate: ASTTestFactory.predicate(PredicateType.TEST, {
              subject: visitType,
              condition: equalsVideo,
            }),
            value: 'Video call',
          },
        ])
        .withProperty('otherwise', '')
        .build()
      const block = ASTTestFactory.block('summary-list', BlockType.BASIC)
        .withProperty('rows', [
          {
            key: { text: 'How you would like to meet' },
            value: { text: visitTypeLabel },
          },
          {
            key: { text: 'Phone number' },
            value: { text: createReference(['answers', 'phoneNumber']) },
            visibleWhen: phoneVisibleWhen,
          },
        ])
        .build()
      const source = compiler.generateSource(createStepWithBlocks([block]), [])

      // Act / Assert
      expect(() => new Function('ctx', source)).not.toThrow()
    })

    it('should evaluate conditional expressions in block properties', () => {
      // Arrange
      const block = ASTTestFactory.block('inset-text', BlockType.BASIC)
        .withProperty(
          'text',
          ASTTestFactory.expression(ExpressionType.CONDITIONAL)
            .withPredicate(
              ASTTestFactory.predicate(PredicateType.TEST, {
                subject: createReference(['answers', 'visitType']),
                condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['phone']),
              }),
            )
            .withThenValue('Phone call')
            .withElseValue('Not phone')
            .build(),
        )
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(
        createCtx({
          answers: {
            visitType: { current: 'phone' },
          },
          conditions: {
            get: vi.fn(() => ({
              evaluate: (value: unknown, expected: unknown) => value === expected,
            })),
          } as unknown as RenderCompilationContext['conditions'],
        }),
      )

      // Assert
      expect(result.blocks[0].properties.text).toBe('Phone call')
    })

    it('should evaluate predicate expressions in boolean block properties', () => {
      // Arrange
      const block = ASTTestFactory.block('pagination', BlockType.BASIC)
        .withProperty('items', [
          {
            number: '1',
            current: ASTTestFactory.predicate(PredicateType.TEST, {
              subject: createReference(['data', 'currentPage']),
              condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [1]),
            }),
          },
          {
            number: '2',
            current: ASTTestFactory.predicate(PredicateType.TEST, {
              subject: createReference(['data', 'currentPage']),
              condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [2]),
            }),
          },
        ])
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(
        createCtx({
          data: {
            currentPage: 2,
          },
          conditions: {
            get: vi.fn(() => ({
              evaluate: (value: unknown, expected: unknown) => value === expected,
            })),
          } as unknown as RenderCompilationContext['conditions'],
        }),
      )

      // Assert
      expect(result.blocks[0].properties.items).toEqual([
        { number: '1', current: false },
        { number: '2', current: true },
      ])
    })

    it('should evaluate format expressions in nested array item properties', () => {
      // Arrange
      const currentText = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Goals to work on now (%1)')
        .withProperty('arguments', [createReference(['data', 'activeGoalsCount'])])
        .build()
      const futureText = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Future goals (%1)')
        .withProperty('arguments', [createReference(['data', 'futureGoalsCount'])])
        .build()
      const block = ASTTestFactory.block('mojSubNavigation', BlockType.BASIC)
        .withProperty('items', [
          {
            text: currentText,
            href: 'overview?type=current',
          },
          {
            text: futureText,
            href: 'overview?type=future',
          },
        ])
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(
        createCtx({
          data: {
            activeGoalsCount: 2,
            futureGoalsCount: 3,
          },
        }),
      )

      // Assert
      expect(result.blocks[0].properties.items).toEqual([
        {
          text: 'Goals to work on now (2)',
          href: 'overview?type=current',
        },
        {
          text: 'Future goals (3)',
          href: 'overview?type=future',
        },
      ])
    })

    it('should evaluate filtered iterator pipelines inside nested format arguments', async () => {
      // Arrange
      const activeGoals = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withProperty('input', createReference(['data', 'goals']))
        .withProperty('iterator', {
          type: IteratorType.FILTER,
          predicateTemplate: createTemplate(
            ASTTestFactory.predicate(PredicateType.TEST, {
              subject: createReference(['@scope', '0', 'status']),
              condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', ['ACTIVE']),
            }),
          ),
        })
        .build()
      const activeGoalsCount = ASTTestFactory.pipelineExpression({
        input: activeGoals,
        steps: [ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Length')],
      })
      const currentText = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Goals to work on now (%1)')
        .withProperty('arguments', [activeGoalsCount])
        .build()
      const block = ASTTestFactory.block('mojSubNavigation', BlockType.BASIC)
        .withProperty('items', [
          {
            text: currentText,
            href: 'overview?type=current',
          },
        ])
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        Equals: {
          name: 'Equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
        Length: {
          name: 'Length',
          isAsync: false,
          evaluate: (value: unknown) => {
            if (!Array.isArray(value)) {
              throw new Error('Expected array')
            }

            return value.length
          },
        },
      })

      const compiled = compiler.compile(createStepWithBlocks([block]), [], [], functionRegistry)

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
        createCtx({
          conditions: functionRegistry,
          data: {
            goals: [{ status: 'ACTIVE' }, { status: 'FUTURE' }, { status: 'ACTIVE' }],
          },
        }),
      )

      // Assert
      expect(result.blocks[0].properties.items).toEqual([
        {
          text: 'Goals to work on now (2)',
          href: 'overview?type=current',
        },
      ])
    })

    it('should evaluate find iterator base references inside nested format arguments', async () => {
      // Arrange
      const selectedArea = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
        .withProperty('input', createReference(['data', 'areas']))
        .withProperty('iterator', {
          type: IteratorType.FIND,
          predicateTemplate: createTemplate(
            ASTTestFactory.predicate(PredicateType.TEST, {
              subject: createReference(['@scope', '0', 'slug']),
              condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'Equals', [
                createReference(['params', 'area']),
              ]),
            }),
          ),
        })
        .build()
      const goalsInArea = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withProperty('base', selectedArea)
        .withProperty('path', ['goals'])
        .build()
      const goalCount = ASTTestFactory.pipelineExpression({
        input: goalsInArea,
        steps: [ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'Length')],
      })
      const text = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Goals in area (%1)')
        .withProperty('arguments', [goalCount])
        .build()
      const block = ASTTestFactory.block('mojSubNavigation', BlockType.BASIC)
        .withProperty('items', [
          {
            text,
            href: 'overview',
          },
        ])
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        Equals: {
          name: 'Equals',
          isAsync: false,
          evaluate: (value: unknown, expected: unknown) => value === expected,
        },
        Length: {
          name: 'Length',
          isAsync: false,
          evaluate: (value: unknown) => {
            if (!Array.isArray(value)) {
              throw new Error('Expected array')
            }

            return value.length
          },
        },
      })

      const compiled = compiler.compile(createStepWithBlocks([block]), [], [], functionRegistry)

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
        createCtx({
          conditions: functionRegistry,
          params: {
            area: 'health',
          },
          data: {
            areas: [
              { slug: 'work', goals: [{ id: 'a' }] },
              { slug: 'health', goals: [{ id: 'b' }, { id: 'c' }] },
            ],
          },
        }),
      )

      // Assert
      expect(result.blocks[0].properties.items).toEqual([
        {
          text: 'Goals in area (2)',
          href: 'overview',
        },
      ])
    })

    it('should keep surrounding format text when nested array item argument resolves to undefined', () => {
      // Arrange
      const currentText = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Goals to work on now (%1)')
        .withProperty('arguments', [createReference(['data', 'activeGoalsCount'])])
        .build()
      const block = ASTTestFactory.block('mojSubNavigation', BlockType.BASIC)
        .withProperty('items', [
          {
            text: currentText,
            href: 'overview?type=current',
          },
        ])
        .build()
      const compiled = compiler.compile(createStepWithBlocks([block]), [])

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(createCtx())

      // Assert
      expect(result.blocks[0].properties.items).toEqual([
        {
          text: 'Goals to work on now ()',
          href: 'overview?type=current',
        },
      ])
    })

    it('should throw runtime errors when nested array item text evaluation throws', () => {
      // Arrange
      const throwingCount = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'throwingCount')
      throwingCount.dslPath = ['steps', 0, 'blocks', 0, 'items', 0, 'text']
      throwingCount.formattedDslPath = 'journey > step > blocks[0] (mojSubNavigation) > items[0] > text'
      const currentText = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withProperty('template', 'Goals to work on now (%1)')
        .withProperty('arguments', [throwingCount])
        .build()
      const block = ASTTestFactory.block('mojSubNavigation', BlockType.BASIC)
        .withProperty('items', [
          {
            text: currentText,
            href: 'overview?type=current',
          },
        ])
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        throwingCount: {
          name: 'throwingCount',
          isAsync: false,
          evaluate: () => {
            throw new Error('Count failed')
          },
        },
      })

      const compiled = compiler.compile(createStepWithBlocks([block]), [], [], functionRegistry)

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      let thrown: unknown

      try {
        compiled(createCtx({ conditions: functionRegistry }))
      } catch (error) {
        thrown = error
      }

      // Assert
      expect(thrown).toBeInstanceOf(ForgeRuntimeEvaluationError)
      expect((thrown as ForgeRuntimeEvaluationError).phase).toBe('render')
      expect((thrown as ForgeRuntimeEvaluationError).functionName).toBe('throwingCount')
      expect((thrown as ForgeRuntimeEvaluationError).formattedPath).toBe(
        'journey > step > blocks[0] (mojSubNavigation) > items[0] > text',
      )
    })
  })
})
