import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { StepASTNode } from '@form-engine/core/types/structures.type'
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
      const field = ASTTestFactory.block('textInput', 'field')
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
      const field = ASTTestFactory.block('textInput', 'field')
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
      const block = ASTTestFactory.block('heading', 'basic')
        .withId('compile_ast:3')
        .withProperty('text', 'Welcome')
        .build()

      const originalValue = block.properties.value

      normalizer.normalize(block)

      expect(mockNodeFactory.createNode).not.toHaveBeenCalled()
      expect(block.properties.value).toBe(originalValue)
    })

    it('adds Self() even when value is undefined', () => {
      const field = ASTTestFactory.block('textInput', 'field')
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

    it('adds Self() to fields inside collection expression templates', () => {
      const templateField = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:5')
        .withCode('street')
        .withLabel('Street')
        .build()

      const collectionExpr = ASTTestFactory.expression(ExpressionType.COLLECTION)
        .withId('compile_ast:6')
        .withCollection({ type: ExpressionType.REFERENCE, path: ['answers', 'addresses'] })
        .withTemplate([templateField])
        .build()

      const step = ASTTestFactory.step()
        .withId('compile_ast:7')
        .withBlock('container', 'basic', block => block.withId('compile_ast:8').withProperty('content', collectionExpr))
        .build()

      const journey = ASTTestFactory.journey().withId('compile_ast:9').withProperty('steps', [step]).build()

      normalizer.normalize(journey)

      const steps = journey.properties.steps as StepASTNode[]
      const containerBlock = steps[0].properties.blocks[0]
      const transformedCollection = containerBlock.properties.content
      const template = transformedCollection.properties.template as any[]
      const transformedField = template[0]

      expect(mockNodeFactory.createNode).toHaveBeenCalledWith({
        type: ExpressionType.REFERENCE,
        path: ['answers', '@self'],
      })
      expect(transformedField.properties.value).toBe(mockSelfReferenceNode)
    })

    it('adds Self() to nested fields in blocks', () => {
      const nestedField1 = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:9')
        .withCode('nested1')
        .withLabel('Nested 1')
        .build()

      const nestedField2 = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:10')
        .withCode('nested2')
        .withLabel('Nested 2')
        .withProperty('value', 'has value')
        .build()

      const blockWithNestedFields = ASTTestFactory.block('group', 'basic')
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
