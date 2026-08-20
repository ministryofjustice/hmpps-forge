import type { MockInstance } from 'vitest'
import { buildComponent } from '../components/utils/buildComponent'
import { createForgePackage } from '../authoring/builders'
import { ConditionsRegistry } from '../built-ins/functions/conditions'
import { GeneratorsRegistry } from '../built-ins/functions/generators'
import { TransformersRegistry } from '../built-ins/functions/transformers'
import { coreComponents } from '../built-ins/components'
import ComponentRegistry from './chassis/registries/ComponentRegistry'
import FunctionRegistry from './chassis/registries/FunctionRegistry'
import MountRegistry from './chassis/registries/MountRegistry'
import type { MountedNode } from './chassis/registries/MountRegistry'
import RequestPipeline from './chassis/runtime/pipeline/RequestPipeline'
import type { PackageDependencies } from './chassis/contracts/ast/engine.type'
import PackageInstance from './PackageInstance'
import ForgeRegistrationError from './errors/ForgeRegistrationError'
import Forge from './Forge'

vi.mock('./PackageInstance')
vi.mock('./chassis/registries/ComponentRegistry')
vi.mock('./chassis/registries/FunctionRegistry')
vi.mock('./chassis/registries/MountRegistry')
vi.mock('./chassis/runtime/pipeline/RequestPipeline')

describe('Forge', () => {
  let mockLogger: Mocked<Console>
  let mockPackageInstance: Mocked<PackageInstance>
  let mockPackageDependencies: PackageDependencies
  let mockMountRegistry: Mocked<MountRegistry>
  let mockRequestPipeline: Mocked<RequestPipeline>

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

    mockRequestPipeline = {
      evaluate: vi.fn(),
    } as unknown as Mocked<RequestPipeline>
    ;(RequestPipeline as MockedClass<typeof RequestPipeline>).mockImplementation(function mockRequestPipelineCtor() {
      return mockRequestPipeline as any
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

  /**
   * Helper to create a minimal branded package for registration tests
   */
  function createMinimalPackage(code: string) {
    return createForgePackage({
      journey: { type: 'journey', code, title: code, path: `/${code}`, steps: [] } as any,
    })
  }

  describe('constructor', () => {
    it('should initialize with default options', () => {
      // eslint-disable-next-line no-new
      new Forge(createDefaultOptions())

      expect(ComponentRegistry).toHaveBeenCalledTimes(1)
      expect(FunctionRegistry).toHaveBeenCalledTimes(1)
      expect(MountRegistry).toHaveBeenCalledTimes(1)
      expect(RequestPipeline).toHaveBeenCalledTimes(1)
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

      expect(mockFunctionRegistry.register).not.toHaveBeenCalled()
      expect(mockComponentRegistry.registerMany).not.toHaveBeenCalled()
    })

    it('should register built-in functions and components by default', () => {
      // eslint-disable-next-line no-new
      new Forge(createDefaultOptions())

      const mockComponentRegistry = (ComponentRegistry as MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockFunctionRegistry.register).toHaveBeenCalledWith(ConditionsRegistry)
      expect(mockFunctionRegistry.register).toHaveBeenCalledWith(TransformersRegistry)
      expect(mockFunctionRegistry.register).toHaveBeenCalledWith(GeneratorsRegistry)
      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith([...coreComponents])
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
      const pkg = createForgePackage<{ prefix: string }>({
        journey: mockJourneyDef,
        components: [mockComponent],
        functions: { PkgFunc: () => () => true } as any,
      })

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

    it('should reject a package not created with createForgePackage', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      const act = () => engine.registerPackage({ journey: mockJourneyDef } as any)

      // Assert
      expect(act).toThrow('Packages must be created with createForgePackage(...) before registration')
      expect(PackageInstance).not.toHaveBeenCalled()
    })

    it('should log instead of throwing for an unbranded package when strictRegistration is false', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))

      // Act
      const result = engine.registerPackage({ journey: mockJourneyDef } as any)

      // Assert
      expect(result).toBe(engine)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.any(Error))
      expect(PackageInstance).not.toHaveBeenCalled()
    })

    it('should skip registration when enabled is false', () => {
      // Arrange
      const pkg = createForgePackage({ journey: mockJourneyDef, enabled: false })
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
      expect(() => engine.registerPackage(createForgePackage({ journey: mockJourneyDef }))).toThrow(error)
      expect(mockLogger.error).not.toHaveBeenCalled()
    })

    it('should throw formatted registration errors for aggregate failures', () => {
      // Arrange
      const schemaError = Object.assign(new Error('Invalid input: expected "HookType.Access"'), {
        name: 'ForgeSchemaError',
        formattedPath: 'guide > onAccess[1] > type',
        code: 'invalid_value',
      })
      const aggregateError = new AggregateError([schemaError], 'Schema validation failed')

      ;(PackageInstance as unknown as Mock).mockImplementation(function mockPackageInstanceCtor() {
        throw aggregateError
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      const act = () => engine.registerPackage(createForgePackage({ journey: mockJourneyDef }))

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
      expect(() => engine.registerPackage(createForgePackage({ journey: mockJourneyDef }))).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalled()
    })

    it('should return this for chaining', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      const result = engine.registerPackage(createForgePackage({ journey: mockJourneyDef }))

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

  describe('getRouter()', () => {
    const SEEN_CODES = Symbol.for('forge:deprecations')
    const deprecationMessage =
      'frameworkAdapter and getRouter() are deprecated - build framework routers directly, ' +
      'for example createExpressRouter(forge, options).'
    let emitWarning: MockInstance<typeof process.emitWarning>

    beforeEach(() => {
      // Reset the process-global dedup set so each case observes the once-only warning.
      delete (globalThis as Record<symbol, unknown>)[SEEN_CODES]
      emitWarning = vi.spyOn(process, 'emitWarning').mockImplementation(() => {})
    })

    afterEach(() => {
      emitWarning.mockRestore()
    })

    it('should build the router through the deprecated framework adapter', () => {
      // Arrange
      const router = { kind: 'router' }
      const frameworkAdapter = { build: vi.fn().mockReturnValue(router) }
      const engine = new Forge(createDefaultOptions({ frameworkAdapter, logger: mockLogger }))

      // Act
      const result = engine.getRouter()

      // Assert
      expect(result).toBe(router)
      expect(frameworkAdapter.build).toHaveBeenCalledWith(engine)
      expect(emitWarning).toHaveBeenCalledWith(deprecationMessage, {
        type: 'DeprecationWarning',
        code: 'FORGE_DEP_getRouter',
      })
    })

    it('should throw when no framework adapter is configured', () => {
      // Arrange
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      const act = () => engine.getRouter()

      // Assert
      expect(act).toThrow('getRouter() requires a frameworkAdapter')
      expect(emitWarning).toHaveBeenCalledWith(deprecationMessage, {
        type: 'DeprecationWarning',
        code: 'FORGE_DEP_getRouter',
      })
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
        .registerPackage(createMinimalPackage('config-1'))
        .registerPackage(createMinimalPackage('config-2'))

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
        .registerPackage(createMinimalPackage('bad-config'))
        .registerPackage(createMinimalPackage('good-config'))

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
        .registerPackage(createMinimalPackage('test-config'))

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
      vi.mocked(mockRequestPipeline.evaluate).mockResolvedValue(outcome as never)

      // Act
      const result = await engine.execute(request)

      // Assert
      expect(result).toBe(outcome)
      expect(mockMountRegistry.getNode).toHaveBeenCalledWith('test::step-one')
      expect(mockRequestPipeline.evaluate).toHaveBeenCalledWith(expect.objectContaining({ node: mockNode }))
    })

    it('should return an error outcome when no node is registered for the snapshot', async () => {
      // Arrange
      const engine = new Forge(createDefaultOptions())
      const request = { snapshot: { nodeId: 'unknown::step', method: 'GET' } } as never

      vi.mocked(mockMountRegistry.getNode).mockReturnValue(undefined)

      // Act
      const result = await engine.execute(request)

      // Assert
      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.error.message).toBe('No node registered for "unknown::step"')
      }
    })

    it('should preserve an Error rejected by the runtime', async () => {
      // Arrange
      const engine = new Forge(createDefaultOptions())
      const mockNode = { mountKey: 'test::step-one', kind: 'step' } as MountedNode
      const request = { snapshot: { nodeId: 'test::step-one', method: 'GET' } } as never
      const error = Object.assign(new Error('Effect failed'), { status: 409, diagnostic: 'effect' })

      vi.mocked(mockMountRegistry.getNode).mockReturnValue(mockNode)
      vi.mocked(mockRequestPipeline.evaluate).mockRejectedValue(error)

      // Act
      const result = await engine.execute(request)

      // Assert
      expect(result).toEqual({ kind: 'error', error })

      if (result.kind === 'error') {
        expect(result.error).toBe(error)
        expect(result.error.stack).toBe(error.stack)
        expect(result.error).toMatchObject({ status: 409, diagnostic: 'effect' })
      }
    })

    it('should preserve an Error thrown synchronously by the runtime', async () => {
      // Arrange
      const engine = new Forge(createDefaultOptions())
      const mockNode = { mountKey: 'test::step-one', kind: 'step' } as MountedNode
      const request = { snapshot: { nodeId: 'test::step-one', method: 'GET' } } as never
      const error = new Error('Synchronous failure')

      vi.mocked(mockMountRegistry.getNode).mockReturnValue(mockNode)
      vi.mocked(mockRequestPipeline.evaluate).mockImplementation(() => {
        throw error
      })

      // Act
      const result = await engine.execute(request)

      // Assert
      expect(result).toEqual({ kind: 'error', error })
    })

    it('should wrap a non-Error runtime failure and retain the value as its cause', async () => {
      // Arrange
      const engine = new Forge(createDefaultOptions())
      const mockNode = { mountKey: 'test::step-one', kind: 'step' } as MountedNode
      const request = { snapshot: { nodeId: 'test::step-one', method: 'GET' } } as never
      const failure = { reason: 'dependency unavailable' }

      vi.mocked(mockMountRegistry.getNode).mockReturnValue(mockNode)
      vi.mocked(mockRequestPipeline.evaluate).mockRejectedValue(failure)

      // Act
      const result = await engine.execute(request)

      // Assert
      expect(result.kind).toBe('error')

      if (result.kind === 'error') {
        expect(result.error).toBeInstanceOf(Error)
        expect(result.error.message).toBe('[object Object]')
        expect(result.error.cause).toBe(failure)
        expect(result.error.status).toBeUndefined()
        expect(result.error.statusCode).toBeUndefined()
      }
    })
  })
})
