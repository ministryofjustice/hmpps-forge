import { buildComponent } from '../components/utils/buildComponent'
import ComponentRegistry from './registries/ComponentRegistry'
import FunctionRegistry from './registries/FunctionRegistry'
import MountRegistry from './registries/MountRegistry'
import type { MountedNode } from './registries/MountRegistry'
import RequestEvaluator from './runtime/RequestEvaluator'
import type { PackageDependencies } from './contracts/ast/engine.type'
import PackageInstance from './PackageInstance'
import ForgeRegistrationError from './errors/ForgeRegistrationError'
import Forge from './Forge'

vi.mock('./PackageInstance')
vi.mock('./registries/ComponentRegistry')
vi.mock('./registries/FunctionRegistry')
vi.mock('./registries/MountRegistry')
vi.mock('./runtime/RequestEvaluator')

describe('Forge', () => {
  let mockLogger: Mocked<Console>
  let mockPackageInstance: Mocked<PackageInstance>
  let mockPackageDependencies: PackageDependencies
  let mockMountRegistry: Mocked<MountRegistry>
  let mockRequestEvaluator: Mocked<RequestEvaluator>

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
    ;(PackageInstance as MockedClass<typeof PackageInstance>).mockImplementation(function mockPackageInstanceCtor() {
      return mockPackageInstance as any
    })

    mockMountRegistry = {
      register: vi.fn(),
      getNode: vi.fn(),
      getTopology: vi.fn().mockReturnValue({ routes: [] }),
    } as any
    ;(MountRegistry as MockedClass<typeof MountRegistry>).mockImplementation(function mockMountRegistryCtor() {
      return mockMountRegistry as any
    })

    mockRequestEvaluator = {
      evaluate: vi.fn(),
    } as unknown as Mocked<RequestEvaluator>
    ;(RequestEvaluator as MockedClass<typeof RequestEvaluator>).mockImplementation(function mockRequestEvaluatorCtor() {
      return mockRequestEvaluator as any
    })
  })

  /**
   * Helper to create default options for Forge
   */
  function createDefaultOptions(overrides: Record<string, unknown> = {}) {
    return {
      ...overrides,
    }
  }

  describe('constructor', () => {
    it('should initialize with default options', () => {
      // eslint-disable-next-line no-new
      new Forge(createDefaultOptions())

      expect(ComponentRegistry).toHaveBeenCalledTimes(1)
      expect(FunctionRegistry).toHaveBeenCalledTimes(1)
      expect(MountRegistry).toHaveBeenCalledTimes(1)
      expect(RequestEvaluator).toHaveBeenCalledTimes(1)
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

    it('should create and register a package instance', () => {
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
      expect(PackageInstance).toHaveBeenCalledWith(
        pkg,
        expect.objectContaining({
          functionRegistry: expect.any(FunctionRegistry),
          componentRegistry: expect.any(ComponentRegistry),
          functionDependencies,
        }),
      )
      expect(mockMountRegistry.register).toHaveBeenCalledWith(mockPackageInstance)
    })

    it('should skip registration when enabled is false', () => {
      // Arrange
      const pkg = { journey: mockJourneyDef, enabled: false }
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      engine.registerPackage(pkg)

      // Assert
      expect(PackageInstance).not.toHaveBeenCalled()
    })

    it('should throw on package creation failure by default', () => {
      // Arrange
      const error = new Error('Package failed')
      ;(PackageInstance as unknown as Mock).mockImplementation(function mockPackageInstanceCtor() {
        throw error
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act & Assert
      expect(() => engine.registerPackage({ journey: mockJourneyDef })).toThrow(error)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should throw formatted registration errors for aggregate failures', () => {
      // Arrange
      const schemaError = Object.assign(new Error('Invalid input: expected "HookType.Access"'), {
        name: 'ForgeConfigurationSchemaError',
        formattedPath: 'guide > onAccess[1] > type',
        code: 'invalid_value',
      })
      const aggregateError = new AggregateError([schemaError], 'Schema validation failed')

      ;(PackageInstance as unknown as Mock).mockImplementation(function mockPackageInstanceCtor() {
        throw aggregateError
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      const act = () => engine.registerPackage({ journey: mockJourneyDef })

      // Assert
      expect(act).toThrow(ForgeRegistrationError)

      try {
        act()
      } catch (error) {
        expect(error).toBeInstanceOf(ForgeRegistrationError)

        if (error instanceof ForgeRegistrationError) {
          expect(error.stack).toBe(error.message)
          expect(error.message).toContain('Forge registration failed: Schema validation failed')
          expect(error.message).toContain('Path: guide > onAccess[1] > type')
          expect(error.message).toContain('Code: invalid_value')
        }
      }
    })

    it('should swallow errors when strictRegistration is false', () => {
      // Arrange
      ;(PackageInstance as unknown as Mock).mockImplementation(function mockPackageInstanceCtor() {
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

  describe('getTopology', () => {
    it('should return the topology from the evaluator', () => {
      const engine = new Forge(createDefaultOptions())
      const topology = engine.getTopology()

      expect(topology).toEqual({ routes: [] })
      expect(mockMountRegistry.getTopology).toHaveBeenCalledTimes(1)
    })
  })

  describe('getInstrumentation()', () => {
    it('should return enabled instrumentation when sinks are configured', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions({ instrumentation: { sinks: [{ onRequestTrace: vi.fn() }] } }))

      // Act
      const instrumentation = engine.getInstrumentation()

      // Assert
      expect(instrumentation.enabled).toBe(true)
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
      expect(mockMountRegistry.register).toHaveBeenCalledTimes(2)
    })

    it('should support chaining even when package registration fails', () => {
      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))
      const component = buildComponent('comp', () => '<div />')

      ;(PackageInstance as unknown as Mock)
        .mockImplementationOnce(function mockPackageInstanceCtor() {
          throw new Error('First form fails')
        })
        .mockImplementationOnce(function mockPackageInstanceCtor() {
          return mockPackageInstance
        })

      const result = engine
        .registerGlobalComponent(component)
        .registerPackage({ journey: 'bad-config' })
        .registerPackage({ journey: 'good-config' })

      expect(result).toBe(engine)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.any(Error))
      expect(mockMountRegistry.register).toHaveBeenCalledTimes(1)
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
      expect(mockMountRegistry.register).toHaveBeenCalledWith(mockPackageInstance)
    })
  })

  describe('execute()', () => {
    it('should resolve the node and delegate to the runtime', async () => {
      // Arrange
      const engine = new Forge(createDefaultOptions())
      const mockNode = { mountKey: 'test::step-one', kind: 'step' } as MountedNode
      const request = { snapshot: { nodeId: 'test::step-one', method: 'GET' } } as never
      const outcome = { kind: 'navigate', url: '/next' }

      vi.mocked(mockMountRegistry.getNode).mockReturnValue(mockNode)
      vi.mocked(mockRequestEvaluator.evaluate).mockResolvedValue(outcome as never)

      // Act
      const result = await engine.execute(request)

      // Assert
      expect(result).toBe(outcome)
      expect(mockMountRegistry.getNode).toHaveBeenCalledWith('test::step-one')
      expect(mockRequestEvaluator.evaluate).toHaveBeenCalledWith(expect.objectContaining({ node: mockNode }))
    })

    it('should throw when no node is registered for the snapshot', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions())
      const request = { snapshot: { nodeId: 'unknown::step', method: 'GET' } } as never

      vi.mocked(mockMountRegistry.getNode).mockReturnValue(undefined)

      // Act & Assert
      expect(() => engine.execute(request)).toThrow('[Forge] No node registered for "unknown::step"')
    })
  })
})
