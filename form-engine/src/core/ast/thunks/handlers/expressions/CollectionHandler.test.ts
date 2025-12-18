import { AstNodeId, NodeId } from '@form-engine/core/types/engine.type'
import { CollectionASTNode } from '@form-engine/core/types/expressions.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, StructureType } from '@form-engine/form/types/enums'
import { ThunkResult } from '@form-engine/core/ast/thunks/types'
import { BlockDefinition } from '@form-engine/form/types/structures.type'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockHooks,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import CollectionHandler from './CollectionHandler'

describe('CollectionHandler', () => {
  let handler: CollectionHandler
  let collectionNode: CollectionASTNode

  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  function createCollectionNode(
    collectionId: AstNodeId,
    collectionSourceId: NodeId,
    options: {
      template?: any[]
      fallback?: any[]
    } = {},
  ): CollectionASTNode {
    const builder = ASTTestFactory.expression<CollectionASTNode>(ExpressionType.COLLECTION)
      .withId(collectionId)
      .withProperty('collection', { id: collectionSourceId })
      .withProperty(
        'template',
        options.template ?? [
          {
            type: StructureType.BLOCK,
            variant: 'text',
            blockType: 'basic',
          } satisfies BlockDefinition,
        ],
      )

    if (options.fallback) {
      builder.withProperty('fallback', options.fallback)
    }

    return builder.build()
  }

  describe('evaluate()', () => {
    it('should create and evaluate runtime nodes for each item when collection source evaluates to an array', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      collectionNode = createCollectionNode(collectionId, collectionSourceId, {
        template: [
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'id'] },
          },
        ],
      })
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const collectionData = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const mockInvoker = createSequentialMockInvoker([
        collectionData,
        'block-result-1',
        'block-result-2',
        'block-result-3',
      ])

      const runtimeNodes = [{ id: 'runtime_ast:100' }, { id: 'runtime_ast:101' }, { id: 'runtime_ast:102' }]

      const mockHooks = createMockHooks()
      runtimeNodes.forEach(node => {
        mockHooks.createNode.mockReturnValueOnce(node as any)
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(result.value).toEqual(['block-result-1', 'block-result-2', 'block-result-3'])
      expect(mockHooks.createNode).toHaveBeenCalledTimes(3)
      // registerRuntimeNodesBatch is called once with all nodes batched
      expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledTimes(1)
      expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledWith(runtimeNodes, 'template')
      expect(mockContext.scope).toHaveLength(0)
    })

    it('should pass template JSON directly to createNode when collection source is an array', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      const templateJson = {
        type: StructureType.BLOCK,
        blockType: 'field',
        variant: 'text',
        code: {
          type: ExpressionType.FORMAT,
          template: 'prisoner_%1_name',
          arguments: [{ type: ExpressionType.REFERENCE, path: ['@scope', '0', 'id'] }],
        },
      }
      collectionNode = createCollectionNode(collectionId, collectionSourceId, {
        template: [templateJson],
      })
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const collectionData = [{ id: 123, name: 'John' }]
      const mockInvoker = createSequentialMockInvoker([collectionData, 'evaluated-block'])

      const mockHooks = createMockHooks()
      mockHooks.createNode.mockReturnValue({ id: 'runtime_ast:100' } as any)

      // Act
      await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(mockHooks.createNode).toHaveBeenCalledWith(templateJson)
    })

    it('should wire structural edges from collection to runtime nodes when collection source is an array', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      collectionNode = createCollectionNode(collectionId, collectionSourceId)
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const collectionData = [{ id: 1 }, { id: 2 }]
      const mockInvoker = createSequentialMockInvoker([collectionData, 'result-1', 'result-2'])

      const runtimeNodes = [{ id: 'runtime_ast:100' }, { id: 'runtime_ast:101' }]

      const mockHooks = createMockHooks()
      runtimeNodes.forEach(node => {
        mockHooks.createNode.mockReturnValueOnce(node as any)
      })

      // Act
      await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert - registerRuntimeNodesBatch is called once with all nodes batched
      expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledTimes(1)
      expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledWith(runtimeNodes, 'template')
    })

    it('should skip null and undefined items when collection source is an array', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      collectionNode = createCollectionNode(collectionId, collectionSourceId)
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const collectionData = [{ id: 1 }, null, undefined, { id: 2 }]
      const mockInvoker = createSequentialMockInvoker([collectionData, 'result-1', 'result-2'])

      const runtimeNodes = [{ id: 'runtime_ast:100' }, { id: 'runtime_ast:101' }]

      const mockHooks = createMockHooks()
      runtimeNodes.forEach(node => {
        mockHooks.createNode.mockReturnValueOnce(node as any)
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(mockHooks.createNode).toHaveBeenCalledTimes(2)
      expect(result.value).toHaveLength(2)
      // registerRuntimeNodesBatch is called once with all nodes batched
      expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledTimes(1)
      expect(mockHooks.registerRuntimeNodesBatch).toHaveBeenCalledWith(runtimeNodes, 'template')
      expect(mockContext.scope).toHaveLength(0)
    })

    it('should evaluate fallback when collection source evaluates to empty array and fallback is provided', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      const fallbackNodeId = 'compile_ast:3'
      collectionNode = createCollectionNode(collectionId, collectionSourceId, {
        fallback: [{ id: fallbackNodeId } as any],
      })
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const mockInvoker = createSequentialMockInvoker([[], 'fallback content'])

      const mockHooks = createMockHooks()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(mockInvoker.invoke).toHaveBeenCalledWith(fallbackNodeId, mockContext)
      expect(result.value).toEqual(['fallback content'])
      expect(mockHooks.createNode).not.toHaveBeenCalled()
    })

    it('should return empty array when collection source evaluates to empty array and no fallback is provided', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      collectionNode = createCollectionNode(collectionId, collectionSourceId)
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker({ defaultValue: [] })
      const mockHooks = createMockHooks()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(result.value).toEqual([])
      expect(mockHooks.createNode).not.toHaveBeenCalled()
    })

    it('should propagate the error when collection source evaluation fails', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      collectionNode = createCollectionNode(collectionId, collectionSourceId)
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const errorResult: ThunkResult = {
        error: {
          type: 'EVALUATION_FAILED',
          nodeId: collectionSourceId,
          message: 'Failed to evaluate collection source',
        },
        metadata: { source: 'test' },
      }

      const mockInvoker = createMockInvoker({
        invokeImpl: async (): Promise<ThunkResult> => errorResult,
      })

      const mockHooks = createMockHooks()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(result.error).toEqual(errorResult.error)
      expect(mockHooks.createNode).not.toHaveBeenCalled()
    })

    it.each([
      ['object', { id: 1, name: 'John' }, 'object'],
      ['string', 'not an array', 'string'],
      ['null', null, 'null'],
      ['undefined', undefined, 'undefined'],
    ])(
      'should return error when collection source is %s (not an array)',
      async (label, invalidValue, _expectedType) => {
        // Arrange
        const collectionSourceId = 'compile_ast:1'
        const collectionId = 'compile_ast:2'
        collectionNode = createCollectionNode(collectionId, collectionSourceId)
        handler = new CollectionHandler(collectionId, collectionNode)

        const mockContext = createMockContext()
        const mockInvoker = createMockInvoker({ defaultValue: invalidValue as any })
        const mockHooks = createMockHooks()

        // Act
        const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

        // Assert
        expect(result.error).toBeDefined()
        expect(result.error?.type).toBe('TYPE_MISMATCH')
        expect(result.error?.message).toContain('Type mismatch')
        expect(result.error?.message).toContain('expected array')
      },
    )

    it('should create runtime nodes for each template element per item when template has multiple elements', async () => {
      // Arrange
      const collectionSourceId = 'compile_ast:1'
      const collectionId = 'compile_ast:2'
      collectionNode = createCollectionNode(collectionId, collectionSourceId, {
        template: [
          {
            type: StructureType.BLOCK,
            variant: 'html',
            blockType: 'basic',
          } satisfies BlockDefinition,
          {
            type: StructureType.BLOCK,
            variant: 'text',
            code: { type: ExpressionType.REFERENCE, path: ['@scope', '0', 'name'] },
          },
        ],
      })
      handler = new CollectionHandler(collectionId, collectionNode)

      const mockContext = createMockContext()
      const collectionData = [{ name: 'John' }, { name: 'Jane' }]
      const mockInvoker = createMockInvoker({ defaultValue: collectionData })

      const mockHooks = createMockHooks()
      mockHooks.createNode.mockReturnValue({
        id: 'runtime_ast:100',
        type: ASTNodeType.JOURNEY,
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker, mockHooks)

      // Assert
      expect(mockHooks.createNode).toHaveBeenCalledTimes(4)
      expect(result.value).toHaveLength(4)
    })
  })
})
