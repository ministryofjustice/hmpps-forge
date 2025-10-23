import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { attachParentNodes } from './AttachParentNodes'

describe('attachParentNodes', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  it('sets parentNode on direct children', () => {
    const validation = ASTTestFactory.expression(ExpressionType.VALIDATION).build()

    const journey = ASTTestFactory.journey()
      .withStep(step =>
        step.withBlock('TextInput', 'field', block => block.withCode('firstName').withValidation(validation)),
      )
      .build()

    attachParentNodes(journey)

    const step = journey.properties.get('steps')[0]
    const block = step.properties.get('blocks')[0]

    expect(step.parentNode).toBe(journey)
    expect(block.parentNode).toBe(step)
    expect(validation.parentNode).toBe(block)
    expect(journey.parentNode).toBeUndefined()
  })

  it('updates nested expressions', () => {
    const nestedExpression = ASTTestFactory.expression(ExpressionType.VALIDATION).build()
    const parentExpression = ASTTestFactory.expression(ExpressionType.PIPELINE)
      .withProperty('child', nestedExpression)
      .build()

    const journey = ASTTestFactory.journey()
      .withStep(step => step.withBlock('TextInput', 'field', block => block.withShowWhen(parentExpression)))
      .build()

    attachParentNodes(journey)

    const block = journey.properties.get('steps')[0].properties.get('blocks')[0]

    expect(parentExpression.parentNode).toBe(block)
    expect(nestedExpression.parentNode).toBe(parentExpression)
  })
})
