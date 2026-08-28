import { PolicyType, ComponentCallType, ExpressionType, IteratorType } from '../../../../shared/taxonomy'
import type { MaterialisedASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import type { IterateASTNode, ValidationASTNode } from '../../../chassis/contracts/ast/expressions.type'
import type { TemplateASTNode, TemplateNodeId } from '../../../chassis/contracts/ast/ast.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import TemplateNodeIndex from '../../../chassis/compilation/ast/ast-state/TemplateNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateValidationScope } from './validateValidationScope'

const createContext = (
  nodes: readonly MaterialisedASTNode[],
  edges: ReadonlyArray<[NodeId, NodeId]>,
): ASTValidationContext => {
  const byId = new Map<NodeId, MaterialisedASTNode>(nodes.map(node => [node.id, node]))

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
    templateNodeIndex: new TemplateNodeIndex(),
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

const validationTemplate = (): TemplateASTNode => ({
  kind: PolicyType.VALIDATION_RULE,
  isTemplate: true,
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
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD).withProperty('validWhen', iterate).build()
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
      const block = ASTTestFactory.block('text', ComponentCallType.FIELD).withProperty('validWhen', [iterate]).build()
      const context = createContext([block, iterate], [[iterate.id, block.id]])

      // Act
      const errors = validateValidationScope(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error when a validation node is not inside any validWhen', () => {
      // Arrange
      const validation = ASTTestFactory.expression<ValidationASTNode>(PolicyType.VALIDATION_RULE).build()
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
