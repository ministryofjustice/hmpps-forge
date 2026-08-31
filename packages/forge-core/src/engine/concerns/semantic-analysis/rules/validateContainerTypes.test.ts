import { ComponentCallType } from '../../../../shared/taxonomy'
import type { MaterialisedASTNode } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import TemplateNodeIndex from '../../../chassis/compilation/ast/ast-state/TemplateNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateContainerTypes } from './validateContainerTypes'

function createContext(nodes: readonly MaterialisedASTNode[]): ASTValidationContext {
  const nodeIndex = new ASTNodeIndex()

  nodes.forEach(node => nodeIndex.register(node.id, node))

  return {
    nodeIndex,
    templateNodeIndex: new TemplateNodeIndex(),
    functionRegistry: new FunctionRegistry(),
  }
}

describe('validateContainerTypes', () => {
  describe('validateContainerTypes()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should allow blocks nested in arrays and records', () => {
      // Arrange
      const header = ASTTestFactory.block('header', ComponentCallType.BASIC).build()
      const field = ASTTestFactory.block('text', ComponentCallType.FIELD).build()
      const step = ASTTestFactory.step()
        .withProperty('blocks', { header, sections: [[field]] })
        .build()
      const context = createContext([header, field, step])

      // Act
      const errors = validateContainerTypes(context)

      // Assert
      expect(errors).toEqual([])
    })

    it('should reject a non-block leaf inside a nested blocks structure', () => {
      // Arrange
      const block = ASTTestFactory.block('text', ComponentCallType.BASIC).build()
      const step = ASTTestFactory.step()
        .withProperty('blocks', { content: [block, 'not-a-block'] })
        .build()
      const context = createContext([block, step])

      // Act
      const errors = validateContainerTypes(context)

      // Assert
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBeInstanceOf(ForgeReferenceScopeError)
      expect(errors[0]?.message).toBe('blocks can only contain block definitions')
    })
  })
})
