import { ASTTestFactory } from '../../../ast/testing-helpers/ASTTestFactory'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import { IterateASTNode } from '../../../contracts/ast/expressions.type'
import { TemplateValue } from '../../../contracts/ast/template.type'
import { BasePhaseContext } from '../../../contracts/compiled/phaseContexts.type'
import TemplateFactory from '../../../ast/nodes/template/TemplateFactory'
import { NodeIDGenerator } from '../../../ast/ast-state/NodeIDGenerator'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import type { CompilationDependencies } from '../../compilationDependencies.type'
import TemplateMaterialisationCompiler from './TemplateMaterialisationCompiler'

const FORMAT_STRING_GENERATOR_NAME = 'FormatString'

function createReference(path: unknown[]): unknown {
  return {
    type: ASTNodeType.EXPRESSION,
    expressionType: ExpressionType.REFERENCE,
    id: ASTTestFactory.getId(),
    properties: { path },
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

function createTemplateValue(value: unknown): TemplateValue {
  return new TemplateFactory(new NodeIDGenerator()).compile(value)
}

function createCtx(overrides: Partial<BasePhaseContext> = {}): BasePhaseContext {
  return {
    answers: {},
    data: {},
    session: {},
    params: {},
    query: {},
    request: { method: 'GET' },
    conditions: {
      get: vi.fn((name: string) => {
        if (name === FORMAT_STRING_GENERATOR_NAME) {
          return {
            evaluate: (template: string, ...args: unknown[]) =>
              args.reduce<string>((result, arg, i) => result.replace(`%${i + 1}`, String(arg)), template),
          }
        }

        return { evaluate: () => undefined }
      }),
    } as unknown as BasePhaseContext['conditions'],
    ...overrides,
  } as BasePhaseContext
}

function createSyncCompiler(...funcNames: string[]): TemplateMaterialisationCompiler {
  const registry = new FunctionRegistry()
  const entries: Record<string, { name: string; isAsync: false; evaluate: (...args: unknown[]) => unknown }> = {}

  funcNames.forEach(name => {
    if (name === FORMAT_STRING_GENERATOR_NAME) {
      entries[name] = {
        name,
        isAsync: false,
        evaluate: (template: unknown, ...args: unknown[]) =>
          typeof template === 'string'
            ? args.reduce<string>((result, arg, i) => result.replace(`%${i + 1}`, String(arg)), template)
            : undefined,
      }
    } else {
      entries[name] = { name, isAsync: false, evaluate: () => undefined }
    }
  })
  registry.register(entries)

  return new TemplateMaterialisationCompiler({
    functionRegistry: registry,
    componentRegistry: new ComponentRegistry(),
  })
}

describe('TemplateMaterialisationCompiler', () => {
  let compiler: TemplateMaterialisationCompiler
  const dependencies: CompilationDependencies = {
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    compiler = new TemplateMaterialisationCompiler(dependencies)
  })

  describe('compileMaterialisationRoot()', () => {
    it('should return undefined when iterator has no yield template', () => {
      // Arrange
      const iterateNode = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.ITERATE,
        id: ASTTestFactory.getId(),
        properties: {
          input: createReference(['data', 'items']),
          iterator: { type: IteratorType.MAP },
        },
      } as unknown as IterateASTNode

      // Act
      const result = compiler.compileMaterialisationRoot(iterateNode)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return undefined when yield template contains no leaf nodes', () => {
      // Arrange
      const template = createTemplateValue({ someValue: 'plain' })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)

      // Act
      const result = compiler.compileMaterialisationRoot(iterateNode)

      // Assert
      expect(result).toBeUndefined()
    })

    it('should produce materialised nodes for a single field per item', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'name' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ name: 'Alice' }, { name: 'Bob' }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(2)
      expect(nodes[0].sourceNodeId).toMatch(/^template:/)
      expect(nodes[0].origin.itemIndex).toBe(0)
      expect(nodes[1].origin.itemIndex).toBe(1)
    })

    it('should set correct structural fields on materialised nodes', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'govukInput',
        blockType: BlockType.FIELD,
        properties: { code: 'field1' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ x: 1 }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(1)
      expect(nodes[0].sourceNodeId).toMatch(/^template:/)
      expect(nodes[0].instanceKey).toBeDefined()
      expect(nodes[0].origin).toBeDefined()
    })

    it('should produce nodes with phase closures when template functions are provided', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'field',
          label: {
            type: ASTNodeType.EXPRESSION,
            expressionType: ExpressionType.REFERENCE,
            properties: { path: ['@scope', 0, 'name'] },
          },
        },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ name: 'Alice' }, { name: 'Bob' }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(2)
      expect(nodes[0].sourceNodeId).toMatch(/^template:/)
      expect(nodes[1].sourceNodeId).toMatch(/^template:/)
    })

    it('should produce distinct instance keys per item from loop references', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: ASTTestFactory.formatExpression('person_%1', [createReference(['@loop', 0, 'index0'])]),
        },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const localCompiler = createSyncCompiler(FORMAT_STRING_GENERATOR_NAME)
      const root = localCompiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ name: 'Alice' }, { name: 'Bob' }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(2)
      expect(nodes[0].instanceKey).not.toBe(nodes[1].instanceKey)
      expect(nodes[0].origin.itemIndex).toBe(0)
      expect(nodes[1].origin.itemIndex).toBe(1)
    })

    it('should build instance keys from iterator node id and item index', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'field' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ a: 1 }, { a: 2 }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes[0].instanceKey).toContain('[0]')
      expect(nodes[1].instanceKey).toContain('[1]')
      expect(nodes[0].instanceKey).toContain(iterateNode.id)
    })

    it('should set origin with correct iterator node id and item index', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'field' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ a: 1 }, { a: 2 }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes[0].origin.iteratorNodeId).toBe(iterateNode.id)
      expect(nodes[0].origin.itemIndex).toBe(0)
      expect(nodes[0].origin.parentInstanceKey).toBeUndefined()
      expect(nodes[1].origin.itemIndex).toBe(1)
    })

    it('should materialise multiple template nodes per item', async () => {
      // Arrange
      const template = createTemplateValue([
        {
          type: ASTNodeType.BLOCK,
          variant: 'govukInsetText',
          blockType: BlockType.BASIC,
          properties: { text: 'Hello' },
        },
        {
          type: ASTNodeType.BLOCK,
          variant: 'text-input',
          blockType: BlockType.FIELD,
          properties: { code: 'name' },
        },
      ])
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ x: 1 }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(2)
      expect(nodes[0].sourceNodeId).toMatch(/^template:/)
      expect(nodes[1].sourceNodeId).toMatch(/^template:/)
    })

    it('should produce empty array for empty input collection', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'field' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(0)
    })

    it('should handle nested iterators producing flat ordered nodes', async () => {
      // Arrange
      const innerTemplate = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'address' },
      })
      const innerIterator = createIterateNode(createReference(['@scope', 0, 'addresses']), innerTemplate)
      const template = createTemplateValue([innerIterator])
      const outerIterator = createIterateNode(createReference(['data', 'people']), template)
      const root = compiler.compileMaterialisationRoot(outerIterator)
      const ctx = createCtx({
        data: {
          people: [
            { name: 'Alice', addresses: [{ street: 'A St' }, { street: 'B St' }] },
            { name: 'Bob', addresses: [{ street: 'C St' }] },
          ],
        },
      })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(3)
      expect(nodes[0].origin.itemIndex).toBe(0)
      expect(nodes[1].origin.itemIndex).toBe(1)
      expect(nodes[2].origin.itemIndex).toBe(0)
      expect(nodes[0].origin.parentInstanceKey).toBeDefined()
      expect(nodes[2].origin.parentInstanceKey).toBeDefined()
    })

    it('should materialise nested iterator fields inside block properties', async () => {
      // Arrange
      const innerTemplate = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'member' },
      })
      const innerIterator = createIterateNode(createReference(['@scope', 0, 'members']), innerTemplate)
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'collection',
        blockType: BlockType.BASIC,
        properties: { collection: innerIterator },
      })
      const outerIterator = createIterateNode(createReference(['data', 'teams']), template)
      const root = compiler.compileMaterialisationRoot(outerIterator)
      const ctx = createCtx({
        data: {
          teams: [
            { name: 'Alpha', members: [{ name: 'Ada' }, { name: 'Grace' }] },
            { name: 'Beta', members: [{ name: 'Linus' }] },
          ],
        },
      })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(5)
      expect(nodes.map(node => node.origin.itemIndex)).toEqual([0, 0, 1, 1, 0])
      expect(nodes.map(node => node.origin.parentInstanceKey === undefined)).toEqual([true, false, false, true, false])
    })

    it('should produce one node per item with correct origin indices', async () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'name' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)
      const root = compiler.compileMaterialisationRoot(iterateNode)
      const ctx = createCtx({ data: { items: [{ name: 'Alice' }, { name: 'Bob' }] } })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(2)
      expect(nodes[0].origin.itemIndex).toBe(0)
      expect(nodes[1].origin.itemIndex).toBe(1)
    })

    it('should produce nodes with parent instance keys for nested iterators', async () => {
      // Arrange
      const innerTemplate = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'address' },
      })
      const innerIterator = createIterateNode(createReference(['@scope', 0, 'addresses']), innerTemplate)
      const template = createTemplateValue([innerIterator])
      const outerIterator = createIterateNode(createReference(['data', 'people']), template)
      const root = compiler.compileMaterialisationRoot(outerIterator)
      const ctx = createCtx({
        data: {
          people: [{ name: 'Alice', addresses: [{ street: 'A St' }, { street: 'B St' }] }],
        },
      })

      // Act
      const nodes = await root!.materialise(ctx, new Map())

      // Assert
      expect(nodes).toHaveLength(2)
      expect(nodes[0].origin.parentInstanceKey).toBeDefined()
      expect(nodes[1].origin.parentInstanceKey).toBeDefined()
      expect(nodes[0].origin.itemIndex).toBe(0)
      expect(nodes[1].origin.itemIndex).toBe(1)
    })

    it('should preserve nodeId on the compiled root', () => {
      // Arrange
      const template = createTemplateValue({
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: { code: 'field' },
      })
      const iterateNode = createIterateNode(createReference(['data', 'items']), template)

      // Act
      const root = compiler.compileMaterialisationRoot(iterateNode)

      // Assert
      expect(root).toBeDefined()
      expect(root!.nodeId).toBe(iterateNode.id)
    })
  })
})
