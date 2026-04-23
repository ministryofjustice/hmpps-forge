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

function createIterateNode(yieldTemplate: TemplateValue): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    properties: {
      input: createReference(['data', 'members']),
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
                          path: ['@scope', 0, '@index'],
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
  })
})
