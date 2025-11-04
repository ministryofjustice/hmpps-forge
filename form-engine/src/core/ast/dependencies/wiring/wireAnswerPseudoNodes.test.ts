import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import ScopeIndex, { ScopeInfo } from '@form-engine/core/ast/dependencies/ScopeIndex'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType, LogicType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { PseudoNodeType, AnswerPseudoNode, PostPseudoNode } from '@form-engine/core/types/pseudoNodes.type'

import { wireAnswerPseudoNodes } from './wireAnswerPseudoNodes'

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

describe('wireAnswerPseudoNodes()', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('valid Answer wiring', () => {
    it('should create edge from POST to Answer', () => {
      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:1000')
        .withProperty('code', 'firstName')
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:1',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'firstName',
          fieldNodeId: 'compile_ast:1000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:2',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'firstName',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify edge created: POST → Answer
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(1)

      // Verify edge type and metadata
      const edges = graph.getEdges(postPseudo.id, answerPseudo.id)
      expect(edges.length).toBe(1)
      expect(edges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
      expect(edges[0].metadata).toEqual({
        reason: 'POST provides raw field data',
      })
    })

    it('should create edge from formatPipeline to Answer instead of POST', () => {
      const formatPipeline = ASTTestFactory.expression(ExpressionType.PIPELINE).withId('pipeline:1').build()

      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:2000')
        .withProperty('code', 'email')
        .withProperty('formatPipeline', formatPipeline)
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:3',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'email',
          fieldNodeId: 'compile_ast:2000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:4',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'email',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)
      astRegistry.register(formatPipeline.id, formatPipeline)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(formatPipeline.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify formatPipeline → Answer (not POST → Answer)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(formatPipeline.id)).toBe(true)
      expect(dependencies.has(postPseudo.id)).toBe(false)
      expect(dependencies.size).toBe(1)

      // Verify edge type and metadata
      const edges = graph.getEdges(formatPipeline.id, answerPseudo.id)
      expect(edges.length).toBe(1)
      expect(edges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
      expect(edges[0].metadata).toEqual({
        reason: 'formatPipeline processes POST data before Answer resolution',
      })
    })

    it('should create edges from POST and defaultValue to Answer', () => {
      const defaultValue = ASTTestFactory.expression(LogicType.CONDITIONAL).withId('default:1').build()

      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:3000')
        .withProperty('code', 'country')
        .withProperty('defaultValue', defaultValue)
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:5',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'country',
          fieldNodeId: 'compile_ast:3000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:6',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'country',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)
      astRegistry.register(defaultValue.id, defaultValue)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(defaultValue.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify both POST and defaultValue → Answer
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.has(defaultValue.id)).toBe(true)
      expect(dependencies.size).toBe(2)

      // Verify defaultValue edge
      const defaultEdges = graph.getEdges(defaultValue.id, answerPseudo.id)
      expect(defaultEdges.length).toBe(1)
      expect(defaultEdges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
      expect(defaultEdges[0].metadata).toEqual({
        reason: 'defaultValue provides fallback when POST is empty',
      })
    })

    it('should create edges from formatPipeline and defaultValue to Answer', () => {
      const formatPipeline = ASTTestFactory.expression(ExpressionType.PIPELINE).withId('pipeline:1').build()

      const defaultValue = ASTTestFactory.expression(LogicType.CONDITIONAL).withId('default:1').build()

      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:4000')
        .withProperty('code', 'phone')
        .withProperty('formatPipeline', formatPipeline)
        .withProperty('defaultValue', defaultValue)
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:7',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'phone',
          fieldNodeId: 'compile_ast:4000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:8',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'phone',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)
      astRegistry.register(formatPipeline.id, formatPipeline)
      astRegistry.register(defaultValue.id, defaultValue)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(formatPipeline.id)
      graph.addNode(defaultValue.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify formatPipeline and defaultValue → Answer (not POST)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(formatPipeline.id)).toBe(true)
      expect(dependencies.has(defaultValue.id)).toBe(true)
      expect(dependencies.has(postPseudo.id)).toBe(false)
      expect(dependencies.size).toBe(2)
    })

    it('should create edges from POST and onLoad transition to Answer', () => {
      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:5000')
        .withProperty('code', 'name')
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:9',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'name',
          fieldNodeId: 'compile_ast:5000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:10',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'name',
        },
      }

      const onLoadTransitionId = 'compile_pseudo:900'

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)
      graph.addNode(onLoadTransitionId)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(fieldNode.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:911', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [onLoadTransitionId],
      })

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify onLoad transition → Answer
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(onLoadTransitionId)).toBe(true)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(2)

      // Verify edge type and metadata
      const edges = graph.getEdges(onLoadTransitionId, answerPseudo.id)
      expect(edges.length).toBe(1)
      expect(edges[0].type).toBe(DependencyEdgeType.EFFECT_FLOW)
      expect(edges[0].metadata).toEqual({
        reason: 'onLoad might pre-populate this answer',
      })
    })

    it('should create edges from POST and multiple onLoad transitions to Answer', () => {
      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:6000')
        .withProperty('code', 'address')
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:11',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'address',
          fieldNodeId: 'compile_ast:6000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:12',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'address',
        },
      }

      const journeyOnLoad = 'compile_pseudo:902'
      const stepOnLoad = 'compile_pseudo:903'

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)
      graph.addNode(journeyOnLoad)
      graph.addNode(stepOnLoad)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(fieldNode.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:911', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [journeyOnLoad, stepOnLoad],
      })

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify both onLoad transitions → Answer
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(journeyOnLoad)).toBe(true)
      expect(dependencies.has(stepOnLoad)).toBe(true)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(3)
    })

    it('should create edges from formatPipeline, defaultValue, and onLoad transitions to Answer', () => {
      const formatPipeline = ASTTestFactory.expression(ExpressionType.PIPELINE).withId('pipeline:1').build()

      const defaultValue = ASTTestFactory.expression(LogicType.CONDITIONAL).withId('default:1').build()

      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:11000')
        .withProperty('code', 'complete')
        .withProperty('formatPipeline', formatPipeline)
        .withProperty('defaultValue', defaultValue)
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:20',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'complete',
          fieldNodeId: 'compile_ast:11000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:21',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'complete',
        },
      }

      const journeyOnLoad = 'compile_pseudo:902'
      const stepOnLoad = 'compile_pseudo:903'

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)
      astRegistry.register(formatPipeline.id, formatPipeline)
      astRegistry.register(defaultValue.id, defaultValue)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(formatPipeline.id)
      graph.addNode(defaultValue.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)
      graph.addNode(journeyOnLoad)
      graph.addNode(stepOnLoad)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(fieldNode.id, {
        scopeChain: [
          { id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY },
          { id: 'compile_pseudo:911', nodeType: ASTNodeType.STEP },
        ],
        onLoadChain: [journeyOnLoad, stepOnLoad],
      })

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Verify all dependencies: formatPipeline, defaultValue, onLoads (not POST)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(formatPipeline.id)).toBe(true)
      expect(dependencies.has(defaultValue.id)).toBe(true)
      expect(dependencies.has(journeyOnLoad)).toBe(true)
      expect(dependencies.has(stepOnLoad)).toBe(true)
      expect(dependencies.has(postPseudo.id)).toBe(false) // Excluded because formatPipeline exists
      expect(dependencies.size).toBe(4)
    })

    it('should wire each Answer node independently with correct dependencies', () => {
      const field1 = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:12000')
        .withProperty('code', 'field1')
        .build()

      const formatPipeline2 = ASTTestFactory.expression(ExpressionType.PIPELINE).withId('pipeline:2').build()

      const field2 = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:13000')
        .withProperty('code', 'field2')
        .withProperty('formatPipeline', formatPipeline2)
        .build()

      const answer1: AnswerPseudoNode = {
        id: 'compile_pseudo:22',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'field1',
          fieldNodeId: 'compile_ast:12000',
        },
      }

      const answer2: AnswerPseudoNode = {
        id: 'compile_pseudo:23',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'field2',
          fieldNodeId: 'compile_ast:13000',
        },
      }

      const post1: PostPseudoNode = {
        id: 'compile_pseudo:24',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'field1',
        },
      }

      const post2: PostPseudoNode = {
        id: 'compile_pseudo:25',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'field2',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(field1.id, field1)
      astRegistry.register(field2.id, field2)
      astRegistry.register(formatPipeline2.id, formatPipeline2)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answer1.id, answer1)
      pseudoRegistry.register(answer2.id, answer2)
      pseudoRegistry.register(post1.id, post1)
      pseudoRegistry.register(post2.id, post2)

      const graph = new DependencyGraph()
      graph.addNode(field1.id)
      graph.addNode(field2.id)
      graph.addNode(formatPipeline2.id)
      graph.addNode(answer1.id)
      graph.addNode(answer2.id)
      graph.addNode(post1.id)
      graph.addNode(post2.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Answer1: POST only
      const deps1 = graph.getDependencies(answer1.id)
      expect(deps1.has(post1.id)).toBe(true)
      expect(deps1.size).toBe(1)

      // Answer2: formatPipeline only (not POST)
      const deps2 = graph.getDependencies(answer2.id)
      expect(deps2.has(formatPipeline2.id)).toBe(true)
      expect(deps2.has(post2.id)).toBe(false)
      expect(deps2.size).toBe(1)
    })
  })

  describe('invalid inputs', () => {
    it('should create edge from only POST to Answer when fieldNodeId is missing', () => {
      // Cross-step reference without fieldNodeId
      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:26',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'previousField',
          // No fieldNodeId
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:27',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'previousField',
        },
      }

      const astRegistry = new NodeRegistry()

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Only POST → Answer (no onLoad wiring without fieldNodeId)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(1)
    })

    it('should not create edges when POST node does not exist', () => {
      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:7000')
        .withProperty('code', 'orphan')
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:13',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'orphan',
          fieldNodeId: 'compile_ast:7000',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(answerPseudo.id)

      const scopeIndex = new MockScopeIndex()

      // Should not throw
      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // No dependencies created
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.size).toBe(0)
    })

    it('should create edge from only POST to Answer when field has no scope', () => {
      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:8000')
        .withProperty('code', 'noScope')
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:14',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'noScope',
          fieldNodeId: 'compile_ast:8000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:15',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'noScope',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()
      // No scope set for field node

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Only POST → Answer (no onLoad without scope)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(1)
    })

    it('should create edge from only POST to Answer when onLoadChain is empty', () => {
      const fieldNode = ASTTestFactory.block('textInput', 'field')
        .withId('compile_ast:9000')
        .withProperty('code', 'emptyOnLoad')
        .build()

      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:16',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'emptyOnLoad',
          fieldNodeId: 'compile_ast:9000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:17',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'emptyOnLoad',
        },
      }

      const astRegistry = new NodeRegistry()
      astRegistry.register(fieldNode.id, fieldNode)

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(fieldNode.id)
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()
      scopeIndex.setScope(fieldNode.id, {
        scopeChain: [{ id: 'compile_pseudo:910', nodeType: ASTNodeType.JOURNEY }],
        onLoadChain: [],
      })

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Only POST → Answer (empty onLoadChain)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(1)
    })

    it('should not create edges for non-Answer pseudo nodes', () => {
      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:28',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'test',
        },
      }

      const astRegistry = new NodeRegistry()

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // No edges created
      const dependencies = graph.getDependencies(postPseudo.id)
      expect(dependencies.size).toBe(0)
    })

    it('should create edge from only POST to Answer when field node does not exist in registry', () => {
      const answerPseudo: AnswerPseudoNode = {
        id: 'compile_pseudo:18',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'missing',
          fieldNodeId: 'compile_ast:10000',
        },
      }

      const postPseudo: PostPseudoNode = {
        id: 'compile_pseudo:19',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'missing',
        },
      }

      const astRegistry = new NodeRegistry()
      // Field node not registered

      const pseudoRegistry = new NodeRegistry()
      pseudoRegistry.register(answerPseudo.id, answerPseudo)
      pseudoRegistry.register(postPseudo.id, postPseudo)

      const graph = new DependencyGraph()
      graph.addNode(answerPseudo.id)
      graph.addNode(postPseudo.id)

      const scopeIndex = new MockScopeIndex()

      wireAnswerPseudoNodes(astRegistry, pseudoRegistry, graph, scopeIndex)

      // Only POST → Answer (no field node means no formatPipeline, defaultValue, or scope)
      const dependencies = graph.getDependencies(answerPseudo.id)
      expect(dependencies.has(postPseudo.id)).toBe(true)
      expect(dependencies.size).toBe(1)
    })
  })
})
