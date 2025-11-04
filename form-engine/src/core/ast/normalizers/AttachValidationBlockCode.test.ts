import { ExpressionType, LogicType } from '@form-engine/form/types/enums'
import { isExpressionNode } from '@form-engine/core/typeguards/expression-nodes'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { createCompileStageContainer } from '@form-engine/core/container/compileStageContainer'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'
import { AttachValidationBlockCodeNormalizer } from './AttachValidationBlockCode'

describe('attachValidationBlockCode', () => {
  let normalizer: AttachValidationBlockCodeNormalizer

  beforeEach(() => {
    ASTTestFactory.resetIds()
    const container = createCompileStageContainer(new FunctionRegistry(), new ComponentRegistry())
    normalizer = container.normalizers.attachValidationBlockCode
  })

  const buildValidation = () =>
    ASTTestFactory.expression(ExpressionType.VALIDATION)
      .withProperty('when', ASTTestFactory.expression(LogicType.TEST).build())
      .withProperty('message', 'Required field')
      .build()

  it('attaches static block code to validation expressions', () => {
    const journey = ASTTestFactory.journey().withStep(step =>
      step.withBlock('TextInput', 'field', block => block.withCode('nickname').withValidation(buildValidation())),
    )

    const ast = journey.build()

    normalizer.normalize(ast)

    const steps = ast.properties.get('steps')
    const block = steps[0].properties.get('blocks')[0]
    const validation = block.properties.get('validate')

    expect(validation.properties.get('resolvedBlockCode')).toBe('nickname')
  })

  it('attaches cloned dynamic code expressions to validation nodes', () => {
    const dynamicCode = ASTTestFactory.reference(['answers', 'dynamicCode'])

    const journey = ASTTestFactory.journey().withStep(step =>
      step.withBlock('TextInput', 'field', block => block.withCode(dynamicCode).withValidation(buildValidation())),
    )

    const ast = journey.build()

    normalizer.normalize(ast)

    const steps = ast.properties.get('steps')
    const block = steps[0].properties.get('blocks')[0]
    const validation = block.properties.get('validate')

    const resolved = validation.properties.get('resolvedBlockCode')

    expect(isExpressionNode(resolved)).toBe(true)
    expect(resolved).not.toBe(dynamicCode)
    expect(resolved.properties.get('path')).toEqual(['answers', 'dynamicCode'])
  })

  it('omits resolved block code when block has no code', () => {
    const journey = ASTTestFactory.journey().withStep(step =>
      step.withBlock('Html', 'basic', block => block.withValidation(buildValidation())),
    )

    const ast = journey.build()

    normalizer.normalize(ast)

    const steps = ast.properties.get('steps')
    const block = steps[0].properties.get('blocks')[0]
    const validation = block.properties.get('validate')

    expect(validation.properties.has('resolvedBlockCode')).toBe(false)
  })
})
