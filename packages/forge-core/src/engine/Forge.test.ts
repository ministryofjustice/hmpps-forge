import { buildComponent } from '../components/utils/buildComponent'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import type { FrameworkAdapter, FrameworkAdapterBuilder } from '../framework/types/adapter.type'
import ForgeRouter from './runtime/routes/ForgeRouter'
import type { PackageDependencies } from './types/engine.type'
import PackageInstance from './PackageInstance'
import Forge from './Forge'

vi.mock('./PackageInstance')
vi.mock('./registries/ComponentRegistry')
vi.mock('./registries/FunctionRegistry')
vi.mock('./runtime/routes/ForgeRouter')

describe('Forge', () => {
  let mockLogger: Mocked<Console>
  let mockRouter: unknown
  let mockPackageInstance: Mocked<PackageInstance>
  let mockPackageDependencies: PackageDependencies
  let mockForgeRouter: Mocked<ForgeRouter<unknown>>
  let mockFrameworkAdapter: Mocked<FrameworkAdapter<unknown, unknown, unknown>>
  let mockFrameworkAdapterBuilder: Mocked<FrameworkAdapterBuilder<unknown, unknown, unknown>>

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    } as any

    // Mock router (opaque object since it's framework-specific)
    mockRouter = { _type: 'main-router' }

    // Mock framework adapter
    mockFrameworkAdapter = {
      createRouter: vi.fn().mockReturnValue(mockRouter),
      mountRouter: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      toStepRequest: vi.fn(),
      redirect: vi.fn(),
      forwardError: vi.fn(),
      render: vi.fn().mockResolvedValue(undefined),
    } as any

    // Mock framework adapter builder (returns adapter when build() is called)
    mockFrameworkAdapterBuilder = {
      build: vi.fn().mockReturnValue(mockFrameworkAdapter),
    } as any

    mockForgeRouter = {
      mount: vi.fn().mockReturnValue(3),
      getRouter: vi.fn().mockReturnValue(mockRouter),
    } as any
    ;(ForgeRouter as MockedClass<typeof ForgeRouter>).mockImplementation(function mockForgeRouterCtor() {
      return mockForgeRouter as any
    })

    mockPackageDependencies = {
      componentRegistry: {} as ComponentRegistry,
      functionRegistry: {} as FunctionRegistry,
    }

    mockPackageInstance = {
      getJourneyTitle: vi.fn().mockReturnValue('Test Form'),
      getJourneyCode: vi.fn().mockReturnValue('test-form'),
      getConfiguration: vi.fn().mockReturnValue({ code: 'test-form', title: 'Test Form' }),
      getDependencies: vi.fn().mockReturnValue(mockPackageDependencies),
    } as unknown as Mocked<PackageInstance>
    ;(PackageInstance.create as Mock).mockReturnValue(mockPackageInstance)
  })

  /**
   * Helper to create default options for Forge
   */
  function createDefaultOptions(overrides: Record<string, unknown> = {}) {
    return {
      frameworkAdapter: mockFrameworkAdapterBuilder,
      ...overrides,
    }
  }

  describe('constructor', () => {
    it('should initialize with default options', () => {
      // eslint-disable-next-line no-new
      new Forge(createDefaultOptions())

      expect(ComponentRegistry).toHaveBeenCalledTimes(1)
      expect(FunctionRegistry).toHaveBeenCalledTimes(1)
      expect(ForgeRouter).toHaveBeenCalledTimes(1)
    })

    it('should use custom options when provided', () => {
      // eslint-disable-next-line no-new
      new Forge(
        createDefaultOptions({
          disableBuiltInFunctions: true,
          disableBuiltInComponents: true,
        }),
      )

      const mockComponentRegistry = (ComponentRegistry as MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockFunctionRegistry.registerBuiltInFunctions).not.toHaveBeenCalled()
      expect(mockComponentRegistry.registerBuiltInComponents).not.toHaveBeenCalled()
    })

    it('should register built-in functions and components by default', () => {
      // eslint-disable-next-line no-new
      new Forge(createDefaultOptions())

      const mockComponentRegistry = (ComponentRegistry as MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockFunctionRegistry.registerBuiltInFunctions).toHaveBeenCalledTimes(1)
      expect(mockComponentRegistry.registerBuiltInComponents).toHaveBeenCalledTimes(1)
    })

    it('should use custom logger when provided', () => {
      const engine = new Forge(createDefaultOptions())

      // Logger is stored and will be used in other methods
      expect(engine).toBeDefined()
    })
  })

  describe('registerGlobalComponent', () => {
    it('should register a single component', () => {
      const engine = new Forge(createDefaultOptions())
      const mockComponent = buildComponent('test-component', () => '<div>Test</div>')

      engine.registerGlobalComponent(mockComponent)

      const mockComponentRegistry = (ComponentRegistry as MockedClass<typeof ComponentRegistry>).mock.instances[0]
      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith([mockComponent])
    })
  })

  describe('registerGlobalComponents', () => {
    it('should register multiple components', () => {
      const engine = new Forge(createDefaultOptions())
      const mockComponents = [
        buildComponent('component-1', () => '<div>1</div>'),
        buildComponent('component-2', () => '<div>2</div>'),
      ]

      engine.registerGlobalComponents(mockComponents)

      const mockComponentRegistry = (ComponentRegistry as MockedClass<typeof ComponentRegistry>).mock.instances[0]
      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith(mockComponents)
    })
  })

  describe('registerGlobalFunctions', () => {
    it('should register function implementations', () => {
      const engine = new Forge(createDefaultOptions())
      const functions = {
        Function1: () => () => true,
        Function2: () => (value: unknown) => value,
      }

      engine.registerGlobalFunctions(functions)

      const mockFunctionRegistry = (FunctionRegistry as MockedClass<typeof FunctionRegistry>).mock.instances[0]
      expect(mockFunctionRegistry.register).toHaveBeenCalledWith({
        Function1: { name: 'Function1', evaluate: expect.any(Function), isAsync: false },
        Function2: { name: 'Function2', evaluate: expect.any(Function), isAsync: false },
      })
    })

    it('should inject dependencies into global function implementations', () => {
      const engine = new Forge(createDefaultOptions())
      const functions = {
        WithSuffix: (deps: { suffix: string }) => (value: unknown) => `${String(value)}${deps.suffix}`,
      }

      engine.registerGlobalFunctions(functions, { suffix: '!' })

      const mockFunctionRegistry = (FunctionRegistry as MockedClass<typeof FunctionRegistry>).mock.instances[0]
      const registerMock = vi.mocked(mockFunctionRegistry.register)
      const registeredFunctions = registerMock.mock.calls.at(-1)?.[0]

      expect(registeredFunctions?.WithSuffix.evaluate('hello')).toBe('hello!')
    })
  })

  describe('registerPackage()', () => {
    const mockJourneyDef = { type: 'journey', code: 'pkg-journey', title: 'Package Journey' } as any

    it('should create and mount a package instance', () => {
      // Arrange
      const mockComponent = buildComponent('pkg-comp', () => '<div />')
      const functionDependencies = { prefix: 'case-' }
      const pkg = {
        journey: mockJourneyDef,
        components: [mockComponent],
        functions: { PkgFunc: () => () => true } as any,
      }

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      engine.registerPackage(pkg, functionDependencies)

      // Assert
      expect(PackageInstance.create).toHaveBeenCalledWith(
        pkg,
        expect.objectContaining({
          functionRegistry: expect.any(FunctionRegistry),
          componentRegistry: expect.any(ComponentRegistry),
          functionDependencies,
        }),
      )
      expect(mockForgeRouter.mount).toHaveBeenCalledWith(mockPackageInstance, expect.any(Object))
    })

    it('should skip registration when enabled is false', () => {
      // Arrange
      const pkg = { journey: mockJourneyDef, enabled: false }
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      engine.registerPackage(pkg)

      // Assert
      expect(PackageInstance.create).not.toHaveBeenCalled()
    })

    it('should throw on package creation failure by default', () => {
      // Arrange
      const error = new Error('Package failed')
      ;(PackageInstance.create as Mock).mockImplementation(() => {
        throw error
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act & Assert
      expect(() => engine.registerPackage({ journey: mockJourneyDef })).toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith(error)
    })

    it('should swallow errors when strictRegistration is false', () => {
      // Arrange
      ;(PackageInstance.create as Mock).mockImplementation(() => {
        throw new Error('Package failed')
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))

      // Act & Assert
      expect(() => engine.registerPackage({ journey: mockJourneyDef })).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should return this for chaining', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      const result = engine.registerPackage({ journey: mockJourneyDef })

      // Assert
      expect(result).toBe(engine)
    })
  })

  describe('getRouter', () => {
    it('should return the main router', () => {
      const engine = new Forge(createDefaultOptions())
      const router = engine.getRouter()

      expect(router).toBe(mockRouter)
    })
  })

  describe('fluent interface / method chaining', () => {
    it('should support method chaining for all registration methods', () => {
      const engine = new Forge(createDefaultOptions())
      const component1 = buildComponent('comp-1', () => '<div>1</div>')
      const component2 = buildComponent('comp-2', () => '<div>2</div>')
      const functions1 = {
        Func1: () => () => true,
      }
      const functions2 = {
        Func2: () => (value: unknown) => value,
      }

      const result = engine
        .registerGlobalComponent(component1)
        .registerGlobalComponents([component2])
        .registerGlobalFunctions(functions1)
        .registerGlobalFunctions(functions2)
        .registerPackage({ journey: 'config-1' })
        .registerPackage({ journey: 'config-2' })

      expect(result).toBe(engine)
      expect(mockForgeRouter.mount).toHaveBeenCalledTimes(2)
    })

    it('should support chaining even when package registration fails', () => {
      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))
      const component = buildComponent('comp', () => '<div />')

      ;(PackageInstance.create as Mock)
        .mockImplementationOnce(() => {
          throw new Error('First form fails')
        })
        .mockImplementationOnce(() => mockPackageInstance)

      const result = engine
        .registerGlobalComponent(component)
        .registerPackage({ journey: 'bad-config' })
        .registerPackage({ journey: 'good-config' })

      expect(result).toBe(engine)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.any(Error))
      expect(mockForgeRouter.mount).toHaveBeenCalledTimes(1)
    })

    it('should handle complete registration workflow with chaining', () => {
      const engine = new Forge(createDefaultOptions())
      const customComponent = buildComponent('custom-input', () => '<input />')
      const customFunctions = {
        CustomValidator: () => (value: unknown) => value !== null,
      }

      const result = engine
        .registerGlobalComponent(customComponent)
        .registerGlobalFunctions(customFunctions)
        .registerPackage({ journey: 'test-config' })

      // Verify chaining returns the engine
      expect(result).toBe(engine)

      // Verify all registrations worked
      const mockComponentRegistry = (ComponentRegistry as MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith([customComponent])
      expect(mockFunctionRegistry.register).toHaveBeenCalledWith({
        CustomValidator: { name: 'CustomValidator', evaluate: expect.any(Function), isAsync: false },
      })
      expect(mockForgeRouter.mount).toHaveBeenCalledWith(mockPackageInstance, expect.any(Object))
    })
  })
})
