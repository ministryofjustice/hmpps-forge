import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType } from '@form-engine/form/types/enums'
import { NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import { PseudoNode, PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import NodeRegistry from './NodeRegistry'
import PseudoNodeTraverser from './PseudoNodeTraverser'

describe('PseudoNodeTraverser', () => {
  let nodeIdGenerator: NodeIDGenerator
  let pseudoNodeFactory: PseudoNodeFactory
  let pseudoNodeRegistry: NodeRegistry
  let traverser: PseudoNodeTraverser

  beforeEach(() => {
    ASTTestFactory.resetIds()
    nodeIdGenerator = new NodeIDGenerator()
    pseudoNodeFactory = new PseudoNodeFactory(nodeIdGenerator)
    pseudoNodeRegistry = new NodeRegistry()
    traverser = new PseudoNodeTraverser(pseudoNodeRegistry, pseudoNodeFactory)
  })

  describe('register', () => {
    it('should create POST and ANSWER pseudo nodes from field blocks', () => {
      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('firstName').withLabel('First Name'),
            )
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:4').withCode('email').withLabel('Email'),
            ),
        )
        .build()

      traverser.register(journey)

      // Should have 2 POST nodes + 2 ANSWER nodes = 4 pseudo nodes
      expect(pseudoNodeRegistry.size()).toBe(4)

      // Check POST nodes exist
      const allNodes = pseudoNodeRegistry.getAll()
      const postNodes = Array.from(allNodes.values()).filter((node: PseudoNode) => node.type === PseudoNodeType.POST)

      expect(postNodes.length).toBe(2)
      expect(postNodes[0].metadata.fieldCode).toMatch(/firstName|email/)
      expect(postNodes[1].metadata.fieldCode).toMatch(/firstName|email/)

      // Check ANSWER nodes exist
      const answerNodes = Array.from(allNodes.values()).filter(
        (node: PseudoNode) => node.type === PseudoNodeType.ANSWER,
      )

      expect(answerNodes.length).toBe(2)
      expect(answerNodes[0].metadata.fieldCode).toMatch(/firstName|email/)
      expect(answerNodes[1].metadata.fieldCode).toMatch(/firstName|email/)
    })

    it('should create QUERY pseudo nodes from query references', () => {
      const queryExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:4')
        .withPath(['query', 'returnUrl'])
        .build()

      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('url').withProperty('defaultValue', queryExpr),
            ),
        )
        .build()

      traverser.register(journey)

      // Should have POST:url, ANSWER:url, QUERY:returnUrl
      expect(pseudoNodeRegistry.size()).toBe(3)

      const allNodes = pseudoNodeRegistry.getAll()
      const queryNodes = Array.from(allNodes.values()).filter((node: PseudoNode) => node.type === PseudoNodeType.QUERY)

      expect(queryNodes.length).toBe(1)
      expect(queryNodes[0].metadata.paramName).toBe('returnUrl')
    })

    it('should create PARAMS pseudo nodes from params references', () => {
      const paramsExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:4')
        .withPath(['params', 'assessmentId'])
        .build()

      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('id').withProperty('defaultValue', paramsExpr),
            ),
        )
        .build()

      traverser.register(journey)

      const allNodes = pseudoNodeRegistry.getAll()
      const paramsNodes = Array.from(allNodes.values()).filter(
        (node: PseudoNode) => node.type === PseudoNodeType.PARAMS,
      )

      expect(paramsNodes.length).toBe(1)
      expect(paramsNodes[0].metadata.paramName).toBe('assessmentId')
    })

    it('should create DATA pseudo nodes from data references', () => {
      const dataExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:4')
        .withPath(['data', 'currentUser'])
        .build()

      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('name').withProperty('defaultValue', dataExpr),
            ),
        )
        .build()

      traverser.register(journey)

      const allNodes = pseudoNodeRegistry.getAll()
      const dataNodes = Array.from(allNodes.values()).filter((node: PseudoNode) => node.type === PseudoNodeType.DATA)

      expect(dataNodes.length).toBe(1)
      expect(dataNodes[0].metadata.dataKey).toBe('currentUser')
    })

    it('should deduplicate pseudo nodes with same field code', () => {
      const answerRef = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:5')
        .withPath(['answers', 'email'])
        .build()

      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('email').withLabel('Email'),
            )
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:4').withCode('confirmEmail').withProperty('defaultValue', answerRef),
            ),
        )
        .build()

      traverser.register(journey)

      // Should have: POST:email, ANSWER:email, POST:confirmEmail, ANSWER:confirmEmail
      // Note: Answer reference to 'email' reuses existing ANSWER:email node
      expect(pseudoNodeRegistry.size()).toBe(4)
    })

    it('should create all pseudo node types in complex form', () => {
      const queryExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:5')
        .withPath(['query', 'prefill'])
        .build()

      const paramsExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:6')
        .withPath(['params', 'userId'])
        .build()

      const dataExpr = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:7')
        .withPath(['data', 'userData'])
        .build()

      const journey = ASTTestFactory.journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:3').withCode('name').withProperty('defaultValue', queryExpr),
            )
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:4').withCode('id').withProperty('defaultValue', paramsExpr),
            ),
        )
        .withStep(step =>
          step
            .withId('compile_ast:8')
            .withBlock('TextInput', 'field', block =>
              block.withId('compile_ast:9').withCode('details').withProperty('defaultValue', dataExpr),
            ),
        )
        .build()

      traverser.register(journey)

      const allNodes = pseudoNodeRegistry.getAll()

      // Count by type
      const postNodes = Array.from(allNodes.values()).filter((node: any) => node.type === PseudoNodeType.POST)
      const answerNodes = Array.from(allNodes.values()).filter((node: any) => node.type === PseudoNodeType.ANSWER)
      const queryNodes = Array.from(allNodes.values()).filter((node: any) => node.type === PseudoNodeType.QUERY)
      const paramsNodes = Array.from(allNodes.values()).filter((node: any) => node.type === PseudoNodeType.PARAMS)
      const dataNodes = Array.from(allNodes.values()).filter((node: any) => node.type === PseudoNodeType.DATA)

      expect(postNodes.length).toBe(3) // name, id, details
      expect(answerNodes.length).toBe(3) // name, id, details
      expect(queryNodes.length).toBe(1) // prefill
      expect(paramsNodes.length).toBe(1) // userId
      expect(dataNodes.length).toBe(1) // userData

      // Total: 3 + 3 + 1 + 1 + 1 = 9
      expect(pseudoNodeRegistry.size()).toBe(9)
    })
  })
})
