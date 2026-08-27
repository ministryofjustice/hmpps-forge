import { ExpressionType } from '../../../../authoring/types/enums'
import { isASTNode, isMaterialisedASTNode, isTemplateASTNode } from './nodes'

describe('AST node guards', () => {
  describe('isASTNode()', () => {
    it.each([
      { kind: ExpressionType.REFERENCE, isTemplate: false, id: 'compile_ast:1' },
      { kind: ExpressionType.REFERENCE, isTemplate: true, id: 'template:1' },
    ])('should accept a valid AST node in either materialisation state', node => {
      // Arrange

      // Act
      const result = isASTNode(node)

      // Assert
      expect(result).toBe(true)
    })

    it.each([
      { kind: 'unknown.kind', isTemplate: false, id: 'compile_ast:1' },
      { kind: ExpressionType.REFERENCE, isTemplate: false, id: 'template:1' },
      { kind: ExpressionType.REFERENCE, isTemplate: true, id: 'compile_ast:1' },
      { kind: ExpressionType.REFERENCE, isTemplate: 'false', id: 'compile_ast:1' },
    ])('should reject an unknown kind or mismatched state and ID', node => {
      // Arrange

      // Act
      const result = isASTNode(node)

      // Assert
      expect(result).toBe(false)
    })
  })

  describe('isMaterialisedASTNode()', () => {
    it('should only accept a materialised AST node', () => {
      // Arrange
      const materialised = { kind: ExpressionType.REFERENCE, isTemplate: false, id: 'compile_ast:1' }
      const template = { kind: ExpressionType.REFERENCE, isTemplate: true, id: 'template:1' }

      // Act
      const materialisedResult = isMaterialisedASTNode(materialised)
      const templateResult = isMaterialisedASTNode(template)

      // Assert
      expect(materialisedResult).toBe(true)
      expect(templateResult).toBe(false)
    })
  })

  describe('isTemplateASTNode()', () => {
    it('should only accept a template AST node', () => {
      // Arrange
      const materialised = { kind: ExpressionType.REFERENCE, isTemplate: false, id: 'compile_ast:1' }
      const template = { kind: ExpressionType.REFERENCE, isTemplate: true, id: 'template:1' }

      // Act
      const materialisedResult = isTemplateASTNode(materialised)
      const templateResult = isTemplateASTNode(template)

      // Assert
      expect(materialisedResult).toBe(false)
      expect(templateResult).toBe(true)
    })
  })
})
