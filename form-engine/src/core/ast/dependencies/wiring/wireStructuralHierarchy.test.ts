import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { NodeId } from '@form-engine/core/types/engine.type'
import { wireStructuralHierarchy } from './wireStructuralHierarchy'

describe('wireStructuralHierarchy()', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('valid structural wiring', () => {
    it('should create edge from child to parent', () => {
      const childExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:2')
        .withPath(['answers', 'test'])
        .build()

      const parentBlock = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withCode('parentField')
        .withProperty('defaultValue', childExpr)
        .build()

      const registry = new NodeRegistry()
      registry.register(parentBlock.id, parentBlock)
      registry.register(childExpr.id, childExpr)

      const graph = new DependencyGraph()
      graph.addNode(parentBlock.id)
      graph.addNode(childExpr.id)

      wireStructuralHierarchy(registry, graph)

      // Verify edge created: child → parent (child must come before parent)
      const dependencies = graph.getDependencies(parentBlock.id)
      expect(dependencies.has(childExpr.id)).toBe(true)
      expect(dependencies.size).toBe(1)

      // Verify edge type and metadata (edge is from child to parent)
      const edges = graph.getEdges(childExpr.id, parentBlock.id)
      expect(edges.length).toBe(1)
      expect(edges[0].type).toBe(DependencyEdgeType.STRUCTURAL)
      expect(edges[0].metadata).toEqual({ propertyName: 'defaultValue' })
    })

    it('should create edges from array of children to parent', () => {
      const child1 = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:2')
        .withPath(['answers', 'field1'])
        .build()

      const child2 = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:3')
        .withPath(['answers', 'field2'])
        .build()

      const parent = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withProperty('validations', [child1, child2])
        .build()

      const registry = new NodeRegistry()
      registry.register(parent.id, parent)
      registry.register(child1.id, child1)
      registry.register(child2.id, child2)

      const graph = new DependencyGraph()
      graph.addNode(parent.id)
      graph.addNode(child1.id)
      graph.addNode(child2.id)

      wireStructuralHierarchy(registry, graph)

      // Verify edges created for both children: child → parent
      const dependencies = graph.getDependencies(parent.id)
      expect(dependencies.has(child1.id)).toBe(true)
      expect(dependencies.has(child2.id)).toBe(true)
      expect(dependencies.size).toBe(2)

      // Verify both edges have correct metadata (edges are from child to parent)
      const edges1 = graph.getEdges(child1.id, parent.id)
      expect(edges1[0].metadata).toEqual({ propertyName: 'validations' })

      const edges2 = graph.getEdges(child2.id, parent.id)
      expect(edges2[0].metadata).toEqual({ propertyName: 'validations' })
    })

    it('should create edges from multiple properties to parent', () => {
      const defaultValueExpr = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:2').build()

      const conditionExpr = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:3').build()

      const parent = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withProperty('defaultValue', defaultValueExpr)
        .withProperty('condition', conditionExpr)
        .build()

      const registry = new NodeRegistry()
      registry.register(parent.id, parent)
      registry.register(defaultValueExpr.id, defaultValueExpr)
      registry.register(conditionExpr.id, conditionExpr)

      const graph = new DependencyGraph()
      graph.addNode(parent.id)
      graph.addNode(defaultValueExpr.id)
      graph.addNode(conditionExpr.id)

      wireStructuralHierarchy(registry, graph)

      // Verify both edges created: child → parent
      const dependencies = graph.getDependencies(parent.id)
      expect(dependencies.size).toBe(2)
      expect(dependencies.has(defaultValueExpr.id)).toBe(true)
      expect(dependencies.has(conditionExpr.id)).toBe(true)

      // Verify correct metadata for each edge (edges are from child to parent)
      const defaultEdges = graph.getEdges(defaultValueExpr.id, parent.id)
      expect(defaultEdges[0].metadata).toEqual({ propertyName: 'defaultValue' })

      const conditionEdges = graph.getEdges(conditionExpr.id, parent.id)
      expect(conditionEdges[0].metadata).toEqual({ propertyName: 'condition' })
    })

    it('should create edges for nested structure', () => {
      const expr = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:4').build()

      const block1 = ASTTestFactory.block('TextInput', 'field').withId('compile_ast:2').withCode('field1').build()

      const block2 = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:3')
        .withCode('field2')
        .withProperty('defaultValue', expr)
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:1').withProperty('blocks', [block1, block2]).build()

      const registry = new NodeRegistry()
      registry.register(step.id, step)
      registry.register(block1.id, block1)
      registry.register(block2.id, block2)
      registry.register(expr.id, expr)

      const graph = new DependencyGraph()
      graph.addNode(step.id)
      graph.addNode(block1.id)
      graph.addNode(block2.id)
      graph.addNode(expr.id)

      wireStructuralHierarchy(registry, graph)

      // Step should depend on both blocks
      const stepDeps = graph.getDependencies(step.id)
      expect(stepDeps.has(block1.id)).toBe(true)
      expect(stepDeps.has(block2.id)).toBe(true)

      // Block2 should depend on expression
      const block2Deps = graph.getDependencies(block2.id)
      expect(block2Deps.has(expr.id)).toBe(true)

      // Block1 should have no dependencies
      const block1Deps = graph.getDependencies(block1.id)
      expect(block1Deps.size).toBe(0)
    })

    it('should create edge for block nested in object within array', () => {
      // Simulate a radio input with conditional reveal:
      // items: [{ value: 'x', block: nestedBlock }]
      const nestedBlock = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:2')
        .withCode('conditionalField')
        .build()

      const radioBlock = ASTTestFactory.block('RadioInput', 'field')
        .withId('compile_ast:1')
        .withCode('radioField')
        .withProperty('items', [
          { value: 'option1', text: 'Option 1' },
          { value: 'option2', text: 'Option 2', block: nestedBlock },
        ])
        .build()

      const registry = new NodeRegistry()
      registry.register(radioBlock.id, radioBlock)
      registry.register(nestedBlock.id, nestedBlock)

      const graph = new DependencyGraph()
      graph.addNode(radioBlock.id)
      graph.addNode(nestedBlock.id)

      wireStructuralHierarchy(registry, graph)

      // Verify nested block → radio block edge
      const radioDeps = graph.getDependencies(radioBlock.id)
      expect(radioDeps.has(nestedBlock.id)).toBe(true)
      expect(radioDeps.size).toBe(1)

      // Verify edge metadata includes property name
      const edges = graph.getEdges(nestedBlock.id, radioBlock.id)
      expect(edges.length).toBe(1)
      expect(edges[0].type).toBe(DependencyEdgeType.STRUCTURAL)
      expect(edges[0].metadata).toEqual({ propertyName: 'items' })
    })

    it('should create edges for multiple blocks nested in different objects within same array', () => {
      const nestedBlock1 = ASTTestFactory.block('TextInput', 'field').withId('compile_ast:2').withCode('field1').build()

      const nestedBlock2 = ASTTestFactory.block('TextInput', 'field').withId('compile_ast:3').withCode('field2').build()

      const radioBlock = ASTTestFactory.block('RadioInput', 'field')
        .withId('compile_ast:1')
        .withProperty('items', [
          { value: 'option1', block: nestedBlock1 },
          { value: 'option2', text: 'No block' },
          { value: 'option3', block: nestedBlock2 },
        ])
        .build()

      const registry = new NodeRegistry()
      registry.register(radioBlock.id, radioBlock)
      registry.register(nestedBlock1.id, nestedBlock1)
      registry.register(nestedBlock2.id, nestedBlock2)

      const graph = new DependencyGraph()
      graph.addNode(radioBlock.id)
      graph.addNode(nestedBlock1.id)
      graph.addNode(nestedBlock2.id)

      wireStructuralHierarchy(registry, graph)

      // Verify both nested blocks → radio block
      const radioDeps = graph.getDependencies(radioBlock.id)
      expect(radioDeps.has(nestedBlock1.id)).toBe(true)
      expect(radioDeps.has(nestedBlock2.id)).toBe(true)
      expect(radioDeps.size).toBe(2)
    })

    it('should create edge for block nested multiple levels deep in objects', () => {
      const deeplyNestedBlock = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:2')
        .withCode('deepField')
        .build()

      const parentBlock = ASTTestFactory.block('RadioInput', 'field')
        .withId('compile_ast:1')
        .withProperty('items', [
          {
            value: 'option1',
            nested: {
              level2: {
                block: deeplyNestedBlock,
              },
            },
          },
        ])
        .build()

      const registry = new NodeRegistry()
      registry.register(parentBlock.id, parentBlock)
      registry.register(deeplyNestedBlock.id, deeplyNestedBlock)

      const graph = new DependencyGraph()
      graph.addNode(parentBlock.id)
      graph.addNode(deeplyNestedBlock.id)

      wireStructuralHierarchy(registry, graph)

      // Verify deeply nested block → parent block edge
      const parentDeps = graph.getDependencies(parentBlock.id)
      expect(parentDeps.has(deeplyNestedBlock.id)).toBe(true)
      expect(parentDeps.size).toBe(1)
    })

    it('should create edges to immediate parent only, not grandparent', () => {
      const grandchildBlock = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:3')
        .withCode('grandchild')
        .build()

      const childBlock = ASTTestFactory.block('RadioInput', 'field')
        .withId('compile_ast:2')
        .withCode('child')
        .withProperty('items', [{ value: 'x', block: grandchildBlock }])
        .build()

      const parentBlock = ASTTestFactory.step().withId('compile_ast:1').withProperty('blocks', [childBlock]).build()

      const registry = new NodeRegistry()
      registry.register(parentBlock.id, parentBlock)
      registry.register(childBlock.id, childBlock)
      registry.register(grandchildBlock.id, grandchildBlock)

      const graph = new DependencyGraph()
      graph.addNode(parentBlock.id)
      graph.addNode(childBlock.id)
      graph.addNode(grandchildBlock.id)

      wireStructuralHierarchy(registry, graph)

      // Verify grandchild → child (not grandchild → parent)
      const childDeps = graph.getDependencies(childBlock.id)
      expect(childDeps.has(grandchildBlock.id)).toBe(true)

      const parentDeps = graph.getDependencies(parentBlock.id)
      expect(parentDeps.has(childBlock.id)).toBe(true)
      expect(parentDeps.has(grandchildBlock.id)).toBe(false) // Should NOT wire to grandparent
    })

    it('should create edges for complete hierarchy with multiple nodes', () => {
      const expr1 = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:5').build()

      const expr2 = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:6').build()

      const block1 = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:3')
        .withProperty('defaultValue', expr1)
        .build()

      const block2 = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:4')
        .withProperty('condition', expr2)
        .build()

      const step = ASTTestFactory.step().withId('compile_ast:2').withProperty('blocks', [block1, block2]).build()

      const journey = ASTTestFactory.journey().withId('compile_ast:1').withProperty('steps', [step]).build()

      const registry = new NodeRegistry()
      registry.register(journey.id, journey)
      registry.register(step.id, step)
      registry.register(block1.id, block1)
      registry.register(block2.id, block2)
      registry.register(expr1.id, expr1)
      registry.register(expr2.id, expr2)

      const graph = new DependencyGraph()
      graph.addNode(journey.id)
      graph.addNode(step.id)
      graph.addNode(block1.id)
      graph.addNode(block2.id)
      graph.addNode(expr1.id)
      graph.addNode(expr2.id)

      wireStructuralHierarchy(registry, graph)

      // Verify journey → step
      expect(graph.getDependencies(journey.id).has(step.id)).toBe(true)

      // Verify step → blocks
      expect(graph.getDependencies(step.id).has(block1.id)).toBe(true)
      expect(graph.getDependencies(step.id).has(block2.id)).toBe(true)

      // Verify block → expressions
      expect(graph.getDependencies(block1.id).has(expr1.id)).toBe(true)
      expect(graph.getDependencies(block2.id).has(expr2.id)).toBe(true)

      // Expressions should have no dependencies (this is because there is no structural relationships,
      // obviously in the real implementation expressions do get dependencies!
      expect(graph.getDependencies(expr1.id).size).toBe(0)
      expect(graph.getDependencies(expr2.id).size).toBe(0)
    })
  })

  describe('invalid inputs', () => {
    it('should not create edges for nodes without properties', () => {
      const nodeId: NodeId = 'compile_ast:1'
      const nodeWithoutProperties = {
        id: nodeId,
        type: ASTNodeType.STEP,
        // No properties field
      }

      const registry = new NodeRegistry()
      registry.register(nodeWithoutProperties.id, nodeWithoutProperties as any)

      const graph = new DependencyGraph()
      graph.addNode(nodeWithoutProperties.id)

      // Should not throw
      wireStructuralHierarchy(registry, graph)

      // Should have no dependencies
      const deps = graph.getDependencies(nodeWithoutProperties.id)
      expect(deps.size).toBe(0)
    })

    it('should not create edges for nodes where properties is not a Map', () => {
      const nodeId: NodeId = 'compile_ast:2'
      const nodeWithNonMapProperties = {
        id: nodeId,
        type: ASTNodeType.STEP,
        properties: { someKey: 'someValue' }, // Object instead of Map
      }

      const registry = new NodeRegistry()
      registry.register(nodeWithNonMapProperties.id, nodeWithNonMapProperties as any)

      const graph = new DependencyGraph()
      graph.addNode(nodeWithNonMapProperties.id)

      // Should not throw
      wireStructuralHierarchy(registry, graph)

      // Should have no dependencies
      const deps = graph.getDependencies(nodeWithNonMapProperties.id)
      expect(deps.size).toBe(0)
    })

    it('should not create edges for property values that are not AST nodes', () => {
      const parent = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withCode('testField')
        .withLabel('Test Label') // String value, not AST node
        .withProperty('someNumber', 42) // Number value
        .withProperty('someBoolean', true) // Boolean value
        .build()

      const registry = new NodeRegistry()
      registry.register(parent.id, parent)

      const graph = new DependencyGraph()
      graph.addNode(parent.id)

      wireStructuralHierarchy(registry, graph)

      // Should have no dependencies (all values are primitives)
      const deps = graph.getDependencies(parent.id)
      expect(deps.size).toBe(0)
    })

    it('should not create edges for AST nodes without IDs in arrays', () => {
      const validChild = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:2').build()

      const invalidChild = {
        type: ASTNodeType.EXPRESSION,
        // No ID
        properties: new Map(),
      }

      const parent = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withProperty('children', [validChild, invalidChild])
        .build()

      const registry = new NodeRegistry()
      registry.register(parent.id, parent)
      registry.register(validChild.id, validChild)

      const graph = new DependencyGraph()
      graph.addNode(parent.id)
      graph.addNode(validChild.id)

      wireStructuralHierarchy(registry, graph)

      // Should only wire valid child
      const deps = graph.getDependencies(parent.id)
      expect(deps.size).toBe(1)
      expect(deps.has(validChild.id)).toBe(true)
    })

    it('should create edges only for valid AST nodes in mixed arrays', () => {
      const validChild = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:2').build()

      const parent = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withProperty('mixedArray', [validChild, 'string', 123, null, undefined])
        .build()

      const registry = new NodeRegistry()
      registry.register(parent.id, parent)
      registry.register(validChild.id, validChild)

      const graph = new DependencyGraph()
      graph.addNode(parent.id)
      graph.addNode(validChild.id)

      wireStructuralHierarchy(registry, graph)

      // Should only wire valid AST node
      const deps = graph.getDependencies(parent.id)
      expect(deps.size).toBe(1)
      expect(deps.has(validChild.id)).toBe(true)
    })

    it('should not create edges for empty arrays', () => {
      const parent = ASTTestFactory.block('TextInput', 'field')
        .withId('compile_ast:1')
        .withProperty('emptyArray', [])
        .build()

      const registry = new NodeRegistry()
      registry.register(parent.id, parent)

      const graph = new DependencyGraph()
      graph.addNode(parent.id)

      wireStructuralHierarchy(registry, graph)

      // Should have no dependencies
      const deps = graph.getDependencies(parent.id)
      expect(deps.size).toBe(0)
    })

    it('should not create edges for nodes with empty properties Map', () => {
      const node = ASTTestFactory.block('TextInput', 'field').withId('compile_ast:1').build()

      // Remove all properties
      node.properties.clear()

      const registry = new NodeRegistry()
      registry.register(node.id, node)

      const graph = new DependencyGraph()
      graph.addNode(node.id)

      wireStructuralHierarchy(registry, graph)

      // Should have no dependencies
      const deps = graph.getDependencies(node.id)
      expect(deps.size).toBe(0)
    })
  })
})
