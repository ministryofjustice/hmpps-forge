/* eslint-disable no-new-func */
import { ASTTestFactory } from '../../../compilation/ast/testing-helpers/ASTTestFactory'
import { BlockType, ExpressionType, FunctionType, IteratorType, PredicateType } from '../../../../authoring/types/enums'
import {
  FORMAT_STRING_GENERATOR_NAME,
  formatGeneratorsRegistry,
} from '../../../../built-ins/functions/generators/formatGenerators'
import { stringTransformersRegistry } from '../../../../built-ins/functions/transformers/stringTransformers'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockASTNode, StepASTNode } from '../../../contracts/ast/structures.type'
import { IterateASTNode, ReferenceASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateValue } from '../../../contracts/ast/template.type'
import { compileTemplate } from '../../../compilation/ast/nodes/template'
import { NodeIDGenerator } from '../../../compilation/ast/ast-state/NodeIDGenerator'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../../compilation/lowering/compilationDependencies.type'
import { getForgeRuntimeEvaluationDiagnostics } from '../../../errors/ForgeRuntimeEvaluationError'
import type { CompiledResolveContext } from '../../../contracts/compiled/compiledContexts.type'
import type { CompiledResolveBlockWorkTask } from '../../../contracts/compiled/compiledFunctions.type'
import { isWorkTask } from '../../../work/workTask'
import { workTaskBuilders } from '../../../runtime/context/compiledEvaluationContext'
import ASTNodeIndex from '../../../compilation/ast/ast-state/ASTNodeIndex'
import { createStepAnalysisContext } from '../../../compilation/analysis/testing-helpers/analysisContexts'
import type { ASTNode } from '../../../contracts/ast/engine.type'
import type { JourneyASTNode } from '../../../contracts/ast/structures.type'
import type { ResolveModel } from '../contracts/resolveModel.type'
import ResolveAnalyzer from '../analysis/ResolveAnalyzer'
import StepResolveCompiler from './StepResolveCompiler'

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
  return compileTemplate(value, new NodeIDGenerator())
}

function createIterateNode(
  yieldTemplate: TemplateValue,
  input: ReferenceASTNode = createReference(['data', 'members']),
): IterateASTNode {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.ITERATE,
    id: ASTTestFactory.getId(),
    diagnostics: ASTTestFactory.diagnostics(),
    properties: {
      input,
      iterator: {
        type: IteratorType.MAP,
        yieldTemplate,
      },
    },
  }
}

function createCtx(overrides: Partial<CompiledResolveContext> = {}): CompiledResolveContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    post: {},
    fieldFailures: {},
    fieldFailureAnchors: {},
    components: new ComponentRegistry(),
    request: { method: 'GET' },
    workTasks: workTaskBuilders,
    conditions: {
      get: vi.fn((name: string) => {
        if (name === FORMAT_STRING_GENERATOR_NAME) {
          return formatGeneratorsRegistry.build()[FORMAT_STRING_GENERATOR_NAME]
        }

        return { evaluate: () => undefined }
      }),
    } as unknown as CompiledResolveContext['conditions'],
    ...overrides,
  }
}

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false, configurable: true })
}

/** Builds the resolve model through the real analyzer, mirroring registration. */
function resolveModel(
  stepNode: StepASTNode,
  ancestorNodes: JourneyASTNode[] = [],
  iterateNodes: IterateASTNode[] = [],
): ResolveModel {
  const nodeRegistry = new ASTNodeIndex()
  let parent: ASTNode | undefined

  ancestorNodes.forEach(ancestorNode => {
    if (parent !== undefined) {
      setParent(ancestorNode, parent)
    }

    nodeRegistry.register(ancestorNode.id, ancestorNode)
    parent = ancestorNode
  })

  if (parent !== undefined) {
    setParent(stepNode, parent)
  }

  nodeRegistry.register(stepNode.id, stepNode)
  iterateNodes.forEach(iterateNode => {
    setParent(iterateNode, stepNode)
    nodeRegistry.register(iterateNode.id, iterateNode)
  })

  return new ResolveAnalyzer().analyzeStep(createStepAnalysisContext({ stepNode, nodeRegistry }))
}

describe('StepResolveCompiler', () => {
  let compiler: StepResolveCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  dependencies.functionRegistry.register({
    answerCode: { name: 'answerCode', isAsync: true, evaluate: () => undefined },
    Equals: { name: 'Equals', isAsync: true, evaluate: () => undefined },
    fieldCode: { name: 'fieldCode', isAsync: true, evaluate: () => undefined },
    FormatString: { name: 'FormatString', isAsync: true, evaluate: () => undefined },
    renderAddress: { name: 'renderAddress', isAsync: true, evaluate: () => undefined },
    renderMember: { name: 'renderMember', isAsync: true, evaluate: () => undefined },
  })

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new StepResolveCompiler(dependencies)
  })

  describe('compile()', () => {
    it('should return the branded resolve-blocks root task carrying blocks step and ancestors', async () => {
      // Arrange
      const block = ASTTestFactory.block('content', BlockType.BASIC).withProperty('content', 'Hello').build()
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), [], []))
      const ctx = createCtx()

      // Act
      const result = await compiled!(ctx)

      // Assert
      if (!isWorkTask(result)) {
        throw new Error('Expected render compiler to return a work task')
      }

      expect(result.key).toBe('resolve-blocks')
      expect(result.handler.kind).toBe('resolve.blocks')
      expect(result.props.blocks).toHaveLength(1)
      expect(result.props.step).toBeDefined()
      expect(Array.isArray(result.props.ancestors)).toBe(true)
    })

    it('should produce readable source code', () => {
      // Arrange
      const ancestor = ASTTestFactory.journey().withProperty('path', '/guide').withTitle('Guide').build()
      const field = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withProperty('code', 'name')
        .withProperty('label', { text: 'Your name' })
        .withProperty('hint', createReference(['data', 'nameHint']))
        .build()
      const step = createStepWithBlocks([field])

      // Act
      const source = compiler.generateSource(resolveModel(step, [ancestor]))

      // Assert
      expect(source).toBe(
        [
          '"use strict";',
          'const blocks = [];',
          'const step = { path: "/step", title: "Step" };',
          'const ancestors = [];',
          '',
          '// --- Ancestor journeys ---',
          'ancestors.push({ path: "/guide", title: "Guide" });',
          '',
          '// --- Block — text-input (root) ---',
          'const textInputProps = {',
          '  code: "name",',
          '  label: { text: "Your name" },',
          '  hint: ctx.data?.nameHint',
          '};',
          '',
          '_forgeHelpers.resolveFieldValue(ctx, textInputProps);',
          `_forgeHelpers.resolveFieldFailures(ctx, "${field.id}", "text-input", textInputProps);`,
          `blocks.push(ctx.workTasks.resolveBlock("${field.id}", "text-input", "BlockType.field", textInputProps));`,
          '',
          'return ctx.workTasks.resolveBlocks(blocks, step, ancestors);',
        ].join('\n'),
      )
    })

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

      const syncCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = syncCompiler.generateSource(resolveModel(createStepWithBlocks([block]), [], []))
      const compiled = syncCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))
      const result = compiled!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(source).not.toContain('await')
      expect(result).not.toBeInstanceOf(Promise)

      if (result instanceof Promise) {
        throw new Error('Expected sync render result')
      }

      expect(result.props.blocks[0].props.properties.content).toBe('Hello Ada')
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

      const asyncCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })

      // Act
      const source = asyncCompiler.generateSource(resolveModel(createStepWithBlocks([block]), [], []))
      const compiled = asyncCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))
      const result = await compiled!(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(source).toContain('await')
      expect(result.props.blocks[0].props.properties.content).toBe('Hello Ada')
    })

    it('should return branded render work tasks for compiled blocks', () => {
      // Arrange
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('content', 'Hello Ada')
        .build()
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), [], []))
      const ctx = createCtx()

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = compiled(ctx)

      if (result instanceof Promise) {
        throw new Error('Expected sync render result')
      }

      const child = result.props.blocks[0]

      if (!isWorkTask(child)) {
        throw new Error('Expected compiled block to be a work task')
      }

      // Assert
      expect(child.$$typeof).toBe(Symbol.for('forge.work'))
      expect(child.handler.kind).toBe('resolve.block')
      expect(child.props).toMatchObject({
        id: block.id,
        variant: 'content',
        blockType: BlockType.BASIC,
        properties: { content: 'Hello Ada' },
      })
    })

    it('should not mutate source collection objects when rendering iterator blocks', async () => {
      // Arrange
      const member: Record<string, unknown> = { memberName: 'Ada' }
      const members = [member]
      const field = createFieldBlock('memberName_0', createReference(['@scope', '0', 'memberName']))
      const iterateNode = createIterateNode(createTemplate([field]))
      const compiled = compiler.compile(resolveModel(createStep(), [], [iterateNode]))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ data: { members } }))

      // Assert
      expect(result.props.blocks).toHaveLength(1)
      expect(member).toEqual({ memberName: 'Ada' })
      expect(JSON.stringify(members)).toBe('[{"memberName":"Ada"}]')
    })

    it('should resolve Item value to the original iterator item when rendering iterator blocks', async () => {
      // Arrange
      const member: Record<string, unknown> = { memberName: 'Ada' }
      const members = [member]
      const field = createFieldBlock('memberName_0', createReference(['@scope', '0']))
      const iterateNode = createIterateNode(createTemplate([field]))
      const model = resolveModel(createStep(), [], [iterateNode])
      const compiled = compiler.compile(model)
      const source = compiler.generateSource(model)

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ data: { members } }))

      // Assert
      expect(result.props.blocks[0].props.properties.defaultValue).toBe(member)
      expect(result.props.blocks[0].props.properties.value).toBe(member)
      expect(result.props.blocks[0].props.properties.value).not.toHaveProperty('@index')
      expect(result.props.blocks[0].props.properties.value).not.toHaveProperty('@item')
      expect(source).not.toContain('"@type"')
      expect(source).not.toContain('"@item"')
    })

    it('should evaluate generator expressions when rendering block properties', async () => {
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
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

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
      const result = await compiled(
        createCtx({
          answers: {
            addressLine1: { current: '123 Example Street' },
            addressTown: { current: 'London' },
          },
          conditions: { get } as unknown as CompiledResolveContext['conditions'],
        }),
      )

      // Assert
      expect(result.props.blocks[0].props.properties.html).toBe('123 Example Street<br>London')
    })

    it('should evaluate post references when rendering block properties', async () => {
      // Arrange
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('content', createReference(['post', 'action']))
        .build()
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ post: { action: 'find-address' }, request: { method: 'POST' } }))

      // Assert
      expect(result.props.blocks[0].props.properties.content).toBe('find-address')
    })

    it('should stringify dynamic answer reference field codes', async () => {
      // Arrange
      const dynamicAnswerCode = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'answerCode')
      const answerReference = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withProperty('path', ['answers', dynamicAnswerCode])
        .build()
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('content', answerReference)
        .build()
      const step = createStepWithBlocks([block])
      const compiled = compiler.compile(resolveModel(step, []))
      const source = compiler.generateSource(resolveModel(step, []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      const get = vi.fn((name: string) => {
        if (name === 'answerCode') {
          return {
            evaluate: () => 123,
          }
        }

        return undefined
      })

      // Act
      const result = await compiled(
        createCtx({
          answers: {
            '123': { current: 'Ada' },
          },
          conditions: { get } as unknown as CompiledResolveContext['conditions'],
        }),
      )

      // Assert
      expect(source).toContain('ctx.answers[String(')
      expect(result.props.blocks[0].props.properties.content).toBe('Ada')
    })

    it('should render action-set field values after POST preparation', async () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('addressTown')
        .build()
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
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
      expect(result.props.blocks[0].props.properties.value).toBe('London')
    })

    it('should render raw POST field values when only formatter processing follows', async () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('email')
        .build()
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
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
      expect(result.props.blocks[0].props.properties.value).toBe('test@example.com')
    })

    it('should resolve dynamic registered field codes as strings', async () => {
      // Arrange
      const dynamicCode = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'fieldCode')
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withProperty('code', dynamicCode)
        .build()
      const step = createStepWithBlocks([block])
      const compiled = compiler.compile(resolveModel(step, []))
      const source = compiler.generateSource(resolveModel(step, []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      const get = vi.fn((name: string) => {
        if (name === 'fieldCode') {
          return {
            evaluate: () => 123,
          }
        }

        return undefined
      })

      // Act
      const result = await compiled(
        createCtx({
          answers: {
            '123': { current: 'Ada' },
          },
          conditions: { get } as unknown as CompiledResolveContext['conditions'],
        }),
      )

      // Assert
      expect(source).toContain('code: String(')
      expect(result.props.blocks[0].props.properties.code).toBe('123')
      expect(result.props.blocks[0].props.properties.value).toBe('Ada')
    })

    it('should resolve a field block its own validation failures by block ID', async () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD).withProperty('code', 'email').build()
      const step = createStepWithBlocks([block])
      const compiled = compiler.compile(resolveModel(step, []))
      const source = compiler.generateSource(resolveModel(step, []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      const failure = {
        blockCode: 'email',
        passed: false,
        message: 'Enter your email address',
        submissionOnly: true,
        groups: ['default'],
      }

      // Act
      const result = await compiled(createCtx({ fieldFailures: { [block.id]: [failure] } }))

      // Assert
      expect(source).toContain(`resolveFieldFailures(ctx, "${block.id}", "text-input", textInputProps)`)
      expect(result.props.blocks[0].props.properties.errors).toEqual([failure])
    })

    it('should attach iterator field failures by template block ID instead of field code', async () => {
      // Arrange
      const field = ASTTestFactory.block('text-input', BlockType.FIELD).withProperty('code', 'name').build()
      const iterateNode = createIterateNode(createTemplate([field]), createReference(['data', 'members']))
      const compiled = compiler.compile(resolveModel(createStep(), [], [iterateNode]))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      const failure = {
        blockCode: 'name',
        passed: false,
        message: 'Enter the first name',
        submissionOnly: true,
        groups: ['default'],
      }

      // Act
      const result = await compiled(
        createCtx({
          data: { members: [{}, {}] },
          fieldFailures: { 'compiled:template:1:0': [failure] },
        }),
      )

      // Assert
      expect(result.props.blocks).toHaveLength(2)
      expect(result.props.blocks[0].props.id).toBe('compiled:template:1:0')
      expect(result.props.blocks[0].props.properties.errors).toEqual([failure])
      expect(result.props.blocks[1].props.id).toBe('compiled:template:1:1')
      expect(result.props.blocks[1].props.properties.errors).toEqual([])
    })

    it('should evaluate generator expressions inside iterator yield templates', async () => {
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
      const compiled = compiler.compile(resolveModel(createStep(), [], [iterateNode]))

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
      const result = await compiled(
        createCtx({
          data: { members },
          conditions: { get } as unknown as CompiledResolveContext['conditions'],
        }),
      )

      // Assert
      expect(result.props.blocks[0].props.properties.html).toBe('Ada<br>Member')
    })

    it('should evaluate Loop metadata inside iterator blocks', async () => {
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
      const compiled = compiler.compile(resolveModel(createStep(), [], [iterateNode]))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ data: { members } }))

      // Assert
      expect(result.props.blocks.map(block => block.props.properties)).toMatchObject([
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

    it('should evaluate parent Loop metadata inside nested iterator expressions', async () => {
      // Arrange
      const teams = [
        { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
        { name: 'Beta', members: [{ name: 'Linus' }] },
      ]
      const innerIterateNode: IterateASTNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.ITERATE,
        id: ASTTestFactory.getId(),
        diagnostics: ASTTestFactory.diagnostics(),
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
      const compiled = compiler.compile(resolveModel(createStep(), [], [iterateNode]))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ data: { teams } }))

      // Assert
      expect(result.props.blocks[0].props.properties.members).toEqual([
        { teamIndex: 1, teamIndex0: 0, memberIndex: 1, teamName: 'Alpha', memberName: 'Ada' },
        { teamIndex: 1, teamIndex0: 0, memberIndex: 2, teamName: 'Alpha', memberName: 'Grace' },
      ])
      expect(result.props.blocks[1].props.properties.members).toEqual([
        { teamIndex: 2, teamIndex0: 1, memberIndex: 1, teamName: 'Beta', memberName: 'Linus' },
      ])
    })

    it('should keep newly added inline iterator fields blank when existing rows have POST values', async () => {
      // Arrange
      const collection = createCollectionBlock(
        createIterateNode(
          createTemplate([
            {
              type: ASTNodeType.BLOCK,
              variant: 'text-input',
              blockType: BlockType.FIELD,
              properties: {
                code: ASTTestFactory.formatExpression('memberName_%1', [
                  {
                    type: ASTNodeType.EXPRESSION,
                    expressionType: ExpressionType.REFERENCE,
                    properties: {
                      path: ['@loop', 0, 'index0'],
                    },
                  },
                ]),
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
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([collection]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
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
      const rows = result.props.blocks[0].props.properties.collection as Array<Array<CompiledResolveBlockWorkTask>>

      expect(rows).toHaveLength(2)
      expect(rows[0][0].props.properties.code).toBe('memberName_0')
      expect(rows[0][0].props.properties.value).toBe('Alice')
      expect(rows[1][0].props.properties.code).toBe('memberName_1')
      expect(rows[1][0].props.properties.value).toBe('')
    })

    it('should compile summary-list rows with match expressions and visibleWhen predicates', () => {
      // Arrange
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        Equals: { name: 'Equals', isAsync: false, evaluate: () => undefined },
      })

      const localCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
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
      const source = localCompiler.generateSource(resolveModel(createStepWithBlocks([block]), []))

      // Act / Assert
      expect(() => new Function('ctx', source)).not.toThrow()
    })

    it('should evaluate conditional expressions in block properties', async () => {
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
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
        createCtx({
          answers: {
            visitType: { current: 'phone' },
          },
          conditions: {
            get: vi.fn(() => ({
              evaluate: (value: unknown, expected: unknown) => value === expected,
            })),
          } as unknown as CompiledResolveContext['conditions'],
        }),
      )

      // Assert
      expect(result.props.blocks[0].props.properties.text).toBe('Phone call')
    })

    it('should evaluate predicate expressions in boolean block properties', async () => {
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
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
        createCtx({
          data: {
            currentPage: 2,
          },
          conditions: {
            get: vi.fn(() => ({
              evaluate: (value: unknown, expected: unknown) => value === expected,
            })),
          } as unknown as CompiledResolveContext['conditions'],
        }),
      )

      // Assert
      expect(result.props.blocks[0].props.properties.items).toEqual([
        { number: '1', current: false },
        { number: '2', current: true },
      ])
    })

    it('should evaluate format expressions in nested array item properties', async () => {
      // Arrange
      const currentText = ASTTestFactory.formatExpression('Goals to work on now (%1)', [
        createReference(['data', 'activeGoalsCount']),
      ])
      const futureText = ASTTestFactory.formatExpression('Future goals (%1)', [
        createReference(['data', 'futureGoalsCount']),
      ])
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
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(
        createCtx({
          data: {
            activeGoalsCount: 2,
            futureGoalsCount: 3,
          },
        }),
      )

      // Assert
      expect(result.props.blocks[0].props.properties.items).toEqual([
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
      const currentText = ASTTestFactory.formatExpression('Goals to work on now (%1)', [activeGoalsCount])
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
        ...formatGeneratorsRegistry.build(),
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

      const pipelineCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const compiled = pipelineCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))

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
      expect(result.props.blocks[0].props.properties.items).toEqual([
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
      const text = ASTTestFactory.formatExpression('Goals in area (%1)', [goalCount])
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
        ...formatGeneratorsRegistry.build(),
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

      const findCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const compiled = findCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))

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
      expect(result.props.blocks[0].props.properties.items).toEqual([
        {
          text: 'Goals in area (2)',
          href: 'overview',
        },
      ])
    })

    it('should keep surrounding format text when nested array item argument resolves to undefined', async () => {
      // Arrange
      const currentText = ASTTestFactory.formatExpression('Goals to work on now (%1)', [
        createReference(['data', 'activeGoalsCount']),
      ])
      const block = ASTTestFactory.block('mojSubNavigation', BlockType.BASIC)
        .withProperty('items', [
          {
            text: currentText,
            href: 'overview?type=current',
          },
        ])
        .build()
      const compiled = compiler.compile(resolveModel(createStepWithBlocks([block]), []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx())

      // Assert
      expect(result.props.blocks[0].props.properties.items).toEqual([
        {
          text: 'Goals to work on now ()',
          href: 'overview?type=current',
        },
      ])
    })

    it('should keep surrounding format text when nested transformer pipeline input resolves to undefined', async () => {
      // Arrange
      const missingDate = ASTTestFactory.pipelineExpression({
        input: createReference(['data', 'missingDate']),
        steps: [ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'String.FormatDate')],
      })
      const content = ASTTestFactory.formatExpression('Date: %1', [missingDate])
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('html', content)
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        ...formatGeneratorsRegistry.build(),
        formatDate: stringTransformersRegistry.build()['String.FormatDate'],
      })

      const formatCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const compiled = formatCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(result.props.blocks[0].props.properties.html).toBe('Date: ')
    })

    it('should skip async transformer pipeline steps when input resolves to undefined', async () => {
      // Arrange
      const missingDate = ASTTestFactory.pipelineExpression({
        input: createReference(['data', 'missingDate']),
        steps: [ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'AsyncFormatDate')],
      })
      const content = ASTTestFactory.formatExpression('Date: %1', [missingDate])
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('html', content)
        .build()
      const evaluate = vi.fn(async () => {
        throw new TypeError('Expected this transformer to be skipped')
      })
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        ...formatGeneratorsRegistry.build(),
        AsyncFormatDate: {
          name: 'AsyncFormatDate',
          isAsync: true,
          evaluate,
        },
      })

      const skipCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const compiled = skipCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      const result = await compiled(createCtx({ conditions: functionRegistry }))

      // Assert
      expect(result.props.blocks[0].props.properties.html).toBe('Date: ')
      expect(evaluate).not.toHaveBeenCalled()
    })

    it('should throw transformer TypeError when nested pipeline input has an incompatible value', async () => {
      // Arrange
      const date = ASTTestFactory.pipelineExpression({
        input: createReference(['data', 'date']),
        steps: [ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'String.FormatDate')],
      })
      const content = ASTTestFactory.formatExpression('Date: %1', [date])
      const block = ASTTestFactory.block('content', BlockType.BASIC)
        .withProperty('html', content)
        .build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        ...formatGeneratorsRegistry.build(),
        formatDate: stringTransformersRegistry.build()['String.FormatDate'],
      })

      const typeErrorCompiler = new StepResolveCompiler({
        functionRegistry,
        componentRegistry: new ComponentRegistry(),
      })
      const compiled = typeErrorCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      let thrown: unknown

      try {
        await compiled(createCtx({ conditions: functionRegistry, data: { date: 123 } }))
      } catch (error) {
        thrown = error
      }

      // Assert
      if (!(thrown instanceof Error)) {
        throw new Error('Expected FormatDate to throw')
      }

      expect(thrown.cause).toBeInstanceOf(TypeError)
      expect(getForgeRuntimeEvaluationDiagnostics(thrown)).toMatchObject({
        phase: 'resolve',
        functionName: 'String.FormatDate',
        functionType: FunctionType.TRANSFORMER,
      })
    })

    it('should throw runtime errors when nested array item text evaluation throws', async () => {
      // Arrange
      const throwingCount = ASTTestFactory.functionExpression(FunctionType.GENERATOR, 'throwingCount')

      throwingCount.diagnostics = {
        source: {
          path: ['steps', 0, 'blocks', 0, 'items', 0, 'text'],
          formattedPath: 'journey > step > blocks[0] (mojSubNavigation) > items[0] > text',
        },
        callsite: { stack: 'Error\n    at journeyAuthor (/app/journeys/goals.journey.ts:12:5)' },
      }

      const currentText = ASTTestFactory.formatExpression('Goals to work on now (%1)', [throwingCount])
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
        ...formatGeneratorsRegistry.build(),
        throwingCount: {
          name: 'throwingCount',
          isAsync: false,
          evaluate: () => {
            throw new Error('Count failed')
          },
        },
      })

      const throwCompiler = new StepResolveCompiler({ functionRegistry, componentRegistry: new ComponentRegistry() })
      const compiled = throwCompiler.compile(resolveModel(createStepWithBlocks([block]), [], []))

      if (!compiled) {
        throw new Error('Expected render compiler to produce a function')
      }

      // Act
      let thrown: unknown

      try {
        await compiled(createCtx({ conditions: functionRegistry }))
      } catch (error) {
        thrown = error
      }

      // Assert
      if (!(thrown instanceof Error)) {
        throw new Error('Expected throwingCount to throw the original Error')
      }

      expect(thrown.message).toBe('Failed to evaluate compiled Forge resolve function: Count failed')
      expect(getForgeRuntimeEvaluationDiagnostics(thrown)).toMatchObject({
        phase: 'resolve',
        functionName: 'throwingCount',
        functionType: FunctionType.GENERATOR,
        formattedPath: 'journey > step > blocks[0] (mojSubNavigation) > items[0] > text',
        definedAt: 'journeyAuthor (/app/journeys/goals.journey.ts:12:5)',
      })
      expect(thrown.stack).toContain('Forge diagnostics:')
      expect(thrown.stack).toContain('at [defined] journeyAuthor (/app/journeys/goals.journey.ts:12:5)')
    })
  })
})
