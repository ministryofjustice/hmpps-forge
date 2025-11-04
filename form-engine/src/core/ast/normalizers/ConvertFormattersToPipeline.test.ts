import { ConvertFormattersToPipelineNormalizer } from '@form-engine/core/ast/normalizers/ConvertFormattersToPipeline'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { FunctionType, ExpressionType } from '@form-engine/form/types/enums'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { PipelineASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { isPipelineExprNode, isReferenceExprNode } from '@form-engine/core/typeguards/expression-nodes'
import { isTransformerFunctionNode } from '@form-engine/core/typeguards/function-nodes'
import { createCompileStageContainer } from '@form-engine/core/container/compileStageContainer'
import FunctionRegistry from '@form-engine/registry/FunctionRegistry'
import ComponentRegistry from '@form-engine/registry/ComponentRegistry'

describe('convertFormattersToPipeline', () => {
  let normalizer: ConvertFormattersToPipelineNormalizer

  beforeEach(() => {
    const container = createCompileStageContainer(new FunctionRegistry(), new ComponentRegistry())
    normalizer = container.normalizers.convertFormatters
  })

  it('converts single formatter to pipeline with POST reference', () => {
    const formatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:1')
      .withCode('myField')
      .withProperty('formatters', [formatter])
      .build()

    normalizer.normalize(field)

    const formatPipeline = field.properties.get('formatPipeline') as PipelineASTNode
    expect(isPipelineExprNode(formatPipeline)).toBe(true)

    // Check input is POST reference
    const input = formatPipeline.properties.get('input') as ReferenceASTNode
    expect(isReferenceExprNode(input)).toBe(true)
    expect(input.properties.get('path')).toEqual(['post', 'myField'])

    // Check steps
    const steps = formatPipeline.properties.get('steps') as any[]

    expect(steps).toHaveLength(1)
    expect(steps[0]).toBe(formatter) // Now uses formatters directly
    expect(isTransformerFunctionNode(steps[0])).toBe(true)

    const stepProps = steps[0].properties as Map<string, unknown>
    expect(stepProps).toBe(formatter.properties) // Same reference since we use formatters directly
    expect(stepProps.get('name')).toBe('trim')
    expect(stepProps.get('arguments')).toEqual([])

    // Formatters property should be removed
    expect(field.properties.has('formatters')).toBe(false)
  })

  it('converts multiple formatters to pipeline steps in order', () => {
    const formatter1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
    const formatter2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toUpperCase')
    const formatter3 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'removeSpaces')

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:2')
      .withCode('userInput')
      .withProperty('formatters', [formatter1, formatter2, formatter3])
      .build()

    normalizer.normalize(field)

    const formatPipeline = field.properties.get('formatPipeline') as PipelineASTNode
    const steps = formatPipeline.properties.get('steps') as any[]

    expect(steps).toHaveLength(3)
    expect(stepName(steps[0])).toBe('trim')
    expect(stepName(steps[1])).toBe('toUpperCase')
    expect(stepName(steps[2])).toBe('removeSpaces')
  })

  it('preserves formatter arguments in pipeline steps', () => {
    const formatter1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'substring', [0, 10])
    const formatter2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'padEnd', [20, '.'])

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:3')
      .withCode('limitedText')
      .withProperty('formatters', [formatter1, formatter2])
      .build()

    normalizer.normalize(field)

    const formatPipeline = field.properties.get('formatPipeline') as PipelineASTNode
    const steps = formatPipeline.properties.get('steps') as any[]

    expect(stepArgs(steps[0])).toEqual([0, 10])
    expect(stepArgs(steps[1])).toEqual([20, '.'])
  })

  it('handles formatters with complex argument expressions', () => {
    const refArg = ASTTestFactory.reference(['data', 'maxLength'])
    const formatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'truncate', [refArg, '...'])

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:4')
      .withCode('description')
      .withProperty('formatters', [formatter])
      .build()

    normalizer.normalize(field)

    const formatPipeline = field.properties.get('formatPipeline') as PipelineASTNode
    const steps = formatPipeline.properties.get('steps') as any[]

    expect(stepName(steps[0])).toBe('truncate')
    const args = stepArgs(steps[0])
    expect(args).toHaveLength(2)
    expect(args[0]).toBe(refArg)
    expect(args[1]).toBe('...')
  })

  it('does not modify fields without formatters', () => {
    const field = ASTTestFactory.block('TextInput', 'field').withId('compile_ast:5').withCode('plainField').build()

    const originalProps = new Map(field.properties)
    normalizer.normalize(field)

    expect(field.properties.has('formatPipeline')).toBe(false)
    expect(field.properties).toEqual(originalProps)
  })

  it('does not modify fields with empty formatters array', () => {
    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:6')
      .withCode('emptyFormatters')
      .withProperty('formatters', [])
      .build()

    normalizer.normalize(field)

    expect(field.properties.has('formatPipeline')).toBe(false)
  })

  it('processes multiple fields in a journey', () => {
    const formatter1 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')
    const formatter2 = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'toUpperCase')

    const field1 = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:7')
      .withCode('field1')
      .withProperty('formatters', [formatter1])
      .build()

    const field2 = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:8')
      .withCode('field2')
      .withProperty('formatters', [formatter2])
      .build()

    const field3 = ASTTestFactory.block('TextInput', 'field').withId('compile_ast:9').withCode('field3').build()

    const step = ASTTestFactory.step().withId('compile_ast:10').withProperty('blocks', [field1, field2, field3]).build()

    const journey = ASTTestFactory.journey().withId('compile_ast:11').withProperty('steps', [step]).build()

    normalizer.normalize(journey)

    // Check field1
    const pipeline1 = field1.properties.get('formatPipeline') as PipelineASTNode
    expect(isPipelineExprNode(pipeline1)).toBe(true)
    const input1 = pipeline1.properties.get('input') as ReferenceASTNode
    expect(input1.properties.get('path')).toEqual(['post', 'field1'])

    // Check field2
    const pipeline2 = field2.properties.get('formatPipeline') as PipelineASTNode
    expect(isPipelineExprNode(pipeline2)).toBe(true)
    const input2 = pipeline2.properties.get('input') as ReferenceASTNode
    expect(input2.properties.get('path')).toEqual(['post', 'field2'])

    // Check field3 has no pipeline
    expect(field3.properties.has('formatPipeline')).toBe(false)
  })

  it('throws when field with formatters has no code', () => {
    const formatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:12')
      .withProperty('formatters', [formatter])
      .build()

    expect(() => normalizer.normalize(field)).toThrow(InvalidNodeError)

    try {
      normalizer.normalize(field)
    } catch (e) {
      const err = e as InvalidNodeError
      expect(err.message).toMatch(/Field with formatters must have a code property/)
    }
  })

  it('handles fields with dynamic code expressions', () => {
    const formatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')

    const codeExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
      .withId('compile_ast:13')
      .withProperty('text', 'address_%1')
      .withProperty('args', [ASTTestFactory.reference(['@scope', '@index'])])
      .build()

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:14')
      .withCode(codeExpr)
      .withProperty('formatters', [formatter])
      .build()

    normalizer.normalize(field)

    const formatPipeline = field.properties.get('formatPipeline') as PipelineASTNode
    expect(isPipelineExprNode(formatPipeline)).toBe(true)

    // Check input is POST reference with the expression as the path segment
    const input = formatPipeline.properties.get('input') as ReferenceASTNode
    expect(isReferenceExprNode(input)).toBe(true)
    const path = input.properties.get('path') as any[]
    expect(path[0]).toBe('post')
    expect(path[1]).toBe(codeExpr) // The expression node itself is used

    // Check steps
    const steps = formatPipeline.properties.get('steps') as any[]
    expect(steps).toHaveLength(1)
    expect(stepName(steps[0])).toBe('trim')
    expect(stepArgs(steps[0])).toEqual([])
  })

  it('converts formatters for fields inside collection expression templates', () => {
    const formatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')

    const templateField = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:21')
      .withCode('itemField')
      .withProperty('formatters', [formatter])
      .build()

    const collectionExpr = ASTTestFactory.expression(ExpressionType.COLLECTION)
      .withId('compile_ast:22')
      .withCollection({ type: ExpressionType.REFERENCE, path: ['answers', 'items'] })
      .withTemplate([templateField])
      .build()

    const step = ASTTestFactory.step()
      .withId('compile_ast:23')
      .withBlock('container', 'basic', block => block.withId('compile_ast:24').withProperty('content', collectionExpr))
      .build()

    const journey = ASTTestFactory.journey().withId('compile_ast:25').withProperty('steps', [step]).build()

    normalizer.normalize(journey)

    const steps = journey.properties.get('steps') as any[]
    const containerBlock = steps[0].properties.get('blocks')[0]
    const transformedCollection = containerBlock.properties.get('content')
    const template = transformedCollection.properties.get('template') as any[]
    const transformedField = template[0]
    const pipeline = transformedField.properties.get('formatPipeline') as PipelineASTNode

    expect(isPipelineExprNode(pipeline)).toBe(true)
    const input = pipeline.properties.get('input') as ReferenceASTNode
    expect(isReferenceExprNode(input)).toBe(true)
    expect(input.properties.get('path')).toEqual(['post', 'itemField'])
  })

  it('preserves all other field properties when adding formatPipeline', () => {
    const formatter = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim')

    const validationExpr = ASTTestFactory.expression(ExpressionType.VALIDATION).withId('compile_ast:19').build()

    const field = ASTTestFactory.block('TextInput', 'field')
      .withId('compile_ast:20')
      .withCode('fullField')
      .withLabel('Full Field')
      .withProperty('hint', 'Enter your text')
      .withProperty('required', true)
      .withProperty('validate', validationExpr)
      .withProperty('formatters', [formatter])
      .build()

    const originalKeys = Array.from(field.properties.keys())

    normalizer.normalize(field)

    // All original properties, apart from 'formatters' should still exist
    for (const key of originalKeys) {
      if (key !== 'formatters') {
        expect(field.properties.has(key)).toBe(true)
      }
    }

    // Formatters property should be removed
    expect(field.properties.has('formatters')).toBe(false)

    // Plus the new formatPipeline
    expect(field.properties.has('formatPipeline')).toBe(true)

    // Verify specific properties are unchanged
    expect(field.properties.get('label')).toBe('Full Field')
    expect(field.properties.get('hint')).toBe('Enter your text')
    expect(field.properties.get('required')).toBe(true)
    expect(field.properties.get('validate')).toBe(validationExpr)
  })
})

function stepName(step: any): string | undefined {
  if (isTransformerFunctionNode(step)) {
    return step.properties?.get('name')
  }

  if (step && typeof step === 'object') {
    return step.name
  }

  return undefined
}

function stepArgs(step: any): unknown[] {
  if (isTransformerFunctionNode(step)) {
    const args = step.properties?.get('arguments')
    return Array.isArray(args) ? args : []
  }

  if (step && typeof step === 'object' && Array.isArray(step.args)) {
    return step.args
  }

  return []
}
