import { when } from 'jest-when'
import { NodeId } from '@form-engine/core/types/engine.type'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import ThunkCompilerFactory from '@form-engine/core/ast/thunks/factories/ThunkCompilerFactory'
import NodeRegistry, { NodeRegistryEntry } from '@form-engine/core/ast/registration/NodeRegistry'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import PostHandler from '@form-engine/core/nodes/pseudo-nodes/post/PostHandler'
import QueryHandler from '@form-engine/core/nodes/pseudo-nodes/query/QueryHandler'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'

describe('ThunkCompilerFactory', () => {
  let compiler: ThunkCompilerFactory
  let mockNodeRegistry: jest.Mocked<NodeRegistry>
  let mockThunkHandlerRegistry: jest.Mocked<ThunkHandlerRegistry>
  let mockCompilationDependencies: jest.Mocked<CompilationDependencies>
  let mockFunctionRegistry: jest.Mocked<FunctionRegistry>
  const mockDependencyGraph = {
    topologicalSort: jest.fn().mockReturnValue({ sort: [] }),
  }
  const mockMetadataRegistry = {
    get: jest.fn(),
    set: jest.fn(),
    has: jest.fn(),
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockDependencyGraph.topologicalSort.mockClear()
    mockDependencyGraph.topologicalSort.mockReturnValue({ sort: [] })
    mockMetadataRegistry.get.mockClear()
    mockMetadataRegistry.set.mockClear()
    mockMetadataRegistry.has.mockClear()

    mockNodeRegistry = {
      get: jest.fn(),
      getAll: jest.fn(),
      getAllEntries: jest.fn(),
      has: jest.fn(),
      size: jest.fn(),
    } as unknown as jest.Mocked<NodeRegistry>

    mockThunkHandlerRegistry = {
      register: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn().mockReturnValue(new Map()),
      has: jest.fn(),
      size: jest.fn(),
    } as unknown as jest.Mocked<ThunkHandlerRegistry>

    mockFunctionRegistry = {
      get: jest.fn(),
      has: jest.fn(),
      size: jest.fn(),
    } as unknown as jest.Mocked<FunctionRegistry>

    mockCompilationDependencies = {
      nodeRegistry: mockNodeRegistry,
      thunkHandlerRegistry: mockThunkHandlerRegistry,
      dependencyGraph: mockDependencyGraph as any,
      metadataRegistry: mockMetadataRegistry as any,
    } as unknown as jest.Mocked<CompilationDependencies>

    compiler = new ThunkCompilerFactory()
  })

  describe('compile()', () => {
    it('should register no handlers when no nodes exist', () => {
      // Arrange
      when(mockNodeRegistry.getAllEntries).calledWith().mockReturnValue(new Map())

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

      when(mockNodeRegistry.getAllEntries).calledWith().mockReturnValue(entries)

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

      when(mockNodeRegistry.getAllEntries).calledWith().mockReturnValue(entries)

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

      when(mockNodeRegistry.getAllEntries).calledWith().mockReturnValue(entries)

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

      when(mockNodeRegistry.getAllEntries).calledWith().mockReturnValue(entries)

      // Act
      compiler.compile(mockCompilationDependencies, mockFunctionRegistry)

      // Assert
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockThunkHandlerRegistry.register).toHaveBeenCalledWith(postNode.id, expect.any(PostHandler))
    })
  })
})
