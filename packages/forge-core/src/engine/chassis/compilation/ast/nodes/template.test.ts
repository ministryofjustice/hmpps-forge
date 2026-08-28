import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import { isTemplateASTNode } from '../../../contracts/ast/nodes'
import { compileTemplate } from './template'
import { ComponentCallType, FunctionCallType } from '../../../../../shared/taxonomy'
import { ASTTestFactory } from '../testing-helpers/ASTTestFactory'
import type { TemplateASTNode } from '../../../contracts/ast/ast.type'

describe('template', () => {
  describe('compileTemplate()', () => {
    it('should compile arrays containing ast nodes into template nodes', () => {
      // Arrange
      const value = {
        steps: [
          {
            id: 'compile_ast:1',
            kind: FunctionCallType.TRANSFORMER,
            isTemplate: false,
            properties: {
              name: 'RelativeTime',
            },
          },
        ],
        slots: {
          details: [
            {
              id: 'compile_ast:2',
              kind: ComponentCallType.BASIC,
              isTemplate: false,
              variant: 'govukDetails',
              properties: {
                summaryText: 'View details',
              },
            },
          ],
        },
      }

      // Act
      const result = compileTemplate(value, new NodeIDGenerator()) as {
        steps: unknown[]
        slots: {
          details: unknown[]
        }
      }

      // Assert
      expect(isTemplateASTNode(result.steps[0])).toBe(true)
      expect(isTemplateASTNode(result.slots.details[0])).toBe(true)
    })

    it('should recursively preserve node data without mutating the materialised source tree', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'name'])
      const block = ASTTestFactory.block('text-input', ComponentCallType.FIELD)
        .withCode('name')
        .withProperty('defaultValue', reference)
        .build()
      const sourceSnapshot = structuredClone(block)

      // Act
      const result = compileTemplate(block, new NodeIDGenerator()) as TemplateASTNode
      const nestedReference = result.properties?.defaultValue as TemplateASTNode

      // Assert
      expect(result).toMatchObject({
        kind: ComponentCallType.FIELD,
        isTemplate: true,
        id: 'template:1',
        variant: 'text-input',
        diagnostics: block.diagnostics,
      })
      expect(nestedReference).toMatchObject({
        kind: reference.kind,
        isTemplate: true,
        id: 'template:2',
        diagnostics: reference.diagnostics,
      })
      expect(result.properties?.code).toBe('name')
      expect(block).toEqual(sourceSnapshot)
      expect(block.isTemplate).toBe(false)
      expect(reference.isTemplate).toBe(false)
    })
  })
})
