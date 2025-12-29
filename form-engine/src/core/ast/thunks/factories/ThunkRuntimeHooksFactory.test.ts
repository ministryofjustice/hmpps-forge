import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import ThunkRuntimeHooksFactory from '@form-engine/core/ast/thunks/factories/ThunkRuntimeHooksFactory'
import ThunkCompilerFactory from '@form-engine/core/ast/thunks/factories/ThunkCompilerFactory'
import ThunkCacheManager from '@form-engine/core/ast/thunks/registries/ThunkCacheManager'
import { CompilationDependencies } from '@form-engine/core/ast/compilation/CompilationDependencies'
import { RuntimeOverlayBuilder } from '@form-engine/core/ast/thunks/types'
import { AstNodeId } from '@form-engine/core/types/engine.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import ThunkHandlerRegistry from '@form-engine/core/ast/thunks/registries/ThunkHandlerRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import DependencyGraph from '@form-engine/core/ast/dependencies/DependencyGraph'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'

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
      transformValue: jest.fn(),
    } as unknown as NodeFactory,
    runtimeNodes: new Map(),
  }
}

describe('ThunkRuntimeHooksFactory', () => {
  let factory: ThunkRuntimeHooksFactory
  let mockCompilationDependencies: jest.Mocked<CompilationDependencies>
  let mockCompiler: jest.Mocked<ThunkCompilerFactory>
  let mockCacheManager: jest.Mocked<ThunkCacheManager>
  let mockFunctionRegistry: jest.Mocked<FunctionRegistry>

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockCompilationDependencies = {
      nodeIdGenerator: {
        next: jest.fn().mockReturnValue('runtime_pseudo:1'),
      },
      createOverlay: jest.fn(),
    } as unknown as jest.Mocked<CompilationDependencies>

    mockCompiler = {
      compileASTNode: jest.fn(),
    } as unknown as jest.Mocked<ThunkCompilerFactory>

    mockCacheManager = {
      invalidateCascading: jest.fn(),
    } as unknown as jest.Mocked<ThunkCacheManager>

    mockFunctionRegistry = {} as jest.Mocked<FunctionRegistry>
  })

  describe('create()', () => {
    it('should return hooks with transformValue and registerRuntimeNodesBatch', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      factory = new ThunkRuntimeHooksFactory(
        mockCompilationDependencies,
        mockCompiler,
        mockCacheManager,
        mockBuilder,
        mockFunctionRegistry,
      )
      const currentNodeId = 'compile_ast:1' as AstNodeId

      // Act
      const hooks = factory.create(currentNodeId)

      // Assert
      expect(hooks.transformValue).toBeDefined()
      expect(hooks.registerRuntimeNodesBatch).toBeDefined()
      expect(typeof hooks.transformValue).toBe('function')
      expect(typeof hooks.registerRuntimeNodesBatch).toBe('function')
    })

    it('should transform value using builder nodeFactory via transformValue hook', () => {
      // Arrange
      const mockBuilder = createMockRuntimeOverlayBuilder()
      const transformedValue = { transformed: true }

      mockBuilder.nodeFactory.transformValue = jest.fn().mockReturnValue(transformedValue)

      factory = new ThunkRuntimeHooksFactory(
        mockCompilationDependencies,
        mockCompiler,
        mockCacheManager,
        mockBuilder,
        mockFunctionRegistry,
      )

      const hooks = factory.create('compile_ast:1' as AstNodeId)
      const inputValue = { original: true }

      // Act
      const result = hooks.transformValue(inputValue)

      // Assert
      expect(mockBuilder.nodeFactory.transformValue).toHaveBeenCalledWith(inputValue)
      expect(result).toBe(transformedValue)
    })
  })
})
