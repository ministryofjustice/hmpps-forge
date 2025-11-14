import { ResolveSelfReferencesNormalizer } from '@form-engine/core/ast/normalizers/ResolveSelfReferences'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType, FunctionType } from '@form-engine/form/types/enums'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { isASTNode } from '@form-engine/core/typeguards/nodes'
import { FunctionASTNode, PipelineASTNode, ReferenceASTNode } from '@form-engine/core/types/expressions.type'

describe('ResolveSelfReferencesNormalizer', () => {
  let normalizer: ResolveSelfReferencesNormalizer

  beforeEach(() => {
    normalizer = new ResolveSelfReferencesNormalizer()
  })

  describe('normalize()', () => {
    it('replaces @self with static field code', () => {
      const ref = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:1')
        .withPath(['answers', '@self'])
        .build()

      const field = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:2')
        .withCode('myField')
        .withProperty('value', ref)
        .build()

      normalizer.normalize(field)

      const valueExpr = field.properties.value
      const path = valueExpr.properties.path as any[]

      expect(Array.isArray(path)).toBe(true)
      expect(path[0]).toBe('answers')
      expect(path[1]).toBe('myField')
    })

    it('replaces @self with a deep-cloned code expression when code is dynamic', () => {
      const trimFunction = ASTTestFactory.functionExpression(FunctionType.TRANSFORMER, 'trim', [])

      const codeExpr = ASTTestFactory.expression<PipelineASTNode>(ExpressionType.PIPELINE)
        .withId('compile_ast:3')
        .withSteps([trimFunction])
        .build()

      const ref = ASTTestFactory.expression<ReferenceASTNode>(ExpressionType.REFERENCE)
        .withId('compile_ast:4')
        .withPath(['answers', '@self'])
        .build()

      const field = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:5')
        .withCode(codeExpr)
        .withProperty('value', ref)
        .build()

      normalizer.normalize(field)

      const valueExpr = field.properties.value
      const path = valueExpr.properties.path as any[]
      const seg = path[1]

      expect(isASTNode(seg)).toBe(true)
      expect(seg).not.toBe(codeExpr)
      expect(seg.type).toBe(codeExpr.type)
      expect(seg.expressionType).toBe(codeExpr.expressionType)

      const originalSteps = codeExpr.properties.steps
      const clonedSteps = seg.properties.steps

      expect(Array.isArray(originalSteps)).toBe(true)
      expect(Array.isArray(clonedSteps)).toBe(true)
      expect(clonedSteps).not.toBe(originalSteps)
      expect(clonedSteps.length).toBe(originalSteps.length)
      expect((clonedSteps[0] as FunctionASTNode).properties.name).toBe(
        (originalSteps[0] as FunctionASTNode).properties.name,
      )
    })

    it('throws when Self() is used outside of a field block', () => {
      const ref = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:6')
        .withPath(['answers', '@self'])
        .build()

      const journey = ASTTestFactory.journey().withId('compile_ast:7').withProperty('expr', ref).build()

      expect(() => normalizer.normalize(journey)).toThrow(InvalidNodeError)

      try {
        normalizer.normalize(journey)
      } catch (e) {
        const err = e as InvalidNodeError
        expect(err.message).toMatch(/Self\(\) reference used outside of a field block/)
        expect(err).toBeInstanceOf(InvalidNodeError)
      }
    })

    it('throws when containing field has no code', () => {
      const ref = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:8')
        .withPath(['answers', '@self'])
        .build()

      const field = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:9')
        .withProperty('value', ref)
        .build()

      expect(() => normalizer.normalize(field)).toThrow(InvalidNodeError)

      try {
        normalizer.normalize(field)
      } catch (e) {
        const err = e as InvalidNodeError
        expect(err.message).toMatch(/Containing field has no code to resolve Self\(\)/)
      }
    })

    it("throws when Self() is used within the field's code expression", () => {
      const selfInCode = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:10')
        .withPath(['answers', '@self'])
        .build()

      const field = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:11')
        .withCode(selfInCode)
        // Value can be anything; the error is triggered by the Self() in code
        .withProperty(
          'value',
          ASTTestFactory.expression(ExpressionType.REFERENCE)
            .withId('compile_ast:12')
            .withPath(['answers', 'x'])
            .build(),
        )
        .build()

      expect(() => normalizer.normalize(field)).toThrow(InvalidNodeError)

      try {
        normalizer.normalize(field)
      } catch (e) {
        const err = e as InvalidNodeError
        expect(err.message).toMatch(/Self\(\) cannot be used within the field's code expression/)
      }
    })
  })
})
