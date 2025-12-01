import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import JourneyHandler from './JourneyHandler'

describe('JourneyHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return journey with primitive values unchanged', async () => {
      // Arrange
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle('Food Business Registration')
        .withProperty('description', 'Register your food business')
        .withProperty('version', '1.0.0')
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Food Business Registration',
          description: 'Register your food business',
          version: '1.0.0',
        },
      })
    })

    it('should evaluate AST nodes and include their values for AST node properties', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'businessName'])
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle(referenceNode as any)
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext({
        mockNodes: new Map([[referenceNode.id, referenceNode]]),
      })
      const mockInvoker = createMockInvoker({ defaultValue: 'Dynamic Journey Title' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Dynamic Journey Title',
        },
      })
    })

    it('should return undefined for AST nodes that fail evaluation', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'missing'])
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle(referenceNode as any)
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext({
        mockNodes: new Map([[referenceNode.id, referenceNode]]),
      })
      const mockInvoker = createMockInvoker({
        invokeImpl: async () => ({
          error: {
            type: 'EVALUATION_FAILED',
            nodeId: referenceNode.id,
            message: 'Evaluation failed',
          },
          metadata: { source: 'test', timestamp: Date.now() },
        }),
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: undefined,
        },
      })
    })

    it('should evaluate arrays with AST nodes', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'step1'])
      const ref2 = ASTTestFactory.reference(['data', 'step2'])
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle('Food Business Registration')
        .withProperty('steps', [ref1, ref2])
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker([
        { id: 'step-1', type: ASTNodeType.STEP },
        { id: 'step-2', type: ASTNodeType.STEP },
      ])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Food Business Registration',
          steps: [
            { id: 'step-1', type: ASTNodeType.STEP },
            { id: 'step-2', type: ASTNodeType.STEP },
          ],
        },
      })
    })

    it('should handle empty arrays in array properties', async () => {
      // Arrange
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle('Food Business Registration')
        .withProperty('steps', [])
        .withProperty('children', [])
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Food Business Registration',
          steps: [],
          children: [],
        },
      })
    })

    it('should evaluate objects with AST nodes in nested object properties', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'author'])
      const ref2 = ASTTestFactory.reference(['data', 'createdDate'])
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle('Food Business Registration')
        .withMetadata({
          author: ref1,
          createdDate: ref2,
          static: 'value',
        })
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['John Doe', '2025-01-01'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Food Business Registration',
          metadata: {
            author: 'John Doe',
            createdDate: '2025-01-01',
            static: 'value',
          },
        },
      })
    })

    it('should evaluate arrays of objects with AST nodes in deeply nested structures', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'transition1'])
      const ref2 = ASTTestFactory.reference(['data', 'transition2'])
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle('Food Business Registration')
        .withProperty('onLoad', [
          { action: ref1, priority: 1 },
          { action: ref2, priority: 2 },
          { action: 'static-action', priority: 3 },
        ])
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['transition-1', 'transition-2'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Food Business Registration',
          onLoad: [
            { action: 'transition-1', priority: 1 },
            { action: 'transition-2', priority: 2 },
            { action: 'static-action', priority: 3 },
          ],
        },
      })
    })

    it('should handle null and undefined values in deeply nested structures', async () => {
      // Arrange
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle('Food Business Registration')
        .withProperty('description', null)
        .withProperty('version', undefined)
        .withMetadata({
          nullValue: null,
          undefinedValue: undefined,
        })
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Food Business Registration',
          description: null,
          version: undefined,
          metadata: {
            nullValue: null,
            undefinedValue: undefined,
          },
        },
      })
    })

    it('should evaluate complex nested structures with multiple levels of nesting', async () => {
      // Arrange
      const titleRef = ASTTestFactory.reference(['data', 'journeyTitle'])
      const stepRef = ASTTestFactory.reference(['data', 'stepData'])
      const childRef = ASTTestFactory.reference(['data', 'childJourney'])
      const journey = ASTTestFactory.journey()
        .withProperty('path', '/food-business')
        .withCode('food-business-registration')
        .withTitle(titleRef as any)
        .withProperty('steps', [stepRef])
        .withProperty('children', [childRef])
        .withMetadata({
          nested: {
            deeply: {
              value: 'static',
            },
          },
        })
        .build()
      const handler = new JourneyHandler(journey.id, journey)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [titleRef.id, titleRef],
          [stepRef.id, stepRef],
          [childRef.id, childRef],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker([
        'Dynamic Journey',
        { id: 'step-1', path: '/step-1' },
        { id: 'child-journey-1', path: '/child' },
      ])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: journey.id,
        type: ASTNodeType.JOURNEY,
        properties: {
          path: '/food-business',
          code: 'food-business-registration',
          title: 'Dynamic Journey',
          steps: [{ id: 'step-1', path: '/step-1' }],
          children: [{ id: 'child-journey-1', path: '/child' }],
          metadata: {
            nested: {
              deeply: {
                value: 'static',
              },
            },
          },
        },
      })
    })
  })
})
