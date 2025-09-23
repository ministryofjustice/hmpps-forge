import RouteGenerator from '@form-engine/core/runtime/routes/RouteGenerator'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { FormInstanceDependencies } from '@form-engine/core/types/engine.type'
import { JourneyASTNode } from '@form-engine/core/types/structures.type'
import { FormEngineOptions } from '@form-engine/core/FormEngine'

describe('RouteGenerator', () => {
  const mockDependencies: FormInstanceDependencies = {
    functionRegistry: {} as any,
    componentRegistry: {} as any,
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    } as any,
  }

  const mockOptions: FormEngineOptions = {
    disableBuiltInFunctions: false,
    disableBuiltInComponents: false,
    basePath: '/forms',
    debug: false,
  }

  const createMockCompiledAST = (root: JourneyASTNode) => {
    return {
      getRoot: () => root,
      getNodeRegistry: () => ({
        size: () => 10,
      }),
      getAnalysis: () => ({
        topoOrder: [1, 2, 3],
        nodes: new Map(),
        pseudoNodes: new Map(),
        graph: {
          adjacency: new Map(),
        },
        cycles: [] as any[],
      }),
      getVisualizationData: () => ({}),
    } as any
  }

  beforeEach(() => {
    // Reset IDs for consistent test results
    ASTTestFactory.resetIds()
    jest.clearAllMocks()
  })

  describe('generateRoutes', () => {
    it('should generate routes for steps without journey path', () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withStep(step => step.withProperty('path', '/step-one'))
        .withStep(step => step.withProperty('path', '/step-two'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      expect(result.routes).toHaveLength(4) // 2 steps * 2 methods (GET, POST)

      const routePaths = result.routes.map(r => r.path)
      expect(routePaths).toContain('/step-one')
      expect(routePaths).toContain('/step-two')

      const getMethods = result.routes.filter(r => r.method === 'GET')
      const postMethods = result.routes.filter(r => r.method === 'POST')
      expect(getMethods).toHaveLength(2)
      expect(postMethods).toHaveLength(2)
    })

    it('should generate routes with journey path prefix', () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withProperty('path', '/assessment')
        .withStep(step => step.withProperty('path', '/personal-details'))
        .withStep(step => step.withProperty('path', '/contact-info'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      const routePaths = result.routes.map(r => r.path)
      expect(routePaths).toContain('/assessment/personal-details')
      expect(routePaths).toContain('/assessment/contact-info')
    })

    it('should normalize paths that dont start with /', () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withProperty('path', 'assessment')
        .withStep(step => step.withProperty('path', 'step-one'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      const routePaths = result.routes.map(r => r.path)
      expect(routePaths).toContain('/assessment/step-one')
    })

    it('should handle nested child journeys with accumulated paths', () => {
      // Create child journey
      const childJourney = ASTTestFactory.journey()
        .withProperty('code', 'child-journey')
        .withProperty('title', 'Child Journey')
        .withProperty('path', '/child')
        .withStep(step => step.withProperty('path', '/child-step'))
        .build()

      // Create parent journey with child
      const parentJourney = ASTTestFactory.journey()
        .withProperty('code', 'parent-journey')
        .withProperty('title', 'Parent Journey')
        .withProperty('path', '/parent')
        .withStep(step => step.withProperty('path', '/parent-step'))
        .withProperty('children', [childJourney])
        .build()

      const mockCompiledAst = createMockCompiledAST(parentJourney)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      const routePaths = result.routes.map(r => r.path)
      expect(routePaths).toContain('/parent/parent-step')
      expect(routePaths).toContain('/parent/child/child-step')
    })

    it('should create a route map for quick step lookups', () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withProperty('path', '/app')
        .withStep(step => step.withProperty('path', '/step-a'))
        .withStep(step => step.withProperty('path', '/step-b'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      expect(result.routeMap.has('/app/step-a')).toBe(true)
      expect(result.routeMap.has('/app/step-b')).toBe(true)

      const stepA = result.routeMap.get('/app/step-a')
      expect(stepA).toBeDefined()
      expect(stepA?.properties.get('path')).toBe('/step-a')
    })

    it('should warn about duplicate paths', () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withStep(step => step.withProperty('path', '/duplicate'))
        .withStep(step => step.withProperty('path', '/duplicate'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      generator.generateRoutes()

      expect(mockDependencies.logger.warn).toHaveBeenCalledWith('Duplicate route path detected: /duplicate')
    })

    it('should create request handlers that attach AST nodes to request', async () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withStep(step => step.withProperty('path', '/test-step'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      const getRoute = result.routes.find(r => r.method === 'GET' && r.path === '/test-step')
      expect(getRoute).toBeDefined()

      const req: any = {
        path: '/test-step',
      }
      const res: any = {
        json: jest.fn(),
      }
      const next = jest.fn()

      await getRoute!.handler(req, res, next)

      expect(req.stepNode).toBeDefined()
      expect(req.journeyNode).toBeDefined()
      expect(req.compiledAst).toBeDefined()
      expect(res.json).toHaveBeenCalled()
    })

    it('should handle errors in request handlers', async () => {
      const journey = ASTTestFactory.journey()
        .withProperty('code', 'test-journey')
        .withProperty('title', 'Test Journey')
        .withStep(step => step.withProperty('path', '/test-step'))
        .build()

      const mockCompiledAst = createMockCompiledAST(journey)
      const generator = new RouteGenerator(mockCompiledAst, mockDependencies, mockOptions)
      const result = generator.generateRoutes()

      const route = result.routes[0]
      const req: any = {
        path: '/test-step',
      }
      const res: any = {
        json: jest.fn(() => {
          throw new Error('Test error')
        }),
      }
      const next = jest.fn()

      await route.handler(req, res, next)

      expect(next).toHaveBeenCalledWith(expect.any(Error))
    })
  })
})
