import { BlockType, ExpressionType, IteratorType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { AddSelfValueToFieldsNormalizer } from './AddSelfValueToFields'

describe('AddSelfValueToFields', () => {
  let normalizer: AddSelfValueToFieldsNormalizer
  let mockNodeFactory: jest.Mocked<NodeFactory>
  let mockSelfReferenceNode: ASTNode

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockSelfReferenceNode = { type: 'mock-self-reference' } as unknown as ASTNode

    // Mock NodeFactory
    mockNodeFactory = {
      createNode: jest.fn().mockReturnValue(mockSelfReferenceNode),
    } as unknown as jest.Mocked<NodeFactory>

    normalizer = new AddSelfValueToFieldsNormalizer(mockNodeFactory)
  })

  describe('normalize()', () => {
    it('adds Self() reference to fields without explicit value', () => {
      const field = ASTTestFactory.block('textInput', BlockType.FIELD)
        .withId('compile_ast:1')
        .withCode('username')
        .withLabel('Username')
        .build()

      normalizer.normalize(field)

      expect(mockNodeFactory.createNode).toHaveBeenCalledWith({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      })
      expect(field.properties.value).toBe(mockSelfReferenceNode)
    })

    it('overrides existing value with Self() reference', () => {
      const explicitValue = 'preset value'
      const field = ASTTestFactory.block('textInput', BlockType.FIELD)
        .withId('compile_ast:2')
        .withCode('username')
        .withLabel('Username')
        .withProperty('value', explicitValue)
        .build()

      normalizer.normalize(field)

      expect(mockNodeFactory.createNode).toHaveBeenCalledWith({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      })
      expect(field.properties.value).toBe(mockSelfReferenceNode)
    })

    it('does not create Self() reference for blocks without code (non-fields)', () => {
      const block = ASTTestFactory.block('heading', BlockType.BASIC)
        .withId('compile_ast:3')
        .withProperty('text', 'Welcome')
        .build()

      const originalValue = block.properties.value

      normalizer.normalize(block)

      expect(mockNodeFactory.createNode).not.toHaveBeenCalled()
      expect(block.properties.value).toBe(originalValue)
    })

    it('adds Self() even when value is undefined', () => {
      const field = ASTTestFactory.block('textInput', BlockType.FIELD)
        .withId('compile_ast:4')
        .withCode('username')
        .withLabel('Username')
        .withProperty('value', undefined)
        .build()

      normalizer.normalize(field)

      expect(mockNodeFactory.createNode).toHaveBeenCalledWith({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      })
      expect(field.properties.value).toBe(mockSelfReferenceNode)
    })

    it('adds Self() to fields inside iterate expression yield templates', () => {
      // Arrange
      const templateField = ASTTestFactory.block('textInput', BlockType.FIELD)
        .withId('compile_ast:5')
        .withCode('street')
        .withLabel('Street')
        .build()

      const iterateExpr = ASTTestFactory.expression(ExpressionType.ITERATE)
        .withId('compile_ast:6')
        .withProperty('input', { type: ExpressionType.REFERENCE, path: ['answers', 'addresses'] })
        .withProperty('iterator', {
          type: IteratorType.MAP,
          yield: [templateField],
        })
        .build()

      const step = ASTTestFactory.step()
        .withId('compile_ast:7')
        .withBlock('container', BlockType.BASIC, block =>
          block.withId('compile_ast:8').withProperty('content', iterateExpr),
        )
        .build()

      const journey = ASTTestFactory.journey().withId('compile_ast:9').withProperty('steps', [step]).build()

      // Act
      normalizer.normalize(journey)

      // Assert
      const containerBlock = journey.properties.steps[0].properties.blocks[0]
      const transformedIterate = containerBlock.properties.content
      const yieldTemplate = transformedIterate.properties.iterator.yield as any[]
      const transformedField = yieldTemplate[0]

      expect(mockNodeFactory.createNode).toHaveBeenCalledWith({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      })
      expect(transformedField.properties.value).toBe(mockSelfReferenceNode)
    })

    it('adds Self() to nested fields in blocks', () => {
      const nestedField1 = ASTTestFactory.block('textInput', BlockType.FIELD)
        .withId('compile_ast:9')
        .withCode('nested1')
        .withLabel('Nested 1')
        .build()

      const nestedField2 = ASTTestFactory.block('textInput', BlockType.FIELD)
        .withId('compile_ast:10')
        .withCode('nested2')
        .withLabel('Nested 2')
        .withProperty('value', 'has value')
        .build()

      const blockWithNestedFields = ASTTestFactory.block('group', BlockType.BASIC)
        .withId('compile_ast:11')
        .withProperty('blocks', [nestedField1, nestedField2])
        .build()

      const step = ASTTestFactory.step()
        .withId('compile_ast:12')
        .withProperty('blocks', [blockWithNestedFields])
        .build()

      normalizer.normalize(step)

      const blocks = step.properties.blocks[0].properties.blocks

      expect(mockNodeFactory.createNode).toHaveBeenCalledTimes(2)
      expect(mockNodeFactory.createNode).toHaveBeenCalledWith({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      })
      expect(blocks[0].properties.value).toBe(mockSelfReferenceNode)
      expect(blocks[1].properties.value).toBe(mockSelfReferenceNode)
    })
  })
})
