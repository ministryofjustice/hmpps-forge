import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import ThunkRuntimeHooksFactory from '@form-engine/core/ast/thunks/factories/ThunkRuntimeHooksFactory'
import ThunkCompilerFactory from '@form-engine/core/ast/thunks/factories/ThunkCompilerFactory'
import ThunkCacheManager from '@form-engine/core/ast/thunks/registries/ThunkCacheManager'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import { RuntimeOverlayBuilder, ThunkHandler } from '@form-engine/core/ast/thunks/types'
import { AstNodeId } from '@form-engine/core/types/engine.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

function createMockRuntimeOverlayBuilder(): RuntimeOverlayBuilder {
  return {
    nodeRegistry: {
      register: jest.fn(),
    } as unknown as NodeRegistry,
    handlerRegistry: {
      register: jest.fn(),
      has: jest.fn().mockReturnValue(false),
    } as unknown as ThunkHandlerRegistry,
    metadataRegistry: {} as MetadataRegistry,
    dependencyGraph: {
      addEdge: jest.fn(),
    } as unknown as DependencyGraph,
    nodeFactory: {
      createNode: jest.fn(),
    } as unknown as NodeFactory,
    runtimeNodes: new Map(),
  }
}

describe('ThunkRuntimeHooksFactory', () => {
  let factory: ThunkRuntimeHooksFactory
  let mockCompilationDependencies: jest.Mocked<CompilationDependencies>
  let mockCompiler: jest.Mocked<ThunkCompilerFactory>
  let mockCacheManager: jest.Mocked<ThunkCacheManager>

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockCompilationDependencies = {
      nodeIdGenerator: {
        next: jest.fn().mockReturnValue('runtime_pseudo:1'),
      },
      createPendingView: jest.fn(),
    } as unknown as jest.Mocked<CompilationDependencies>

    mockCompiler = {
      compileASTNode: jest.fn(),
    } as unknown as jest.Mocked<ThunkCompilerFactory>

    mockCacheManager = {
      invalidateCascading: jest.fn(),
    } as unknown as jest.Mocked<ThunkCacheManager>
  })

  describe('create()', () => {
    it('should return hooks with all functions when overlay builder is configured', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)
      const currentNodeId = 'compile_ast:1' as AstNodeId

      // Act
      const hooks = factory.create(currentNodeId)

      // Assert
      expect(hooks.createNode).toBeDefined()
      expect(hooks.registerRuntimeNode).toBeDefined()
      expect(hooks.createPseudoNode).toBeDefined()
      expect(hooks.registerPseudoNode).toBeDefined()
    })

    it('should create node using builder nodeFactory via createNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      const createdNode = ASTTestFactory.reference(['answers', 'email'])

      mockBuilder.nodeFactory.createNode = jest.fn().mockReturnValue(createdNode)

      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)
      const jsonInput = { type: 'Expression.Reference', path: ['answers', 'email'] }

      // Act
      const result = hooks.createNode(jsonInput)

      // Assert
      expect(mockBuilder.nodeFactory.createNode).toHaveBeenCalledWith(jsonInput)
      expect(result).toBe(createdNode)
    })

    it('should create ANSWER_REMOTE pseudo node without registering via createPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      const result = hooks.createPseudoNode(PseudoNodeType.ANSWER_REMOTE, { baseFieldCode: 'email' })

      // Assert
      expect(result.type).toBe(PseudoNodeType.ANSWER_REMOTE)
      expect(result.properties).toEqual({ baseFieldCode: 'email' })
      expect(mockBuilder.nodeRegistry.register).not.toHaveBeenCalled()
      expect(mockBuilder.handlerRegistry.register).not.toHaveBeenCalled()
    })

    it('should create DATA pseudo node via createPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      const result = hooks.createPseudoNode(PseudoNodeType.DATA, { baseProperty: 'userId' })

      // Assert
      expect(result.type).toBe(PseudoNodeType.DATA)
      expect(result.properties).toEqual({ baseProperty: 'userId' })
    })

    it('should create POST pseudo node via createPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      const result = hooks.createPseudoNode(PseudoNodeType.POST, { baseFieldCode: 'email' })

      // Assert
      expect(result.type).toBe(PseudoNodeType.POST)
      expect(result.properties).toEqual({ baseFieldCode: 'email' })
    })

    it('should create QUERY pseudo node via createPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      const result = hooks.createPseudoNode(PseudoNodeType.QUERY, { paramName: 'returnUrl' })

      // Assert
      expect(result.type).toBe(PseudoNodeType.QUERY)
      expect(result.properties).toEqual({ paramName: 'returnUrl' })
    })

    it('should create PARAMS pseudo node via createPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      const result = hooks.createPseudoNode(PseudoNodeType.PARAMS, { paramName: 'userId' })

      // Assert
      expect(result.type).toBe(PseudoNodeType.PARAMS)
      expect(result.properties).toEqual({ paramName: 'userId' })
    })

    it('should throw error for unsupported pseudo node type via createPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act & Assert
      expect(() => {
        hooks.createPseudoNode(PseudoNodeType.ANSWER_LOCAL, { baseFieldCode: 'email' })
      }).toThrow('Invalid node type')
    })

    it('should register pseudo node in node registry via registerPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      const mockHandler = { nodeId: 'runtime_pseudo:1', evaluate: jest.fn() } as unknown as ThunkHandler
      const pseudoNode = ASTTestFactory.postPseudoNode('email')

      mockCompiler.compileASTNode.mockReturnValue(mockHandler)

      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      hooks.registerPseudoNode(pseudoNode)

      // Assert
      expect(mockBuilder.nodeRegistry.register).toHaveBeenCalledWith(pseudoNode.id, pseudoNode)
    })

    it('should add pseudo node to runtimeNodes map via registerPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      const mockHandler = { nodeId: 'runtime_pseudo:1', evaluate: jest.fn() } as unknown as ThunkHandler
      const pseudoNode = ASTTestFactory.queryPseudoNode('returnUrl')

      mockCompiler.compileASTNode.mockReturnValue(mockHandler)

      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      hooks.registerPseudoNode(pseudoNode)

      // Assert
      expect(mockBuilder.runtimeNodes.get(pseudoNode.id)).toBe(pseudoNode)
    })

    it('should compile and register handler for pseudo node via registerPseudoNode hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      const mockHandler = { nodeId: 'runtime_pseudo:1', evaluate: jest.fn() } as unknown as ThunkHandler
      const pseudoNode = ASTTestFactory.dataPseudoNode('userId')

      mockCompiler.compileASTNode.mockReturnValue(mockHandler)

      factory = new ThunkRuntimeHooksFactory(mockCompilationDependencies, mockCompiler, mockCacheManager, mockBuilder)

      const hooks = factory.create('compile_ast:1' as AstNodeId)

      // Act
      hooks.registerPseudoNode(pseudoNode)

      // Assert
      expect(mockCompiler.compileASTNode).toHaveBeenCalledWith(pseudoNode.id, pseudoNode)
      expect(mockBuilder.handlerRegistry.register).toHaveBeenCalledWith(pseudoNode.id, mockHandler)
    })
  })
})
