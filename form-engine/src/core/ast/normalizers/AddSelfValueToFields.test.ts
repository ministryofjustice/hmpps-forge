import { ExpressionType } from '@form-engine/form/types/enums'
import { isExpressionNode } from '@form-engine/core/typeguards/expression-nodes'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { createCompileStageContainer } from '@form-engine/core/container/compileStageContainer'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { AddSelfValueToFieldsNormalizer } from './AddSelfValueToFields'

describe('AddSelfValueToFields', () => {
  let normalizer: AddSelfValueToFieldsNormalizer

  beforeEach(() => {
    ASTTestFactory.resetIds()
    const container = createCompileStageContainer(new FunctionRegistry(), new ComponentRegistry())
    normalizer = container.normalizers.addSelfValue
  })

  describe('addSelfValueToFields', () => {
    it('adds Self() reference to fields without explicit value', () => {
      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:1')
        .withCode('username')
        .withLabel('Username')
        .build()

      normalizer.normalize(field)

      const value = field.properties.get('value')
      expect(isExpressionNode(value)).toBe(true)
      expect(value).toMatchObject({
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.REFERENCE,
      })
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
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

      const value = field.properties.get('value')
      expect(isExpressionNode(value)).toBe(true)
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
    })

    it('ignores blocks without code (non-fields)', () => {
      const block = ASTTestFactory.block('heading', 'basic')
        .withId('compile_ast:3')
        .withProperty('text', 'Welcome')
        .build()

      const originalValue = block.properties.get('value')
      normalizer.normalize(block)

      expect(block.properties.get('value')).toBe(originalValue)
    })

    it('adds Self() even when value is undefined', () => {
      const field = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:4')
        .withCode('username')
        .withLabel('Username')
        .withProperty('value', undefined)
        .build()

      normalizer.normalize(field)

      const value = field.properties.get('value')
      expect(isExpressionNode(value)).toBe(true)
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
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

      const steps = journey.properties.get('steps') as any[]
      const containerBlock = steps[0].properties.get('blocks')[0]
      const transformedCollection = containerBlock.properties.get('content')
      const template = transformedCollection.properties.get('template') as any[]
      const transformedField = template[0]
      const value = transformedField.properties.get('value')

      expect(isExpressionNode(value)).toBe(true)
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
    })

    it('handles nested fields in blocks', () => {
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

      const blocks = step.properties.get('blocks')[0].properties.get('blocks')

      // First nested field should have Self() added
      const field1Value = blocks[0].properties.get('value')
      expect(isExpressionNode(field1Value)).toBe(true)
      expect(field1Value.properties.get('path')).toEqual(['answers', '@self'])

      // Second nested field should also have Self() added (overriding existing value)
      const field2Value = blocks[1].properties.get('value')
      expect(isExpressionNode(field2Value)).toBe(true)
      expect(field2Value.properties.get('path')).toEqual(['answers', '@self'])
    })
  })
})
