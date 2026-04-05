import { buildComponent } from '../components/utils/buildComponent'
import type { JourneyDefinition } from '../authoring/types/structures.type'
import ComponentRegistry from '../components/ComponentRegistry'
import FunctionRegistry from './FunctionRegistry'
import type { FrameworkAdapter, FrameworkAdapterBuilder } from '../framework/types/adapter.type'
import ForgeRouter from './runtime/routes/ForgeRouter'
import JourneyInstance from './JourneyInstance'
import Forge from './Forge'

jest.mock('./JourneyInstance')
jest.mock('../components/ComponentRegistry')
jest.mock('./FunctionRegistry')
jest.mock('./runtime/routes/ForgeRouter')

describe('Forge', () => {
  let mockLogger: jest.Mocked<Console>
  let mockRouter: unknown
  let mockJourneyInstance: jest.Mocked<JourneyInstance>
  let mockForgeRouter: jest.Mocked<ForgeRouter<unknown>>
  let mockFrameworkAdapter: jest.Mocked<FrameworkAdapter<unknown, unknown, unknown>>
  let mockFrameworkAdapterBuilder: jest.Mocked<FrameworkAdapterBuilder<unknown, unknown, unknown>>

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any

    // Mock router (opaque object since it's framework-specific)
    mockRouter = { _type: 'main-router' }

    // Mock framework adapter
    mockFrameworkAdapter = {
      createRouter: jest.fn().mockReturnValue(mockRouter),
      mountRouter: jest.fn(),
      get: jest.fn(),
      post: jest.fn(),
      toStepRequest: jest.fn(),
      getBaseUrl: jest.fn(),
      redirect: jest.fn(),
      forwardError: jest.fn(),
      render: jest.fn().mockResolvedValue(undefined),
    } as any

    // Mock framework adapter builder (returns adapter when build() is called)
    mockFrameworkAdapterBuilder = {
      build: jest.fn().mockReturnValue(mockFrameworkAdapter),
    } as any

    // Mock ForgeRouter with a mutable routes array that mount populates
    const mockRoutes: Array<{ method: string; path: string }> = []

    mockForgeRouter = {
      mount: jest.fn().mockImplementation(() => {
        mockRoutes.push(
          { method: 'GET', path: '/start' },
          { method: 'GET', path: '/page-1' },
          { method: 'POST', path: '/page-1' },
        )
      }),
      getRouter: jest.fn().mockReturnValue(mockRouter),
      getRegisteredRoutes: jest.fn().mockImplementation(() => [...mockRoutes]),
    } as any
    ;(ForgeRouter as jest.MockedClass<typeof ForgeRouter>).mockImplementation(() => mockForgeRouter as any)

    // Mock JourneyInstance (now a pure data container)
    mockJourneyInstance = {
      getJourneyTitle: jest.fn().mockReturnValue('Test Form'),
      getJourneyCode: jest.fn().mockReturnValue('test-form'),
      getCompiledForm: jest.fn().mockReturnValue([]),
      getConfiguration: jest.fn().mockReturnValue({ code: 'test-form', title: 'Test Form' }),
    } as any
    ;(JourneyInstance.createFromConfiguration as jest.Mock).mockReturnValue(mockJourneyInstance)
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

      const mockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as jest.MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockFunctionRegistry.registerBuiltInFunctions).not.toHaveBeenCalled()
      expect(mockComponentRegistry.registerBuiltInComponents).not.toHaveBeenCalled()
    })

    it('should register built-in functions and components by default', () => {
      // eslint-disable-next-line no-new
      new Forge(createDefaultOptions())

      const mockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as jest.MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockFunctionRegistry.registerBuiltInFunctions).toHaveBeenCalledTimes(1)
      expect(mockComponentRegistry.registerBuiltInComponents).toHaveBeenCalledTimes(1)
    })

    it('should use custom logger when provided', () => {
      const engine = new Forge(createDefaultOptions())

      // Logger is stored and will be used in other methods
      expect(engine).toBeDefined()
    })
  })

  describe('registerComponent', () => {
    it('should register a single component', () => {
      const engine = new Forge(createDefaultOptions())
      const mockComponent = buildComponent('test-component', () => '<div>Test</div>')

      engine.registerComponent(mockComponent)

      const mockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock.instances[0]
      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith([mockComponent])
    })
  })

  describe('registerComponents', () => {
    it('should register multiple components', () => {
      const engine = new Forge(createDefaultOptions())
      const mockComponents = [
        buildComponent('component-1', () => '<div>1</div>'),
        buildComponent('component-2', () => '<div>2</div>'),
      ]

      engine.registerComponents(mockComponents)

      const mockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock.instances[0]
      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith(mockComponents)
    })
  })

  describe('registerFunctions', () => {
    it('should register a function registry object', () => {
      const engine = new Forge(createDefaultOptions())
      const mockRegistry = {
        Function1: { name: 'Function1', evaluate: () => true, isAsync: false },
        Function2: { name: 'Function2', evaluate: (x: any) => x, isAsync: false },
      }

      engine.registerFunctions(mockRegistry)

      const mockFunctionRegistry = (FunctionRegistry as jest.MockedClass<typeof FunctionRegistry>).mock.instances[0]
      expect(mockFunctionRegistry.register).toHaveBeenCalledWith(mockRegistry)
    })
  })

  describe('register()', () => {
    it('should successfully register a journey from string configuration', () => {
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))
      const formConfig = JSON.stringify({
        journey: 'test-journey',
        code: 'test-form',
        title: 'Test Form',
      })

      engine.register(formConfig)

      // Verify JourneyInstance creation
      expect(JourneyInstance.createFromConfiguration).toHaveBeenCalledWith(
        formConfig,
        expect.objectContaining({
          functionRegistry: expect.any(FunctionRegistry),
          componentRegistry: expect.any(ComponentRegistry),
          logger: mockLogger,
        }),
      )

      // Verify ForgeRouter.mount was called
      expect(mockForgeRouter.mount).toHaveBeenCalledWith(mockJourneyInstance)

      // Verify structured logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        { journey: 'test-form', routes: 3 },
        "Forge: Registered journey 'Test Form' with 3 routes",
      )
    })

    it('should successfully register a journey from JourneyDefinition object', () => {
      const engine = new Forge(createDefaultOptions())
      const formConfig: JourneyDefinition = {
        journey: 'test-journey',
        code: 'test-form',
        title: 'Test Form',
        steps: [],
      } as any

      engine.register(formConfig)

      expect(JourneyInstance.createFromConfiguration).toHaveBeenCalledWith(formConfig, expect.any(Object))
    })

    it('should throw registration errors by default', () => {
      // Arrange
      const error = new Error('Registration failed')
      ;(JourneyInstance.createFromConfiguration as jest.Mock).mockImplementation(() => {
        throw error
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act & Assert
      expect(() => engine.register('invalid-config')).toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith(error)
      expect(mockForgeRouter.mount).not.toHaveBeenCalled()
    })

    it('should swallow registration errors when strictRegistration is false', () => {
      // Arrange
      const error = new Error('Registration failed')
      ;(JourneyInstance.createFromConfiguration as jest.Mock).mockImplementation(() => {
        throw error
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))

      // Act & Assert
      expect(() => engine.register('invalid-config')).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith(error)
      expect(mockForgeRouter.mount).not.toHaveBeenCalled()
    })

    it('should log AggregateError details during registration', () => {
      // Arrange
      const error1 = new Error('Validation error 1')
      const error2 = new Error('Validation error 2')
      const aggregateError = new AggregateError([error1, error2], 'Multiple validation errors')

      ;(JourneyInstance.createFromConfiguration as jest.Mock).mockImplementation(() => {
        throw aggregateError
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))
      engine.register('invalid-config')

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith('Multiple validation errors:')
      expect(mockLogger.error).toHaveBeenCalledWith('Error: Validation error 1')
      expect(mockLogger.error).toHaveBeenCalledWith('Error: Validation error 2')
      expect(mockLogger.error).toHaveBeenCalledTimes(3)
    })

    it('should handle errors without toString method in AggregateError', () => {
      // Arrange
      const error1 = { message: 'Object error' }
      const error2: any = null
      const aggregateError = new AggregateError([error1, error2], 'Mixed errors')

      ;(JourneyInstance.createFromConfiguration as jest.Mock).mockImplementation(() => {
        throw aggregateError
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))
      engine.register('invalid-config')

      // Assert
      expect(mockLogger.error).toHaveBeenCalledWith('Mixed errors:')
      expect(mockLogger.error).toHaveBeenCalledWith('[object Object]')
      expect(mockLogger.error).toHaveBeenCalledWith('null')
    })
  })

  describe('registerPackage()', () => {
    const mockJourneyDef = { type: 'journey', code: 'pkg-journey', title: 'Package Journey' } as any

    it('should register components, functions, and journey from a package', () => {
      // Arrange
      const mockComponent = buildComponent('pkg-comp', () => '<div />')
      const mockFunctions = {
        PkgFunc: { name: 'PkgFunc', evaluate: () => true, isAsync: false },
      }
      const pkg = {
        journey: mockJourneyDef,
        components: [mockComponent],
        functions: (() => mockFunctions) as any,
      }

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      engine.registerPackage(pkg, {})

      // Assert
      const mockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock.instances[0]

      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith([mockComponent])
      expect(JourneyInstance.createFromConfiguration).toHaveBeenCalled()
    })

    it('should skip registration when enabled is false', () => {
      // Arrange
      const pkg = { journey: mockJourneyDef, enabled: false }
      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act
      engine.registerPackage(pkg)

      // Assert
      expect(JourneyInstance.createFromConfiguration).not.toHaveBeenCalled()
    })

    it('should throw on journey registration failure by default', () => {
      // Arrange
      const error = new Error('Journey failed')
      ;(JourneyInstance.createFromConfiguration as jest.Mock).mockImplementation(() => {
        throw error
      })

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))

      // Act & Assert
      expect(() => engine.registerPackage({ journey: mockJourneyDef })).toThrow(error)
      expect(mockLogger.error).toHaveBeenCalledWith(error)
    })

    it('should throw on component registration failure by default', () => {
      // Arrange
      jest.clearAllMocks()
      mockFrameworkAdapterBuilder = { build: jest.fn().mockReturnValue(mockFrameworkAdapter) } as any
      ;(ForgeRouter as jest.MockedClass<typeof ForgeRouter>).mockImplementation(() => mockForgeRouter as any)

      const engine = new Forge(createDefaultOptions({ logger: mockLogger }))
      const freshMockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock
        .instances[0]

      const error = new Error('Bad component')
      ;(freshMockComponentRegistry.registerMany as jest.Mock).mockImplementation(() => {
        throw error
      })

      const pkg = {
        journey: mockJourneyDef,
        components: [{ variant: 'bad', render: null as any }],
      }

      // Act & Assert
      expect(() => engine.registerPackage(pkg)).toThrow(error)
    })

    it('should swallow errors when strictRegistration is false', () => {
      // Arrange
      ;(JourneyInstance.createFromConfiguration as jest.Mock).mockImplementation(() => {
        throw new Error('Journey failed')
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
        Func1: { name: 'Func1', evaluate: () => true, isAsync: false },
      }
      const functions2 = {
        Func2: { name: 'Func2', evaluate: (x: any) => x, isAsync: false },
      }

      const result = engine
        .registerComponent(component1)
        .registerComponents([component2])
        .registerFunctions(functions1)
        .registerFunctions(functions2)
        .register('config-1')
        .register('config-2')

      expect(result).toBe(engine)
      expect(mockForgeRouter.mount).toHaveBeenCalledTimes(2)
    })

    it('should support chaining even when form registration fails', () => {
      const engine = new Forge(createDefaultOptions({ logger: mockLogger, strictRegistration: false }))
      const component = buildComponent('comp', () => '<div />')

      ;(JourneyInstance.createFromConfiguration as jest.Mock)
        .mockImplementationOnce(() => {
          throw new Error('First form fails')
        })
        .mockImplementationOnce(() => mockJourneyInstance)

      const result = engine
        .registerComponent(component)
        .register('bad-config') // This will fail
        .register('good-config') // This should work

      expect(result).toBe(engine)
      expect(mockLogger.error).toHaveBeenCalledWith(expect.any(Error))
      expect(mockForgeRouter.mount).toHaveBeenCalledTimes(1)
    })

    it('should handle complete registration workflow with chaining', () => {
      const engine = new Forge(createDefaultOptions())
      const customComponent = buildComponent('custom-input', () => '<input />')
      const customFunctions = {
        CustomValidator: {
          name: 'CustomValidator',
          evaluate: (value: any) => value !== null,
          isAsync: false,
        },
      }

      const result = engine
        .registerComponent(customComponent)
        .registerFunctions(customFunctions)
        .register('test-config')

      // Verify chaining returns the engine
      expect(result).toBe(engine)

      // Verify all registrations worked
      const mockComponentRegistry = (ComponentRegistry as jest.MockedClass<typeof ComponentRegistry>).mock.instances[0]
      const mockFunctionRegistry = (FunctionRegistry as jest.MockedClass<typeof FunctionRegistry>).mock.instances[0]

      expect(mockComponentRegistry.registerMany).toHaveBeenCalledWith([customComponent])
      expect(mockFunctionRegistry.register).toHaveBeenCalledWith(customFunctions)
      expect(mockForgeRouter.mount).toHaveBeenCalledWith(mockJourneyInstance)
    })
  })
})
