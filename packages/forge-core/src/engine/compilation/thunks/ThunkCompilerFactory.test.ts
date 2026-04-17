import { when } from 'vitest-when'
import { NodeId } from '../../types/engine.type'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import ThunkCompilerFactory from './ThunkCompilerFactory'
import NodeRegistry, { NodeRegistryEntry } from '../registries/NodeRegistry'
import ThunkHandlerRegistry from '../registries/ThunkHandlerRegistry'
import PostHandler from '../../nodes/pseudo-nodes/post/PostHandler'
import QueryHandler from '../../nodes/pseudo-nodes/query/QueryHandler'
import { CompilationDependencies } from '../CompilationDependencies'
import FunctionRegistry from '../../registries/FunctionRegistry'

describe('ThunkCompilerFactory', () => {
  let compiler: ThunkCompilerFactory
  let mockNodeRegistry: Mocked<NodeRegistry>
  let mockThunkHandlerRegistry: Mocked<ThunkHandlerRegistry>
  let mockCompilationDependencies: Mocked<CompilationDependencies>
  let mockFunctionRegistry: Mocked<FunctionRegistry>
  const mockMetadataRegistry = {
    get: vi.fn(),
    set: vi.fn(),
    has: vi.fn(),
  }
  const mockAstNodeTree = {
    postOrder: vi.fn().mockReturnValue([]),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockMetadataRegistry.get.mockClear()
    mockMetadataRegistry.set.mockClear()
    mockMetadataRegistry.has.mockClear()
    mockAstNodeTree.postOrder.mockClear()
    mockAstNodeTree.postOrder.mockReturnValue([])

    mockNodeRegistry = {
      get: vi.fn(),
      getAll: vi.fn(),
      getAllEntries: vi.fn(),
      getIds: vi.fn().mockReturnValue([]),
      has: vi.fn(),
      size: vi.fn(),
    } as unknown as Mocked<NodeRegistry>

    mockThunkHandlerRegistry = {
      register: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn().mockReturnValue(new Map()),
      has: vi.fn(),
      size: vi.fn(),
    } as unknown as Mocked<ThunkHandlerRegistry>

    mockFunctionRegistry = {
      get: vi.fn(),
      has: vi.fn(),
      size: vi.fn(),
    } as unknown as Mocked<FunctionRegistry>

    mockCompilationDependencies = {
      nodeRegistry: mockNodeRegistry,
      thunkHandlerRegistry: mockThunkHandlerRegistry,
      metadataRegistry: mockMetadataRegistry as any,
      astNodeTree: mockAstNodeTree as any,
    } as unknown as Mocked<CompilationDependencies>

    compiler = new ThunkCompilerFactory()
  })

  describe('compile()', () => {
    it('should register no handlers when no nodes exist', () => {
      // Arrange
      when(mockNodeRegistry.getAllEntries).calledWith().thenReturn(new Map())

      // Act
      compiler.compile(mockCompilationDependencies, mockFunctionRegistry)

      // Assert
      expect(mockThunkHandlerRegistry.register).not.toHaveBeenCalled()
    })

    it('should compile POST pseudo node into PostHandler', () => {
      // Arrange
      const postNode = ASTTestFactory.postPseudoNode('email')
      const entries = new Map<NodeId, NodeRegistryEntry>([
        [
          postNode.id,
          {
            node: postNode,
            path: [],
          },
        ],
      ])

      when(mockNodeRegistry.getAllEntries).calledWith().thenReturn(entries)

      // Act
      compiler.compile(mockCompilationDependencies, mockFunctionRegistry)

      // Assert
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledWith(postNode.id, expect.any(PostHandler))
    })

    it('should compile QUERY pseudo node into QueryHandler', () => {
      // Arrange
      const queryNode = ASTTestFactory.queryPseudoNode('returnUrl')
      const entries = new Map<NodeId, NodeRegistryEntry>([
        [
          queryNode.id,
          {
            node: queryNode,
            path: [],
          },
        ],
      ])

      when(mockNodeRegistry.getAllEntries).calledWith().thenReturn(entries)

      // Act
      compiler.compile(mockCompilationDependencies, mockFunctionRegistry)

      // Assert
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledWith(queryNode.id, expect.any(QueryHandler))
    })

    it('should compile multiple pseudo nodes', () => {
      // Arrange
      const postNode = ASTTestFactory.postPseudoNode('email')
      const queryNode = ASTTestFactory.queryPseudoNode('returnUrl')

      const entries = new Map<NodeId, NodeRegistryEntry>([
        [
          postNode.id,
          {
            node: postNode,
            path: [],
          },
        ],
        [
          queryNode.id,
          {
            node: queryNode,
            path: [],
          },
        ],
      ])

      when(mockNodeRegistry.getAllEntries).calledWith().thenReturn(entries)

      // Act
      compiler.compile(mockCompilationDependencies, mockFunctionRegistry)

      // Assert
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledTimes(2)
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledWith(postNode.id, expect.any(PostHandler))
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledWith(queryNode.id, expect.any(QueryHandler))
    })

    it('should compile nodes regardless of registry entry paths', () => {
      // Arrange
      const postNode = ASTTestFactory.postPseudoNode('email')
      const path = ['journey', 'steps', 0, 'blocks', 1]

      const entries = new Map<NodeId, NodeRegistryEntry>([
        [
          postNode.id,
          {
            node: postNode,
            path,
          },
        ],
      ])

      when(mockNodeRegistry.getAllEntries).calledWith().thenReturn(entries)

      // Act
      compiler.compile(mockCompilationDependencies, mockFunctionRegistry)

      // Assert
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledWith(postNode.id, expect.any(PostHandler))
    })
  })
})
