import { NodeIDGenerator } from '../../ast-state/NodeIDGenerator'
import { ASTNodeType } from '../../../../contracts/ast/enums'
import { isTemplateNode } from '../../../../contracts/ast/nodes'
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
})
