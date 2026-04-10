import { ASTNodeType } from '../../types/enums'
import { TemplateNode, TemplateValue } from '../../types/template.type'
import { BlockType, ExpressionType } from '../../../authoring/types/enums'
import ValidationTemplateAnalyzer from './ValidationTemplateAnalyzer'

function createFieldTemplate(options: { validWhen?: TemplateValue[] } = {}): TemplateNode {
  const properties: Record<string, TemplateValue> = {}

  if (options.validWhen !== undefined) {
    properties.validWhen = options.validWhen
  }

  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.BLOCK,
    id: 'template:1',
    blockType: BlockType.FIELD,
    properties,
  }
}

function createIterateTemplate(yieldTemplate?: TemplateValue, predicateTemplate?: TemplateValue): TemplateNode {
  return {
    type: ASTNodeType.TEMPLATE,
    originalType: ASTNodeType.EXPRESSION,
    id: 'template:2',
    expressionType: ExpressionType.ITERATE,
    properties: {
      iterator: {
        yieldTemplate,
        predicateTemplate,
      },
    },
  }
}

describe('ValidationTemplateAnalyzer', () => {
  describe('mayYieldFields()', () => {
    it('should return true for a field template without validations', () => {
      const template = createFieldTemplate()

      expect(ValidationTemplateAnalyzer.mayYieldFields(template)).toBe(true)
    })

    it('should return true for an iterator whose nested iterate yields a field', () => {
      const nestedIterate = createIterateTemplate(createFieldTemplate())
      const template = createIterateTemplate({
        rows: [nestedIterate],
      })

      expect(ValidationTemplateAnalyzer.mayYieldFields(template)).toBe(true)
    })

    it('should return false for an iterator with only a predicate template', () => {
      const template = createIterateTemplate(undefined, createFieldTemplate())

      expect(ValidationTemplateAnalyzer.mayYieldFields(template)).toBe(false)
    })
  })

  describe('mayYieldValidatingFields()', () => {
    it('should return true for a field template with validations', () => {
      const template = createFieldTemplate({ validWhen: ['rule'] })

      expect(ValidationTemplateAnalyzer.mayYieldValidatingFields(template)).toBe(true)
    })

    it('should return false for a field template without validations', () => {
      const template = createFieldTemplate()

      expect(ValidationTemplateAnalyzer.mayYieldValidatingFields(template)).toBe(false)
    })

    it('should return true for an iterator whose yield template contains a validating field', () => {
      const template = createIterateTemplate({
        field: createFieldTemplate({ validWhen: ['rule'] }),
      })

      expect(ValidationTemplateAnalyzer.mayYieldValidatingFields(template)).toBe(true)
    })

    it('should return true for an iterator whose nested iterate yields a validating field', () => {
      const nestedIterate = createIterateTemplate(createFieldTemplate({ validWhen: ['rule'] }))
      const template = createIterateTemplate({
        rows: [nestedIterate],
      })

      expect(ValidationTemplateAnalyzer.mayYieldValidatingFields(template)).toBe(true)
    })

    it('should return false for an iterator with only a predicate template', () => {
      const template = createIterateTemplate(undefined, createFieldTemplate({ validWhen: ['rule'] }))

      expect(ValidationTemplateAnalyzer.mayYieldValidatingFields(template)).toBe(false)
    })
  })
})
