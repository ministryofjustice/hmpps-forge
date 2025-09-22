import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTNode } from '@form-engine/core/types/engine.type'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import RegistrationTraverser from './RegistrationTraverser'

describe('RegistrationTraverser', () => {
  describe('buildRegistry', () => {
    it('should assign IDs in depth-first order and register all nodes', () => {
      const tree = ASTTestFactory.scenarios.withValidation() as ASTNode & { properties: any }
      const registry = RegistrationTraverser.buildRegistry(tree)

      // Verify depth-first ID assignment pattern
      expect(tree.id).toBe(1)

      const steps = tree.properties.get('steps')
      expect(steps[0].id).toBe(2)

      const blocks = steps[0].properties.get('blocks')
      expect(blocks[0].id).toBe(3)

      // The withValidation scenario has a validation expression
      const validation = blocks[0].properties.get('validation')
      expect(validation.id).toBeDefined()
      expect(validation.id).toBeGreaterThan(3)

      // Verify all nodes are registered
      // withValidation creates: 1 journey + 1 step + 1 block + validation expressions
      expect(registry.size()).toBeGreaterThanOrEqual(4)

      // Verify we can look up nodes by ID
      expect(registry.get(1)).toBe(tree)
      expect(registry.get(2)).toBe(steps[0])
      expect(registry.get(3)).toBe(blocks[0])
    })

    it('should handle single node', () => {
      const node = ASTTestFactory.block('TextField', 'field').build()
      const registry = RegistrationTraverser.buildRegistry(node)

      expect(node.id).toBe(1)
      expect(registry.size()).toBe(1)
    })

    it('should handle deeply nested structures', () => {
      const root = ASTTestFactory.scenarios.deeplyNested(10)
      const registry = RegistrationTraverser.buildRegistry(root)

      // Count nodes: 1 journey + 1 step + 11 nested blocks (10 containers + 1 field)
      expect(registry.size()).toBe(13)
    })

    it('should handle nodes with no properties', () => {
      const node = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      // Expression with minimal properties
      const registry = RegistrationTraverser.buildRegistry(node)

      expect(node.id).toBe(1)
      expect(registry.size()).toBe(1)
    })

    it('should handle arrays with multiple nodes', () => {
      const blocks = Array.from({ length: 5 }, (_, i) =>
        ASTTestFactory.block('TextField', 'field').withCode(`field_${i}`).build(),
      )
      const root = ASTTestFactory.step().withProperty('blocks', blocks).build()

      const registry = RegistrationTraverser.buildRegistry(root)

      expect(registry.size()).toBe(6) // root + 5 blocks
      blocks.forEach((block, index) => {
        expect(block.id).toBe(index + 2) // IDs start at 2 for blocks
      })
    })

    it('should handle mixed content in properties', () => {
      const root = ASTTestFactory.journey()
        .withMetadata({ version: '1.0' })
        .withProperty('count', 42)
        .withStep(step => step.withTitle('Test Step').withBlock('TextField', 'field', block => block))
        .build()

      const registry = RegistrationTraverser.buildRegistry(root)

      // Should only count actual nodes, not other values
      expect(registry.size()).toBe(3) // root + step + block
    })

    it('should handle minimal scenario', () => {
      const tree = ASTTestFactory.scenarios.minimal()
      const registry = RegistrationTraverser.buildRegistry(tree)

      expect(tree.id).toBe(1)
      expect(registry.size()).toBeGreaterThanOrEqual(3) // journey + step + field
    })

    it('should handle withConditionals scenario', () => {
      const tree = ASTTestFactory.scenarios.withConditionals()
      const registry = RegistrationTraverser.buildRegistry(tree)

      expect(tree.id).toBe(1)
      // Has conditional expressions
      expect(registry.size()).toBeGreaterThan(4) // journey + step + 2 blocks + expressions
    })

    it('should handle withCollection scenario', () => {
      const tree = ASTTestFactory.scenarios.withCollection()
      const registry = RegistrationTraverser.buildRegistry(tree)

      expect(tree.id).toBe(1)
      // Collection with template blocks
      expect(registry.size()).toBeGreaterThan(3)
    })
  })
})
