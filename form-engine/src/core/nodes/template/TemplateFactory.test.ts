import { NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { isTemplateNode } from '@form-engine/core/typeguards/nodes'
import { TemplateValue } from '@form-engine/core/types/template.type'
import TemplateFactory from './TemplateFactory'

describe('TemplateFactory', () => {
  let templateFactory: TemplateFactory

  beforeEach(() => {
    templateFactory = new TemplateFactory(new NodeIDGenerator())
  })

  describe('compile()', () => {
    it('should compile arrays containing ast nodes into template nodes', () => {
      // Arrange
      const value = {
        steps: [
          {
            id: 'compile_ast:1',
            type: ASTNodeType.EXPRESSION,
            expressionType: 'FunctionType.Transformer',
            properties: {
              name: 'RelativeTime',
            },
          },
        ],
        slots: {
          details: [
            {
              id: 'compile_ast:2',
              type: ASTNodeType.BLOCK,
              variant: 'govukDetails',
              properties: {
                summaryText: 'View details',
              },
            },
          ],
        },
      }

      // Act
      const result = templateFactory.compile(value) as {
        steps: unknown[]
        slots: {
          details: unknown[]
        }
      }

      // Assert
      expect(isTemplateNode(result.steps[0])).toBe(true)
      expect(isTemplateNode(result.slots.details[0])).toBe(true)
    })
  })

  describe('instantiate()', () => {
    it('should instantiate arrays of template nodes as id-less ast nodes', () => {
      // Arrange
      const template = templateFactory.compile({
        steps: [
          {
            id: 'compile_ast:1',
            type: ASTNodeType.EXPRESSION,
            expressionType: 'FunctionType.Transformer',
            properties: {
              name: 'RelativeTime',
            },
          },
        ],
      }) as TemplateValue & {
        steps: unknown[]
      }

      // Act
      const result = TemplateFactory.instantiate(template) as {
        steps: Array<{
          id?: string
          type: ASTNodeType
          expressionType: string
          properties: {
            name: string
          }
        }>
      }

      // Assert
      expect(result.steps[0].id).toBeUndefined()
      expect(result.steps[0].type).toBe(ASTNodeType.EXPRESSION)
      expect(result.steps[0].expressionType).toBe('FunctionType.Transformer')
      expect(result.steps[0].properties.name).toBe('RelativeTime')
    })
  })
})
