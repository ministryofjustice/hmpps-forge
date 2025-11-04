import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ScopeIndex, { ScopeInfo } from '@form-engine/core/ast/dependencies/ScopeIndex'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType, LogicType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { PseudoNodeType, DataPseudoNode } from '@form-engine/core/types/pseudoNodes.type'
import { wireDataPseudoNodes } from './wireDataPseudoNodes'

/**
 * Mock ScopeIndex for testing
 */
class MockScopeIndex extends ScopeIndex {
  private scopeMap: Map<string, ScopeInfo> = new Map()

  constructor() {
    // Pass null registry since we're mocking getScope anyway
    super(null as any)
  }

  setScope(nodeId: string, scope: ScopeInfo): void {
    this.scopeMap.set(nodeId, scope)
  }

  getScope(nodeId: string): ScopeInfo | undefined {
    return this.scopeMap.get(nodeId)
  }
}

describe('wireDataPseudoNodes()', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('valid Data references', () => {
    it('should create edge from onLoad transition to Data pseudo node', () => {
      const dataReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'userData'])
        .build()

      const dataPseudoNode: DataPseudoNode = {
        id: 'compile_pseudo:100',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'userData',
        },
      }

      const onLoadTransitionId = 'compile_pseudo:900'

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataReference.id, dataReference)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(dataPseudoNode.id, dataPseudoNode)

      const graph = new DependencyGraph()
      graph.addNode(dataReference.id)
      graph.addNode(dataPseudoNode.id)
      graph.addNode(onLoadTransitionId)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(dataReference.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:911', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [onLoadTransitionId],
      })

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify edge created: onLoad transition → Data node (onLoad must execute before Data is accessed)
      const dependencies = graph.getDependencies(dataPseudoNode.id)
      expect(dependencies.has(onLoadTransitionId)).toBe(true)
      expect(dependencies.size).toBe(1)

      // Verify edge type and metadata (edge is from onLoad to Data)
      const edges = graph.getEdges(onLoadTransitionId, dataPseudoNode.id)
      expect(edges.length).toBe(1)
      expect(edges[0].type).toBe(DependencyEdgeType.EFFECT_FLOW)
      expect(edges[0].metadata).toEqual({
        reason: 'onLoad might populate this data',
      })
    })

    it('should create edges from all onLoad transitions when multiple exist', () => {
      const dataReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'config'])
        .build()

      const dataPseudoNode: DataPseudoNode = {
        id: 'compile_pseudo:101',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'config',
        },
      }

      const journeyOnLoad = 'compile_pseudo:902'
      const stepOnLoad = 'compile_pseudo:903'

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataReference.id, dataReference)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(dataPseudoNode.id, dataPseudoNode)

      const graph = new DependencyGraph()
      graph.addNode(dataReference.id)
      graph.addNode(dataPseudoNode.id)
      graph.addNode(journeyOnLoad)
      graph.addNode(stepOnLoad)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(dataReference.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:911', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [journeyOnLoad, stepOnLoad],
      })

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify edges created to both onLoad transitions
      const dependencies = graph.getDependencies(dataPseudoNode.id)
      expect(dependencies.has(journeyOnLoad)).toBe(true)
      expect(dependencies.has(stepOnLoad)).toBe(true)
      expect(dependencies.size).toBe(2)
    })

    it('should wire each reference to its respective onLoad chain', () => {
      const dataRef1 = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'user'])
        .build()

      const dataRef2 = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:2')
        .withPath(['data', 'settings'])
        .build()

      const dataPseudoNode1: DataPseudoNode = {
        id: 'compile_pseudo:102',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'user',
        },
      }

      const dataPseudoNode2: DataPseudoNode = {
        id: 'compile_pseudo:103',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'settings',
        },
      }

      const onLoad1 = 'compile_pseudo:900'
      const onLoad2 = 'compile_pseudo:901'

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataRef1.id, dataRef1)
      astRegistry.register(dataRef2.id, dataRef2)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(dataPseudoNode1.id, dataPseudoNode1)
      pseudoRegistry.register(dataPseudoNode2.id, dataPseudoNode2)

      const graph = new DependencyGraph()
      graph.addNode(dataRef1.id)
      graph.addNode(dataRef2.id)
      graph.addNode(dataPseudoNode1.id)
      graph.addNode(dataPseudoNode2.id)
      graph.addNode(onLoad1)
      graph.addNode(onLoad2)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(dataRef1.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: [onLoad1],
      })
      scopeIndex.setScope(dataRef2.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: [onLoad2],
      })

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify first Data node wired correctly
      const deps1 = graph.getDependencies(dataPseudoNode1.id)
      expect(deps1.has(onLoad1)).toBe(true)
      expect(deps1.size).toBe(1)

      // Verify second Data node wired correctly
      const deps2 = graph.getDependencies(dataPseudoNode2.id)
      expect(deps2.has(onLoad2)).toBe(true)
      expect(deps2.size).toBe(1)
    })

    it('should create edges from all onLoad transitions to single Data node when multiple references use same key', () => {
      const dataRef1 = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'sharedData'])
        .build()

      const dataRef2 = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:2')
        .withPath(['data', 'sharedData'])
        .build()

      const dataPseudoNode: DataPseudoNode = {
        id: 'compile_pseudo:104',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'sharedData',
        },
      }

      const onLoad1 = 'compile_pseudo:900'
      const onLoad2 = 'compile_pseudo:901'

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataRef1.id, dataRef1)
      astRegistry.register(dataRef2.id, dataRef2)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(dataPseudoNode.id, dataPseudoNode)

      const graph = new DependencyGraph()
      graph.addNode(dataRef1.id)
      graph.addNode(dataRef2.id)
      graph.addNode(dataPseudoNode.id)
      graph.addNode(onLoad1)
      graph.addNode(onLoad2)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(dataRef1.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:911', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [onLoad1],
      })
      scopeIndex.setScope(dataRef2.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:912', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [onLoad2],
      })

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Both onLoad transitions should be wired to the same Data node
      const dependencies = graph.getDependencies(dataPseudoNode.id)
      expect(dependencies.has(onLoad1)).toBe(true)
      expect(dependencies.has(onLoad2)).toBe(true)
      expect(dependencies.size).toBe(2)
    })
  })

  describe('invalid inputs', () => {
    it('should not create edges when Data pseudo node does not exist', () => {
      const dataReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'nonExistentData'])
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataReference.id, dataReference)

      const pseudoRegistry = new NodeRegistry()
      // No Data pseudo node created

      const graph = new DependencyGraph()
      graph.addNode(dataReference.id)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(dataReference.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: ['compile_pseudo:900'],
      })

      // Should not throw
      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify no dependencies created
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges when reference has no scope', () => {
      const dataReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'userData'])
        .build()

      const dataPseudoNode: DataPseudoNode = {
        id: 'compile_pseudo:100',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'userData',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataReference.id, dataReference)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(dataPseudoNode.id, dataPseudoNode)

      const graph = new DependencyGraph()
      graph.addNode(dataReference.id)
      graph.addNode(dataPseudoNode.id)

      const scopeIndex = new MockScopeIndex()
      // No scope set for reference node

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify no dependencies created
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges when onLoadChain is empty', () => {
      const dataReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data', 'userData'])
        .build()

      const dataPseudoNode: DataPseudoNode = {
        id: 'compile_pseudo:100',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'userData',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(dataReference.id, dataReference)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(dataPseudoNode.id, dataPseudoNode)

      const graph = new DependencyGraph()
      graph.addNode(dataReference.id)
      graph.addNode(dataPseudoNode.id)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(dataReference.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: [], // Empty onLoadChain
      })

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // No edges should be created (no onLoad transitions to wire to)
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges for non-data references', () => {
      const answerReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['answers', 'fieldCode'])
        .build()

      const queryReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:2')
        .withPath(['query', 'param'])
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(answerReference.id, answerReference)
      astRegistry.register(queryReference.id, queryReference)

      const pseudoRegistry = new NodeRegistry()

      const graph = new DependencyGraph()
      graph.addNode(answerReference.id)
      graph.addNode(queryReference.id)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(answerReference.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: ['compile_pseudo:900'],
      })
      scopeIndex.setScope(queryReference.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: ['compile_pseudo:900'],
      })

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // No edges should be created (only 'data' references are processed)
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges when path structure is invalid', () => {
      const shortPath = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withPath(['data']) // Only one element
        .build()

      const emptyPath = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:2')
        .withPath([])
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(shortPath.id, shortPath)
      astRegistry.register(emptyPath.id, emptyPath)

      const pseudoRegistry = new NodeRegistry()

      const graph = new DependencyGraph()
      graph.addNode(shortPath.id)
      graph.addNode(emptyPath.id)

      const scopeIndex = new MockScopeIndex()

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify no dependencies created
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges when data key is non-string', () => {
      const refWithNumberKey = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_pseudo:1')
        .withProperty('path', ['data', 123]) // Number instead of string
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(refWithNumberKey.id, refWithNumberKey)

      const pseudoRegistry = new NodeRegistry()

      const graph = new DependencyGraph()
      graph.addNode(refWithNumberKey.id)

      const scopeIndex = new MockScopeIndex()

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify no dependencies created
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges for non-ReferenceExpr nodes', () => {
      const conditionalExpr = ASTTestFactory.expression(LogicType.CONDITIONAL).withId('compile_pseudo:1').build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(conditionalExpr.id, conditionalExpr)

      const pseudoRegistry = new NodeRegistry()

      const graph = new DependencyGraph()
      graph.addNode(conditionalExpr.id)

      const scopeIndex = new MockScopeIndex()

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify no dependencies created
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })

    it('should not create edges when path property is null or undefined', () => {
      const refWithNullPath = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_pseudo:1').build()

      // Remove path property
      refWithNullPath.properties.delete('path')

      const astRegistry = new NodeRegistry()
      astRegistry.register(refWithNullPath.id, refWithNullPath)

      const pseudoRegistry = new NodeRegistry()

      const graph = new DependencyGraph()
      graph.addNode(refWithNullPath.id)

      const scopeIndex = new MockScopeIndex()

      wireDataPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify no dependencies created
      const allNodes = graph.getAllNodes()
      allNodes.forEach(nodeId => {
        expect(graph.getDependencies(nodeId).size).toBe(0)
      })
    })
  })
})
