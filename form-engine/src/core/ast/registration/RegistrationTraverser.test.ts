import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ASTNode } from '@form-engine/core/types/engine.type'
import RegistrationTraverser from './RegistrationTraverser'
import NodeRegistry from './NodeRegistry'

describe('RegistrationTraverser', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('register', () => {
    it('should build registry from nested structure with all node types', () => {
      const expr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:5')
        .withPath(['answers', 'test'])
        .build()

      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('firstName').withLabel('First Name'),
            )
            .withBlock('TextInput', 'field', block =>
              block
                .withId('compile_ast:4')
                .withCode('testField')
                .withLabel('Test Field')
                .withProperty('defaultValue', expr),
            ),
        )
        .build()

      const registry = new NodeRegistry()
      const traverser = new RegistrationTraverser(registry)
      traverser.register(journey)

      // Verify all nodes registered
      expect(registry.size()).toBe(5) // journey + step + 2 blocks + expression
      expect(registry.has(journey.id)).toBe(true)
      expect(registry.has('compile_ast:2')).toBe(true)
      expect(registry.has('compile_ast:3')).toBe(true)
      expect(registry.has('compile_ast:4')).toBe(true)
      expect(registry.has('compile_ast:5')).toBe(true)

      // Verify can retrieve nodes
      expect(registry.get(journey.id)).toBe(journey)
      expect(registry.get('compile_ast:3')).toBeTruthy()
      expect(registry.get('compile_ast:5')).toBe(expr)

      // Verify types are registered correctly
      const journeys = registry.findByType(ASTNodeType.JOURNEY)
      expect(journeys.length).toBe(1)

      const steps = registry.findByType(ASTNodeType.STEP)
      expect(steps.length).toBe(1)

      const blocks = registry.findByType(ASTNodeType.BLOCK)
      expect(blocks.length).toBe(2)

      const expressions = registry.findByType(ASTNodeType.EXPRESSION)
      expect(expressions.length).toBe(1)
    })

    it('should register nodes with correct paths', () => {
      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step.withId('compile_ast:2').withBlock('TextInput', 'field', block => block.withId('compile_ast:3')),
        )
        .build()

      const registry = new NodeRegistry()
      const traverser = new RegistrationTraverser(registry)
      traverser.register(journey)

      const journeyEntry = registry.getEntry(journey.id)
      expect(journeyEntry?.path).toEqual([])

      const stepEntry = registry.getEntry('compile_ast:2')
      expect(stepEntry?.path).toEqual(['steps', 0])

      const blockEntry = registry.getEntry('compile_ast:3')
      expect(blockEntry?.path).toEqual(['steps', 0, 'blocks', 0])
    })

    it('should handle node with multiple properties containing nodes', () => {
      const expr1 = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:3').build()

      const expr2 = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:4').build()

      const block = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:2')
        .withProperty('defaultValue', expr1)
        .withProperty('validation', expr2)
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:1').withProperty('blocks', [block]).build()

      const registry = new NodeRegistry()
      const traverser = new RegistrationTraverser(registry)
      traverser.register(step)

      expect(registry.size()).toBe(4) // step + block + 2 expressions
      expect(registry.has('compile_ast:1')).toBe(true)
      expect(registry.has('compile_ast:2')).toBe(true)
      expect(registry.has('compile_ast:3')).toBe(true)
      expect(registry.has('compile_ast:4')).toBe(true)
    })

    describe('edge cases', () => {
      it('should handle empty journey', () => {
        const journey = ASTTestFactory.journey().build()

        const registry = new NodeRegistry()
        const traverser = new RegistrationTraverser(registry)
        traverser.register(journey)

        expect(registry.size()).toBe(1)
        expect(registry.has(journey.id)).toBe(true)
      })

      it('should handle step with no blocks', () => {
        const journey = ASTTestFactory.journey()
          .withStep(step => step.withId('compile_ast:2'))
          .build()

        const registry = new NodeRegistry()
        const traverser = new RegistrationTraverser(registry)
        traverser.register(journey)

        expect(registry.size()).toBe(2)
        expect(registry.has(journey.id)).toBe(true)
        expect(registry.has('compile_ast:2')).toBe(true)
      })
    })
  })

  describe('error handling', () => {
    it('should throw InvalidNodeError with message and node reference when root node lacks ID', () => {
      const nodeWithoutId = {
        type: ASTNodeType.STEP,
        id: undefined as any,
        properties: new Map(),
      } as ASTNode

      const registry = new NodeRegistry()
      const traverser = new RegistrationTraverser(registry)

      try {
        traverser.register(nodeWithoutId)
        fail('Expected InvalidNodeError to be thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidNodeError)
        expect(error.message).toMatch(/Node is missing ID/)

        if (error instanceof InvalidNodeError) {
          expect(error.node).toBe(nodeWithoutId)
        }
      }
    })

    it('should throw InvalidNodeError for nested nodes and include path in error message', () => {
      const exprWithoutId = {
        type: ASTNodeType.EXPRESSION,
        id: undefined as any,
        expressionType: ExpressionType.REFERENCE,
        properties: new Map([['path', ['answers', 'test']]]),
      } as ASTNode

      const block = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:2')
        .withProperty('defaultValue', exprWithoutId)
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:1').withProperty('blocks', [block]).build()

      const registry = new NodeRegistry()
      const traverser = new RegistrationTraverser(registry)

      expect(() => traverser.register(step)).toThrow(/blocks\.0\.defaultValue/)
    })

    it('should throw error when duplicate ID exists in tree', () => {
      const duplicateId = 'compile_ast:999'

      const journey = ASTTestFactory.journey()
        .withStep(step => step.withId(duplicateId))
        .withStep(step => step.withId(duplicateId))
        .build()

      const registry = new NodeRegistry()
      const traverser = new RegistrationTraverser(registry)

      expect(() => traverser.register(journey)).toThrow(/already registered/)
    })
  })
})
