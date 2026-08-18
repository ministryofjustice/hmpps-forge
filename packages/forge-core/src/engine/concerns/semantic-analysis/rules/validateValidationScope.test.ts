import { BlockType, ExpressionType, IteratorType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode, ValidationASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { TemplateNode } from '../../../chassis/contracts/ast/template.type'
import type { TemplateNodeId } from '../../../chassis/contracts/ast/ast.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateValidationScope } from './validateValidationScope'

const createContext = (nodes: readonly ASTNode[], edges: ReadonlyArray<[NodeId, NodeId]>): ASTValidationContext => {
  const byId = new Map<NodeId, ASTNode>(nodes.map(node => [node.id, node]))

  edges.forEach(([childId, parentId]) => {
    const child = byId.get(childId)
    const parent = byId.get(parentId)

    if (child !== undefined && parent !== undefined) {
      Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
    }
  })

  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  return {
    nodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

const validationTemplate = (): TemplateNode => ({
  type: ASTNodeType.TEMPLATE,
  originalType: ASTNodeType.EXPRESSION,
  expressionType: ExpressionType.VALIDATION,
  id: 'template:1' as TemplateNodeId,
  diagnostics: ASTTestFactory.diagnostics(['validWhen', 'template']),
  properties: {},
})

const mapIterate = (): IterateASTNode =>
  ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withProperty('input', ASTTestFactory.reference(['goals']))
    .withProperty('iterator', { type: IteratorType.MAP, yieldTemplate: validationTemplate() })
    .build()

describe('validateValidationScope', () => {
  describe('validateValidationScope()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when a bare Iterate is a field validWhen and its template holds a validation', () => {
      // Arrange
      const iterate = mapIterate()
      const block = ASTTestFactory.block('text', BlockType.FIELD).withProperty('validWhen', iterate).build()
      const context = createContext([block, iterate], [[iterate.id, block.id]])

      // Act
      const errors = validateValidationScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when a bare Iterate is a step validWhen and its template holds a validation', () => {
      // Arrange
      const iterate = mapIterate()
      const step = ASTTestFactory.step().withProperty('validWhen', iterate).build()
      const context = createContext([step, iterate], [[iterate.id, step.id]])

      // Act
      const errors = validateValidationScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when an array-wrapped Iterate is a field validWhen and its template holds a validation', () => {
      // Arrange
      const iterate = mapIterate()
      const block = ASTTestFactory.block('text', BlockType.FIELD).withProperty('validWhen', [iterate]).build()
      const context = createContext([block, iterate], [[iterate.id, block.id]])

      // Act
      const errors = validateValidationScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when a validation node is not inside any validWhen', () => {
      // Arrange
      const validation = ASTTestFactory.expression<ValidationASTNode>(ExpressionType.VALIDATION).build()
      const context = createContext([validation], [])

      // Act
      const errors = validateValidationScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Validation rules can only be used inside validWhen on a field block or step',
      ])
    })

    it('should return an error when an Iterate template holds a validation but the Iterate is not inside a validWhen', () => {
      // Arrange
      const iterate = mapIterate()
      const context = createContext([iterate], [])

      // Act
      const errors = validateValidationScope(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        'Validation rules can only be used inside validWhen on a field block or step',
      ])
    })
  })
})
