import { HookType, ComponentCallType, FunctionEntryType } from '../../../../shared/taxonomy'
import type { MaterialisedASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import TemplateNodeIndex from '../../../chassis/compilation/ast/ast-state/TemplateNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateBlockScope } from './validateBlockScope'

const createContext = (
  nodes: readonly MaterialisedASTNode[],
  edges: ReadonlyArray<[NodeId, NodeId]>,
  functionRegistry: FunctionRegistry = new FunctionRegistry(),
): ASTValidationContext => {
  const byId = new Map<NodeId, MaterialisedASTNode>(nodes.map(node => [node.id, node]))

  edges.forEach(([childId, parentId]) => {
    const child = byId.get(childId)
    const parent = byId.get(parentId)

    if (child !== undefined && parent !== undefined) {
      Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
    }
  })

  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  return {
    nodeIndex,
    templateNodeIndex: new TemplateNodeIndex(),
    functionRegistry,
  }
}

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

describe('validateBlockScope', () => {
  describe('validateBlockScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when a block is in a step blocks array', () => {
      // Arrange
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD).build()
      const step = ASTTestFactory.step().withProperty('blocks', [block]).build()
      const context = createContext([block, step], [[block.id, step.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when a renderer declaration is used in step blocks', () => {
      // Arrange
      const block = ASTTestFactory.block('page', ComponentCallType.BASIC).build()
      const step = ASTTestFactory.step().withProperty('blocks', [block]).build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        page: { name: 'page', _forge: FunctionEntryType.RENDERER, evaluate: () => '' },
      })
      const context = createContext([block, step], [[block.id, step.id]], functionRegistry)

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['Blocks must use a declaration created with component()'])
    })

    it('should return no errors when a block is nested inside another block', () => {
      // Arrange
      const childBlock = ASTTestFactory.block('text', ComponentCallType.FIELD).build()
      const wrapperBlock = ASTTestFactory.block('panel', ComponentCallType.BASIC)
        .withProperty('content', [childBlock])
        .build()
      const step = ASTTestFactory.step().withProperty('blocks', [wrapperBlock]).build()
      const context = createContext(
        [childBlock, wrapperBlock, step],
        [
          [wrapperBlock.id, step.id],
          [childBlock.id, wrapperBlock.id],
        ],
      )

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when a block is the journey step renderer', () => {
      // Arrange
      const renderer = ASTTestFactory.block('page', ComponentCallType.BASIC).build()
      const journey = ASTTestFactory.journey().withProperty('renderer', renderer).build()
      const context = createContext([renderer, journey], [[renderer.id, journey.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when a block is the step renderer', () => {
      // Arrange
      const renderer = ASTTestFactory.block('page', ComponentCallType.BASIC).build()
      const step = ASTTestFactory.step().withProperty('renderer', renderer).build()
      const context = createContext([renderer, step], [[renderer.id, step.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when a component declaration is used as the step renderer', () => {
      // Arrange
      const renderer = ASTTestFactory.block('page', ComponentCallType.BASIC).build()
      const step = ASTTestFactory.step().withProperty('renderer', renderer).build()
      const functionRegistry = new FunctionRegistry()

      functionRegistry.register({
        page: { name: 'page', _forge: FunctionEntryType.COMPONENT, evaluate: () => '' },
      })
      const context = createContext([renderer, step], [[renderer.id, step.id]], functionRegistry)

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual(['renderer must use a declaration created with renderer()'])
    })

    it('should return an error when the parent is neither a step nor a block', () => {
      // Arrange
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD).build()
      const journey = ASTTestFactory.journey().withProperty('data', { block }).build()
      const context = createContext([block, journey], [[block.id, journey.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Blocks can only be defined in a step blocks array or nested within another block',
      ])
    })

    it('should return an error when the parent is a hook property', () => {
      // Arrange
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD).build()
      const hook = ASTTestFactory.hook(HookType.ACCESS).withProperty('effects', [block]).build()
      const context = createContext([block, hook], [[block.id, hook.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Blocks can only be defined in a step blocks array or nested within another block',
      ])
    })

    it('should return an error when the parent is a step but the block is absent from blocks', () => {
      // Arrange
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD).build()
      const step = ASTTestFactory.step().withProperty('blocks', []).build()
      const context = createContext([block, step], [[block.id, step.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Blocks can only be defined in a step blocks array or nested within another block',
      ])
    })

    it('should carry the node diagnostics callsite on the collected error', () => {
      // Arrange
      const callsite = { stack: 'Error\n    at author (/repo/journeys/steps.ts:10:5)' }
      const block = {
        ...ASTTestFactory.block('text', ComponentCallType.FIELD).build(),
        diagnostics: { ...ASTTestFactory.diagnostics(), callsite },
      }
      const step = ASTTestFactory.step().withProperty('blocks', []).build()
      const context = createContext([block, step], [[block.id, step.id]])

      // Act
      const errors = validateBlockScope(context)

      // Assert
      expect(errors).toHaveLength(1)
      expect((errors[0] as ForgeReferenceScopeError).callsite).toBe(callsite)
    })
  })
})
