import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import StepHandler from './StepHandler'

describe('StepHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return step with primitive values unchanged', async () => {
      // Arrange
      const step = ASTTestFactory.step()
        .withPath('/contact-details')
        .withTitle('Contact Details')
        .withDescription('Enter your contact information')
        .withProperty('isEntryPoint', true)
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/contact-details',
          title: 'Contact Details',
          description: 'Enter your contact information',
          isEntryPoint: true,
        },
      })
    })

    it('should evaluate AST nodes in metadata', async () => {
      // Arrange
      const dynamicValue = ASTTestFactory.reference(['data', 'stepConfig', 'dynamicValue'])

      const step = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step')
        .withProperty('metadata', {
          dynamicValue,
          staticValue: 'static',
        })
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext({
        mockNodes: new Map([[dynamicValue.id, dynamicValue]]),
      })
      const mockInvoker = createMockInvoker({ defaultValue: 'Evaluated Dynamic Value' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/step',
          title: 'Step',
          metadata: {
            dynamicValue: 'Evaluated Dynamic Value',
            staticValue: 'static',
          },
        },
      })
    })

    it('should return undefined for AST nodes in metadata that fail evaluation', async () => {
      // Arrange
      const failingRef = ASTTestFactory.reference(['data', 'missing'])

      const step = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step')
        .withProperty('metadata', {
          failingValue: failingRef,
        })
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext({
        mockNodes: new Map([[failingRef.id, failingRef]]),
      })
      const mockInvoker = createMockInvokerWithError({ nodeId: failingRef.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/step',
          title: 'Step',
          metadata: {
            failingValue: undefined,
          },
        },
      })
    })

    it('should evaluate blocks array with BlockASTNode elements', async () => {
      // Arrange
      const block1 = ASTTestFactory.block('text-input', BlockType.FIELD).withCode('field1').build()
      const block2 = ASTTestFactory.block('textarea', BlockType.FIELD).withCode('field2').build()

      const step = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step')
        .withProperty('blocks', [block1, block2])
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [block1.id, block1],
          [block2.id, block2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker([
        { id: block1.id, evaluated: true, type: 'text-input' },
        { id: block2.id, evaluated: true, type: 'textarea' },
      ])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/step',
          title: 'Step',
          blocks: [
            { id: block1.id, evaluated: true, type: 'text-input' },
            { id: block2.id, evaluated: true, type: 'textarea' },
          ],
        },
      })
    })

    it('should evaluate nested objects with AST nodes in metadata', async () => {
      // Arrange
      const titleRef = ASTTestFactory.reference(['data', 'config', 'title'])
      const descRef = ASTTestFactory.reference(['data', 'config', 'description'])

      const step = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step')
        .withProperty('metadata', {
          config: {
            title: titleRef,
            description: descRef,
            static: 'value',
          },
        })
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [titleRef.id, titleRef],
          [descRef.id, descRef],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['Dynamic Title', 'Dynamic Description'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/step',
          title: 'Step',
          metadata: {
            config: {
              title: 'Dynamic Title',
              description: 'Dynamic Description',
              static: 'value',
            },
          },
        },
      })
    })

    it('should evaluate arrays of objects with AST nodes in metadata', async () => {
      // Arrange
      const value1Ref = ASTTestFactory.reference(['data', 'items', '0'])
      const value2Ref = ASTTestFactory.reference(['data', 'items', '1'])

      const step = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step')
        .withProperty('metadata', {
          items: [
            { value: value1Ref, label: 'Item 1' },
            { value: value2Ref, label: 'Item 2' },
          ],
        })
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [value1Ref.id, value1Ref],
          [value2Ref.id, value2Ref],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['value-1', 'value-2'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/step',
          title: 'Step',
          metadata: {
            items: [
              { value: 'value-1', label: 'Item 1' },
              { value: 'value-2', label: 'Item 2' },
            ],
          },
        },
      })
    })

    it('should handle null and undefined values in deeply nested metadata', async () => {
      // Arrange
      const step = ASTTestFactory.step()
        .withPath('/step')
        .withTitle('Step')
        .withDescription(undefined as any)
        .withProperty('metadata', {
          nullValue: null,
          undefinedValue: undefined,
          nested: {
            nullValue: null,
            undefinedValue: undefined,
          },
        })
        .build()

      const handler = new StepHandler(step.id, step)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: step.id,
        type: ASTNodeType.STEP,
        properties: {
          path: '/step',
          title: 'Step',
          description: undefined,
          metadata: {
            nullValue: null,
            undefinedValue: undefined,
            nested: {
              nullValue: null,
              undefinedValue: undefined,
            },
          },
        },
      })
    })
  })
})
