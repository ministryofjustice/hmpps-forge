import { ExpressionType } from '@form-engine/form/types/enums'
import { isExpressionNode } from '@form-engine/core/typeguards/expression-nodes'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { addSelfValueToFields } from './AddSelfValueToFields'

describe('AddSelfValueToFields', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('addSelfValueToFields', () => {
    it('adds Self() reference to fields without explicit value', () => {
      const field = ASTTestFactory.block('textInput', 'field')
        .withId(1)
        .withCode('username')
        .withLabel('Username')
        .build()

      addSelfValueToFields(field)

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
        .withId(2)
        .withCode('username')
        .withLabel('Username')
        .withProperty('value', explicitValue)
        .build()

      addSelfValueToFields(field)

      const value = field.properties.get('value')
      expect(isExpressionNode(value)).toBe(true)
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
    })

    it('ignores blocks without code (non-fields)', () => {
      const block = ASTTestFactory.block('heading', 'basic').withId(3).withProperty('text', 'Welcome').build()

      const originalValue = block.properties.get('value')
      addSelfValueToFields(block)

      expect(block.properties.get('value')).toBe(originalValue)
    })

    it('adds Self() even when value is undefined', () => {
      const field = ASTTestFactory.block('textInput', 'field')
        .withId(4)
        .withCode('username')
        .withLabel('Username')
        .withProperty('value', undefined)
        .build()

      addSelfValueToFields(field)

      const value = field.properties.get('value')
      expect(isExpressionNode(value)).toBe(true)
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
    })

    it('processes blocks within collection templates', () => {
      const itemTemplate = ASTTestFactory.block('textInput', 'field')
        .withId(5)
        .withCode('street')
        .withLabel('Street')
        .build()

      const collectionBlock = ASTTestFactory.block('collection', 'collection')
        .withId(6)
        .withCode('addresses')
        .withProperty('itemTemplate', itemTemplate)
        .build()

      const step = ASTTestFactory.step().withId(7).withProperty('blocks', [collectionBlock]).build()

      const journey = ASTTestFactory.journey().withId(8).withProperty('steps', [step]).build()

      addSelfValueToFields(journey)

      const steps = journey.properties.get('steps')
      const blocks = steps[0].properties.get('blocks')
      const template = blocks[0].properties.get('itemTemplate')

      // Item template field should have Self() added
      const value = template.properties.get('value')
      expect(isExpressionNode(value)).toBe(true)
      expect(value.properties.get('path')).toEqual(['answers', '@self'])
    })

    it('handles nested fields in composite blocks', () => {
      const nestedField1 = ASTTestFactory.block('textInput', 'field')
        .withId(9)
        .withCode('nested1')
        .withLabel('Nested 1')
        .build()

      const nestedField2 = ASTTestFactory.block('textInput', 'field')
        .withId(10)
        .withCode('nested2')
        .withLabel('Nested 2')
        .withProperty('value', 'has value')
        .build()

      const compositeBlock = ASTTestFactory.block('group', 'composite')
        .withId(11)
        .withProperty('blocks', [nestedField1, nestedField2])
        .build()

      const step = ASTTestFactory.step().withId(12).withProperty('blocks', [compositeBlock]).build()

      addSelfValueToFields(step)

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
