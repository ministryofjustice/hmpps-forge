import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType, ExpressionType, FunctionType, PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import {
  createMockContext,
  createMockInvoker,
  createMockInvokerWithError,
  createSequentialMockInvoker,
} from '@form-engine/test-utils/thunkTestHelpers'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { ASTNode, NodeId } from '@form-engine/core/types/engine.type'
import BlockHandler from './BlockHandler'

describe('BlockHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return block with primitive values unchanged', async () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('firstName')
        .withLabel('First name')
        .withProperty('required', true)
        .withProperty('maxLength', 50)
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'firstName',
          label: 'First name',
          required: true,
          maxLength: 50,
        },
      })
    })

    it('should evaluate AST nodes and include their values in properties', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'user', 'name'])
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('userName')
        .withProperty('defaultValue', referenceNode)
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map([[referenceNode.id, referenceNode]]),
      })
      const mockInvoker = createMockInvoker({ defaultValue: 'John Doe' })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'userName',
          defaultValue: 'John Doe',
        },
      })
    })

    it('should return undefined for AST node properties that fail evaluation', async () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'missing'])
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('userName')
        .withProperty('defaultValue', referenceNode)
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map([[referenceNode.id, referenceNode]]),
      })
      const mockInvoker = createMockInvokerWithError({ nodeId: referenceNode.id })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'userName',
          defaultValue: undefined,
        },
      })
    })

    it('should evaluate arrays containing AST nodes', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'value1'])
      const ref2 = ASTTestFactory.reference(['data', 'value2'])
      const block = ASTTestFactory.block('checkboxes', BlockType.FIELD)
        .withCode('choices')
        .withProperty('options', [ref1, 'static-option', ref2])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['Option 1', 'Option 2'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'checkboxes',
        blockType: BlockType.FIELD,
        properties: {
          code: 'choices',
          options: ['Option 1', 'static-option', 'Option 2'],
        },
      })
    })

    it('should preserve arrays of primitives unchanged', async () => {
      // Arrange
      const block = ASTTestFactory.block('checkboxes', BlockType.FIELD)
        .withCode('choices')
        .withProperty('options', ['Option 1', 'Option 2', 'Option 3'])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'checkboxes',
        blockType: BlockType.FIELD,
        properties: {
          code: 'choices',
          options: ['Option 1', 'Option 2', 'Option 3'],
        },
      })
    })

    it('should evaluate objects containing AST nodes', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'title'])
      const ref2 = ASTTestFactory.reference(['data', 'description'])
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('field')
        .withProperty('metadata', {
          title: ref1,
          description: ref2,
          static: 'value',
        })
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['Dynamic Title', 'Dynamic Description'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'field',
          metadata: {
            title: 'Dynamic Title',
            description: 'Dynamic Description',
            static: 'value',
          },
        },
      })
    })

    it('should evaluate arrays of objects containing AST nodes', async () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['data', 'label1'])
      const ref2 = ASTTestFactory.reference(['data', 'label2'])
      const block = ASTTestFactory.block('radios', BlockType.FIELD)
        .withCode('choice')
        .withProperty('options', [
          { label: ref1, value: 'value1' },
          { label: ref2, value: 'value2' },
          { label: 'Static Label', value: 'value3' },
        ])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map([
          [ref1.id, ref1],
          [ref2.id, ref2],
        ]),
      })
      const mockInvoker = createSequentialMockInvoker(['Label 1', 'Label 2'])

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'radios',
        blockType: BlockType.FIELD,
        properties: {
          code: 'choice',
          options: [
            { label: 'Label 1', value: 'value1' },
            { label: 'Label 2', value: 'value2' },
            { label: 'Static Label', value: 'value3' },
          ],
        },
      })
    })

    it('should handle null and undefined values in nested structures', async () => {
      // Arrange
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('field')
        .withProperty('defaultValue', null)
        .withProperty('optional', undefined)
        .withProperty('nested', {
          nullValue: null,
          undefinedValue: undefined,
        })
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext()
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect(result.value).toEqual({
        id: block.id,
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: BlockType.FIELD,
        properties: {
          code: 'field',
          defaultValue: null,
          optional: undefined,
          nested: {
            nullValue: null,
            undefinedValue: undefined,
          },
        },
      })
    })

    it('should skip validation when dependent property evaluates to false', async () => {
      // Arrange
      const dependentNode = ASTTestFactory.reference(['answers', 'businessType'])
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validationNode = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Enter your typical trading hours')
        .build()
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('tradingHours')
        .withProperty('dependent', dependentNode)
        .withProperty('validate', [validationNode])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode>([
          [dependentNode.id, dependentNode],
          [predicateNode.id, predicateNode],
          [validationNode.id, validationNode],
        ]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[dependentNode.id, false]]),
        defaultValue: { passed: false, message: 'This should not be evaluated' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect((result.value as FieldBlockASTNode).properties.dependent).toBe(false)
      expect((result.value as FieldBlockASTNode).properties.validate).toEqual([])
    })

    it('should evaluate validation when dependent property evaluates to true', async () => {
      // Arrange
      const dependentNode = ASTTestFactory.reference(['answers', 'businessType'])
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validationNode = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Enter your typical trading hours')
        .build()
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('tradingHours')
        .withProperty('dependent', dependentNode)
        .withProperty('validate', [validationNode])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode>([
          [dependentNode.id, dependentNode],
          [predicateNode.id, predicateNode],
          [validationNode.id, validationNode],
        ]),
      })
      const mockInvoker = createMockInvoker({
        returnValueMap: new Map([[dependentNode.id, true]]),
        defaultValue: { passed: false, message: 'Enter your typical trading hours' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect((result.value as FieldBlockASTNode).properties.dependent).toBe(true)
      expect((result.value as FieldBlockASTNode).properties.validate).toEqual([
        { passed: false, message: 'Enter your typical trading hours' },
      ])
    })

    it('should evaluate validation when dependent property does not exist', async () => {
      // Arrange
      const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)
      const validationNode = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withProperty('when', predicateNode)
        .withProperty('message', 'Select the type of food business')
        .build()
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('businessType')
        .withProperty('validate', [validationNode])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map<NodeId, ASTNode>([
          [predicateNode.id, predicateNode],
          [validationNode.id, validationNode],
        ]),
      })
      const mockInvoker = createMockInvoker({
        defaultValue: { passed: false, message: 'Select the type of food business' },
      })

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      expect((result.value as FieldBlockASTNode).properties.dependent).toBeUndefined()
      expect((result.value as FieldBlockASTNode).properties.validate).toEqual([
        { passed: false, message: 'Select the type of food business' },
      ])
    })

    it('should pass formatters through without evaluating AST nodes', async () => {
      // Arrange
      const formatterNode = ASTTestFactory.expression(FunctionType.TRANSFORMER).build()
      const block = ASTTestFactory.block('text-input', BlockType.FIELD)
        .withCode('email')
        .withLabel('Email address')
        .withProperty('formatters', [formatterNode])
        .build()
      const handler = new BlockHandler(block.id, block)
      const mockContext = createMockContext({
        mockNodes: new Map([[formatterNode.id, formatterNode]]),
      })
      const mockInvoker = createMockInvoker()

      // Act
      const result = await handler.evaluate(mockContext, mockInvoker)

      // Assert
      // Formatters should be passed through as-is, not evaluated
      expect((result.value as FieldBlockASTNode).properties.formatters).toEqual([formatterNode])
      // The formatter node should NOT have been invoked
      expect(mockInvoker.invoke).not.toHaveBeenCalledWith(formatterNode.id, expect.anything(), expect.anything())
    })
  })
})
