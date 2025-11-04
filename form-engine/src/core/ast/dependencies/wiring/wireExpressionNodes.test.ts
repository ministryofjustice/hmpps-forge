import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ExpressionType, FunctionType, LogicType } from '@form-engine/form/types/enums'
import {
  PseudoNodeType,
  AnswerPseudoNode,
  DataPseudoNode,
  ParamsPseudoNode,
  PostPseudoNode,
  QueryPseudoNode,
} from '@form-engine/core/types/pseudoNodes.type'
import { wireExpressionNodes } from './wireExpressionNodes'

describe('wireExpressionNodes()', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('valid expression wiring', () => {
    describe('reference expressions', () => {
      it('should create edge from Answer pseudo node to Answer reference', () => {
        const answerReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['answers', 'firstName'])
          .build()

        const answerPseudoNode: AnswerPseudoNode = {
          id: 'compile_pseudo:200',
          type: PseudoNodeType.ANSWER,
          metadata: {
            fieldCode: 'firstName',
          },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(answerReference.id, answerReference)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(answerPseudoNode.id, answerPseudoNode)

        const graph = new DependencyGraph()
        graph.addNode(answerReference.id)
        graph.addNode(answerPseudoNode.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify edge: Answer pseudo node → Reference (pseudo must evaluate before reference)
        const dependencies = graph.getDependencies(answerReference.id)
        expect(dependencies.has(answerPseudoNode.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        // Verify edge type and metadata
        const edges = graph.getEdges(answerPseudoNode.id, answerReference.id)
        expect(edges.length).toBe(1)
        expect(edges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
        expect(edges[0].metadata).toEqual({
          referenceType: 'answers',
          key: 'firstName',
        })
      })

      it('should create edge from Data pseudo node to Data reference', () => {
        const dataReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['data', 'userData'])
          .build()

        const dataPseudoNode: DataPseudoNode = {
          id: 'compile_pseudo:201',
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

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(dataReference.id)
        expect(dependencies.has(dataPseudoNode.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        const edges = graph.getEdges(dataPseudoNode.id, dataReference.id)
        expect(edges[0].metadata).toEqual({
          referenceType: 'data',
          key: 'userData',
        })
      })

      it('should create edge from Query pseudo node to Query reference', () => {
        const queryReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['query', 'returnUrl'])
          .build()

        const queryPseudoNode: QueryPseudoNode = {
          id: 'compile_pseudo:202',
          type: PseudoNodeType.QUERY,
          metadata: {
            paramName: 'returnUrl',
          },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(queryReference.id, queryReference)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(queryPseudoNode.id, queryPseudoNode)

        const graph = new DependencyGraph()
        graph.addNode(queryReference.id)
        graph.addNode(queryPseudoNode.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(queryReference.id)
        expect(dependencies.has(queryPseudoNode.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        const edges = graph.getEdges(queryPseudoNode.id, queryReference.id)
        expect(edges[0].metadata).toEqual({
          referenceType: 'query',
          key: 'returnUrl',
        })
      })

      it('should create edge from Params pseudo node to Params reference', () => {
        const paramsReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['params', 'id'])
          .build()

        const paramsPseudoNode: ParamsPseudoNode = {
          id: 'compile_pseudo:203',
          type: PseudoNodeType.PARAMS,
          metadata: {
            paramName: 'id',
          },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(paramsReference.id, paramsReference)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(paramsPseudoNode.id, paramsPseudoNode)

        const graph = new DependencyGraph()
        graph.addNode(paramsReference.id)
        graph.addNode(paramsPseudoNode.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(paramsReference.id)
        expect(dependencies.has(paramsPseudoNode.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        const edges = graph.getEdges(paramsPseudoNode.id, paramsReference.id)
        expect(edges[0].metadata).toEqual({
          referenceType: 'params',
          key: 'id',
        })
      })

      it('should create edge from Post pseudo node to Post reference', () => {
        const postReference = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['post', 'email'])
          .build()

        const postPseudoNode: PostPseudoNode = {
          id: 'compile_pseudo:204',
          type: PseudoNodeType.POST,
          metadata: {
            fieldCode: 'email',
          },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(postReference.id, postReference)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(postPseudoNode.id, postPseudoNode)

        const graph = new DependencyGraph()
        graph.addNode(postReference.id)
        graph.addNode(postPseudoNode.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(postReference.id)
        expect(dependencies.has(postPseudoNode.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        const edges = graph.getEdges(postPseudoNode.id, postReference.id)
        expect(edges[0].metadata).toEqual({
          referenceType: 'post',
          key: 'email',
        })
      })

      it('should create edges for multiple references to different pseudo nodes', () => {
        const answerRef = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['answers', 'name'])
          .build()

        const dataRef = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:2')
          .withPath(['data', 'user'])
          .build()

        const answerPseudo: AnswerPseudoNode = {
          id: 'compile_pseudo:205',
          type: PseudoNodeType.ANSWER,
          metadata: { fieldCode: 'name' },
        }

        const dataPseudo: DataPseudoNode = {
          id: 'compile_pseudo:206',
          type: PseudoNodeType.DATA,
          metadata: { dataKey: 'user' },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(answerRef.id, answerRef)
        astRegistry.register(dataRef.id, dataRef)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(answerPseudo.id, answerPseudo)
        pseudoRegistry.register(dataPseudo.id, dataPseudo)

        const graph = new DependencyGraph()
        graph.addNode(answerRef.id)
        graph.addNode(dataRef.id)
        graph.addNode(answerPseudo.id)
        graph.addNode(dataPseudo.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify answer reference wired correctly
        const answerDeps = graph.getDependencies(answerRef.id)
        expect(answerDeps.has(answerPseudo.id)).toBe(true)
        expect(answerDeps.size).toBe(1)

        // Verify data reference wired correctly
        const dataDeps = graph.getDependencies(dataRef.id)
        expect(dataDeps.has(dataPseudo.id)).toBe(true)
        expect(dataDeps.size).toBe(1)
      })
    })

    describe('conditional expressions', () => {
      it('should create edges from predicate, then, and else branches to conditional', () => {
        const predicate = ASTTestFactory.expression(LogicType.TEST).withId('compile_ast:1').build()

        const thenValue = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:2')
          .withPath(['data', 'value1'])
          .build()

        const elseValue = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:3')
          .withPath(['data', 'value2'])
          .build()

        const conditional = ASTTestFactory.expression(LogicType.CONDITIONAL)
          .withId('compile_ast:4')
          .withProperty('predicate', predicate)
          .withProperty('then', thenValue)
          .withProperty('else', elseValue)
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(predicate.id, predicate)
        astRegistry.register(thenValue.id, thenValue)
        astRegistry.register(elseValue.id, elseValue)
        astRegistry.register(conditional.id, conditional)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(predicate.id)
        graph.addNode(thenValue.id)
        graph.addNode(elseValue.id)
        graph.addNode(conditional.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify dependencies: predicate, then, else → conditional
        const dependencies = graph.getDependencies(conditional.id)
        expect(dependencies.has(predicate.id)).toBe(true)
        expect(dependencies.has(thenValue.id)).toBe(true)
        expect(dependencies.has(elseValue.id)).toBe(true)
        expect(dependencies.size).toBe(3)

        // Verify edge metadata
        const predicateEdges = graph.getEdges(predicate.id, conditional.id)
        expect(predicateEdges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
        expect(predicateEdges[0].metadata).toEqual({ property: 'predicate' })

        const thenEdges = graph.getEdges(thenValue.id, conditional.id)
        expect(thenEdges[0].metadata).toEqual({ property: 'then' })

        const elseEdges = graph.getEdges(elseValue.id, conditional.id)
        expect(elseEdges[0].metadata).toEqual({ property: 'else' })
      })

      it('should create edges from predicate and then only when no else branch', () => {
        const predicate = ASTTestFactory.expression(LogicType.TEST).withId('compile_ast:1').build()

        const thenValue = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:2')
          .withPath(['data', 'value'])
          .build()

        const conditional = ASTTestFactory.expression(LogicType.CONDITIONAL)
          .withId('compile_ast:3')
          .withProperty('predicate', predicate)
          .withProperty('then', thenValue)
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(predicate.id, predicate)
        astRegistry.register(thenValue.id, thenValue)
        astRegistry.register(conditional.id, conditional)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(predicate.id)
        graph.addNode(thenValue.id)
        graph.addNode(conditional.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(conditional.id)
        expect(dependencies.has(predicate.id)).toBe(true)
        expect(dependencies.has(thenValue.id)).toBe(true)
        expect(dependencies.size).toBe(2)
      })
    })

    describe('pipeline expressions', () => {
      it('should create edges from input and transformers to pipeline', () => {
        const input = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['answers', 'email'])
          .build()

        const transformer1 = ASTTestFactory.expression(FunctionType.TRANSFORMER).withId('compile_ast:2').build()

        const transformer2 = ASTTestFactory.expression(FunctionType.TRANSFORMER).withId('compile_ast:3').build()

        const pipeline = ASTTestFactory.expression(ExpressionType.PIPELINE)
          .withId('compile_ast:4')
          .withProperty('input', input)
          .withProperty('transformers', [transformer1, transformer2])
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(input.id, input)
        astRegistry.register(transformer1.id, transformer1)
        astRegistry.register(transformer2.id, transformer2)
        astRegistry.register(pipeline.id, pipeline)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(input.id)
        graph.addNode(transformer1.id)
        graph.addNode(transformer2.id)
        graph.addNode(pipeline.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify dependencies: input, transformers → pipeline
        const dependencies = graph.getDependencies(pipeline.id)
        expect(dependencies.has(input.id)).toBe(true)
        expect(dependencies.has(transformer1.id)).toBe(true)
        expect(dependencies.has(transformer2.id)).toBe(true)
        expect(dependencies.size).toBe(3)

        // Verify edge metadata includes index for transformers
        const inputEdges = graph.getEdges(input.id, pipeline.id)
        expect(inputEdges[0].metadata).toEqual({ property: 'input' })

        const transformer1Edges = graph.getEdges(transformer1.id, pipeline.id)
        expect(transformer1Edges[0].metadata).toEqual({
          property: 'transformers',
          index: 0,
        })

        const transformer2Edges = graph.getEdges(transformer2.id, pipeline.id)
        expect(transformer2Edges[0].metadata).toEqual({
          property: 'transformers',
          index: 1,
        })
      })

      it('should create edge from only input when transformers array is empty', () => {
        const input = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['answers', 'email'])
          .build()

        const pipeline = ASTTestFactory.expression(ExpressionType.PIPELINE)
          .withId('compile_ast:2')
          .withProperty('input', input)
          .withProperty('transformers', []) // Empty array - no transformers
          .build()

        const answerPseudo: AnswerPseudoNode = {
          id: 'compile_pseudo:207',
          type: PseudoNodeType.ANSWER,
          metadata: { fieldCode: 'email' },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(input.id, input)
        astRegistry.register(pipeline.id, pipeline)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(answerPseudo.id, answerPseudo)

        const graph = new DependencyGraph()
        graph.addNode(input.id)
        graph.addNode(pipeline.id)
        graph.addNode(answerPseudo.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Should only wire input, not transformers
        const dependencies = graph.getDependencies(pipeline.id)
        expect(dependencies.has(input.id)).toBe(true)
        expect(dependencies.size).toBe(1)
      })

      it('should create edges only for valid AST nodes in transformers array', () => {
        const transformer = ASTTestFactory.expression(FunctionType.TRANSFORMER).withId('compile_ast:1').build()

        const pipeline = ASTTestFactory.expression(ExpressionType.PIPELINE)
          .withId('compile_ast:2')
          .withProperty('transformers', [
            'literalString', // Non-AST node
            transformer, // AST node
            123, // Non-AST node
          ])
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(transformer.id, transformer)
        astRegistry.register(pipeline.id, pipeline)

        const pseudoRegistry = new NodeRegistry()
        const graph = new DependencyGraph()
        graph.addNode(transformer.id)
        graph.addNode(pipeline.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Only the transformer should be wired
        const dependencies = graph.getDependencies(pipeline.id)
        expect(dependencies.has(transformer.id)).toBe(true)
        expect(dependencies.size).toBe(1)
      })
    })

    describe('format expressions', () => {
      it('should create edges from arguments to format expression', () => {
        const arg1 = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['answers', 'firstName'])
          .build()

        const arg2 = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:2')
          .withPath(['answers', 'lastName'])
          .build()

        const formatExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withId('compile_ast:3')
          .withProperty('arguments', [arg1, arg2])
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(arg1.id, arg1)
        astRegistry.register(arg2.id, arg2)
        astRegistry.register(formatExpr.id, formatExpr)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(arg1.id)
        graph.addNode(arg2.id)
        graph.addNode(formatExpr.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify dependencies with index metadata
        const dependencies = graph.getDependencies(formatExpr.id)
        expect(dependencies.has(arg1.id)).toBe(true)
        expect(dependencies.has(arg2.id)).toBe(true)
        expect(dependencies.size).toBe(2)

        const arg1Edges = graph.getEdges(arg1.id, formatExpr.id)
        expect(arg1Edges[0].metadata).toEqual({ property: 'arguments', index: 0 })

        const arg2Edges = graph.getEdges(arg2.id, formatExpr.id)
        expect(arg2Edges[0].metadata).toEqual({ property: 'arguments', index: 1 })
      })

      it('should create edges only for valid AST nodes in arguments array', () => {
        const arg = ASTTestFactory.expression(ExpressionType.REFERENCE)
          .withId('compile_ast:1')
          .withPath(['data', 'value'])
          .build()

        const formatExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withId('compile_ast:2')
          .withProperty('arguments', ['literal', arg, 123])
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(arg.id, arg)
        astRegistry.register(formatExpr.id, formatExpr)

        const pseudoRegistry = new NodeRegistry()
        const graph = new DependencyGraph()
        graph.addNode(arg.id)
        graph.addNode(formatExpr.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(formatExpr.id)
        expect(dependencies.has(arg.id)).toBe(true)
        expect(dependencies.size).toBe(1)
      })
    })

    describe('function expressions', () => {
      it('should create edges from arguments to function expression', () => {
        const arg1 = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['answers', 'age']).build()

        const arg2 = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['data', 'minAge']).build()

        const functionExpr = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'greaterThan', [arg1, arg2])

        const astRegistry = new NodeRegistry()
        astRegistry.register(arg1.id, arg1)
        astRegistry.register(arg2.id, arg2)
        astRegistry.register(functionExpr.id, functionExpr)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(arg1.id)
        graph.addNode(arg2.id)
        graph.addNode(functionExpr.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(functionExpr.id)
        expect(dependencies.has(arg1.id)).toBe(true)
        expect(dependencies.has(arg2.id)).toBe(true)
        expect(dependencies.size).toBe(2)
      })
    })

    describe('predicate expressions', () => {
      it('should create edges from subject and condition to TEST predicate', () => {
        const subject = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['answers', 'email']).build()

        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isEmail')

        const testPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject,
          condition,
        })

        const astRegistry = new NodeRegistry()
        astRegistry.register(subject.id, subject)
        astRegistry.register(condition.id, condition)
        astRegistry.register(testPredicate.id, testPredicate)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(subject.id)
        graph.addNode(condition.id)
        graph.addNode(testPredicate.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(testPredicate.id)
        expect(dependencies.has(subject.id)).toBe(true)
        expect(dependencies.has(condition.id)).toBe(true)
        expect(dependencies.size).toBe(2)

        const subjectEdges = graph.getEdges(subject.id, testPredicate.id)
        expect(subjectEdges[0].metadata).toEqual({ property: 'subject' })

        const conditionEdges = graph.getEdges(condition.id, testPredicate.id)
        expect(conditionEdges[0].metadata).toEqual({ property: 'condition' })
      })

      it('should create edge from operand to NOT predicate', () => {
        const operand = ASTTestFactory.expression(LogicType.TEST).build()

        const notPredicate = ASTTestFactory.predicate(LogicType.NOT, { operand })

        const astRegistry = new NodeRegistry()
        astRegistry.register(operand.id, operand)
        astRegistry.register(notPredicate.id, notPredicate)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(operand.id)
        graph.addNode(notPredicate.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(notPredicate.id)
        expect(dependencies.has(operand.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        const edges = graph.getEdges(operand.id, notPredicate.id)
        expect(edges[0].metadata).toEqual({ property: 'operand' })
      })

      it('should create edges from multiple operands to AND predicate', () => {
        const operand1 = ASTTestFactory.expression(LogicType.TEST).build()

        const operand2 = ASTTestFactory.expression(LogicType.TEST).build()

        const operand3 = ASTTestFactory.expression(LogicType.TEST).build()

        const andPredicate = ASTTestFactory.predicate(LogicType.AND, {
          operands: [operand1, operand2, operand3],
        })

        const astRegistry = new NodeRegistry()
        astRegistry.register(operand1.id, operand1)
        astRegistry.register(operand2.id, operand2)
        astRegistry.register(operand3.id, operand3)
        astRegistry.register(andPredicate.id, andPredicate)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(operand1.id)
        graph.addNode(operand2.id)
        graph.addNode(operand3.id)
        graph.addNode(andPredicate.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(andPredicate.id)
        expect(dependencies.has(operand1.id)).toBe(true)
        expect(dependencies.has(operand2.id)).toBe(true)
        expect(dependencies.has(operand3.id)).toBe(true)
        expect(dependencies.size).toBe(3)

        // Verify index metadata
        const edges1 = graph.getEdges(operand1.id, andPredicate.id)
        expect(edges1[0].metadata).toEqual({ property: 'operands', index: 0 })

        const edges2 = graph.getEdges(operand2.id, andPredicate.id)
        expect(edges2[0].metadata).toEqual({ property: 'operands', index: 1 })

        const edges3 = graph.getEdges(operand3.id, andPredicate.id)
        expect(edges3[0].metadata).toEqual({ property: 'operands', index: 2 })
      })

      it('should create edges from multiple operands to OR predicate', () => {
        const operand1 = ASTTestFactory.expression(LogicType.TEST).build()

        const operand2 = ASTTestFactory.expression(LogicType.TEST).build()

        const orPredicate = ASTTestFactory.predicate(LogicType.OR, {
          operands: [operand1, operand2],
        })

        const astRegistry = new NodeRegistry()
        astRegistry.register(operand1.id, operand1)
        astRegistry.register(operand2.id, operand2)
        astRegistry.register(orPredicate.id, orPredicate)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(operand1.id)
        graph.addNode(operand2.id)
        graph.addNode(orPredicate.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(orPredicate.id)
        expect(dependencies.size).toBe(2)
      })

      it('should create edges from multiple operands to XOR predicate', () => {
        const operand1 = ASTTestFactory.expression(LogicType.TEST).build()

        const operand2 = ASTTestFactory.expression(LogicType.TEST).build()

        const xorPredicate = ASTTestFactory.predicate(LogicType.XOR, {
          operands: [operand1, operand2],
        })

        const astRegistry = new NodeRegistry()
        astRegistry.register(operand1.id, operand1)
        astRegistry.register(operand2.id, operand2)
        astRegistry.register(xorPredicate.id, xorPredicate)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(operand1.id)
        graph.addNode(operand2.id)
        graph.addNode(xorPredicate.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(xorPredicate.id)
        expect(dependencies.size).toBe(2)
      })

      it('should create edges only for valid AST nodes in operands array', () => {
        const operand = ASTTestFactory.expression(LogicType.TEST).build()

        const andPredicate = ASTTestFactory.predicate(LogicType.AND, {
          operands: ['literal', operand, 123] as any, // Intentionally testing invalid data
        })

        const astRegistry = new NodeRegistry()
        astRegistry.register(operand.id, operand)
        astRegistry.register(andPredicate.id, andPredicate)

        const pseudoRegistry = new NodeRegistry()
        const graph = new DependencyGraph()
        graph.addNode(operand.id)
        graph.addNode(andPredicate.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(andPredicate.id)
        expect(dependencies.has(operand.id)).toBe(true)
        expect(dependencies.size).toBe(1)
      })
    })

    describe('validation expressions', () => {
      it('should create edge from condition to validation expression', () => {
        const condition = ASTTestFactory.expression(LogicType.TEST).withId('compile_ast:1').build()

        const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
          .withId('compile_ast:2')
          .withProperty('condition', condition)
          .build()

        const astRegistry = new NodeRegistry()
        astRegistry.register(condition.id, condition)
        astRegistry.register(validation.id, validation)

        const pseudoRegistry = new NodeRegistry()

        const graph = new DependencyGraph()
        graph.addNode(condition.id)
        graph.addNode(validation.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        const dependencies = graph.getDependencies(validation.id)
        expect(dependencies.has(condition.id)).toBe(true)
        expect(dependencies.size).toBe(1)

        const edges = graph.getEdges(condition.id, validation.id)
        expect(edges[0].type).toBe(DependencyEdgeType.DATA_FLOW)
        expect(edges[0].metadata).toEqual({ property: 'condition' })
      })
    })

    describe('complex scenarios', () => {
      it('should create edges for nested expression hierarchies', () => {
        // Create: when(Answer('showEmail')).then(Data('email')).else('default')
        const answerRef = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['answers', 'showEmail']).build()

        const dataRef = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['data', 'email']).build()

        const testPredicate = ASTTestFactory.predicate(LogicType.TEST, {
          subject: answerRef,
        })

        const conditional = ASTTestFactory.expression(LogicType.CONDITIONAL)
          .withProperty('predicate', testPredicate)
          .withProperty('then', dataRef)
          .withProperty('else', 'default')
          .build()

        const answerPseudo: AnswerPseudoNode = {
          id: 'compile_pseudo:208',
          type: PseudoNodeType.ANSWER,
          metadata: { fieldCode: 'showEmail' },
        }

        const dataPseudo: DataPseudoNode = {
          id: 'compile_pseudo:209',
          type: PseudoNodeType.DATA,
          metadata: { dataKey: 'email' },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(answerRef.id, answerRef)
        astRegistry.register(dataRef.id, dataRef)
        astRegistry.register(testPredicate.id, testPredicate)
        astRegistry.register(conditional.id, conditional)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(answerPseudo.id, answerPseudo)
        pseudoRegistry.register(dataPseudo.id, dataPseudo)

        const graph = new DependencyGraph()
        graph.addNode(answerRef.id)
        graph.addNode(dataRef.id)
        graph.addNode(testPredicate.id)
        graph.addNode(conditional.id)
        graph.addNode(answerPseudo.id)
        graph.addNode(dataPseudo.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify answer reference → pseudo
        expect(graph.getDependencies(answerRef.id).has(answerPseudo.id)).toBe(true)

        // Verify data reference → pseudo
        expect(graph.getDependencies(dataRef.id).has(dataPseudo.id)).toBe(true)

        // Verify predicate → subject
        expect(graph.getDependencies(testPredicate.id).has(answerRef.id)).toBe(true)

        // Verify conditional → predicate and then branch
        const conditionalDeps = graph.getDependencies(conditional.id)
        expect(conditionalDeps.has(testPredicate.id)).toBe(true)
        expect(conditionalDeps.has(dataRef.id)).toBe(true)
      })

      it('should create edges for multiple expression types in same registry', () => {
        const answerRef = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['answers', 'name']).build()

        const formatArg = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['data', 'prefix']).build()

        const formatExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
          .withProperty('arguments', [formatArg])
          .build()

        const pipelineInput = ASTTestFactory.expression(ExpressionType.REFERENCE).withPath(['answers', 'email']).build()

        const pipeline = ASTTestFactory.expression(ExpressionType.PIPELINE)
          .withProperty('input', pipelineInput)
          .withProperty('transformers', [])
          .build()

        const answerPseudo: AnswerPseudoNode = {
          id: 'compile_pseudo:205',
          type: PseudoNodeType.ANSWER,
          metadata: { fieldCode: 'name' },
        }

        const emailPseudo: AnswerPseudoNode = {
          id: 'compile_pseudo:207',
          type: PseudoNodeType.ANSWER,
          metadata: { fieldCode: 'email' },
        }

        const dataPseudo: DataPseudoNode = {
          id: 'compile_pseudo:210',
          type: PseudoNodeType.DATA,
          metadata: { dataKey: 'prefix' },
        }

        const astRegistry = new NodeRegistry()
        astRegistry.register(answerRef.id, answerRef)
        astRegistry.register(formatArg.id, formatArg)
        astRegistry.register(formatExpr.id, formatExpr)
        astRegistry.register(pipelineInput.id, pipelineInput)
        astRegistry.register(pipeline.id, pipeline)

        const pseudoRegistry = new NodeRegistry()
        pseudoRegistry.register(answerPseudo.id, answerPseudo)
        pseudoRegistry.register(emailPseudo.id, emailPseudo)
        pseudoRegistry.register(dataPseudo.id, dataPseudo)

        const graph = new DependencyGraph()
        graph.addNode(answerRef.id)
        graph.addNode(formatArg.id)
        graph.addNode(formatExpr.id)
        graph.addNode(pipelineInput.id)
        graph.addNode(pipeline.id)
        graph.addNode(answerPseudo.id)
        graph.addNode(emailPseudo.id)
        graph.addNode(dataPseudo.id)

        wireExpressionNodes(astRegistry, pseudoRegistry, graph)

        // Verify all wiring occurred correctly
        expect(graph.getDependencies(answerRef.id).has(answerPseudo.id)).toBe(true)
        expect(graph.getDependencies(formatArg.id).has(dataPseudo.id)).toBe(true)
        expect(graph.getDependencies(formatExpr.id).has(formatArg.id)).toBe(true)
        expect(graph.getDependencies(pipelineInput.id).has(emailPseudo.id)).toBe(true)
        expect(graph.getDependencies(pipeline.id).has(pipelineInput.id)).toBe(true)
      })
    })
  })

  describe('invalid inputs', () => {
    it('should not create edges when reference pseudo node does not exist', () => {
      const reference = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:1')
        .withPath(['answers', 'nonExistent'])
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(reference.id, reference)

      const pseudoRegistry = new NodeRegistry()
      // No pseudo node registered

      const graph = new DependencyGraph()
      graph.addNode(reference.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      // No dependencies should be created
      const dependencies = graph.getDependencies(reference.id)
      expect(dependencies.size).toBe(0)
    })

    it('should not create edges for reference with invalid path structure', () => {
      const shortPath = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:1')
        .withPath(['answers']) // Only one element
        .build()

      const emptyPath = ASTTestFactory.expression(ExpressionType.REFERENCE).withId('compile_ast:2').withPath([]).build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(shortPath.id, shortPath)
      astRegistry.register(emptyPath.id, emptyPath)

      const pseudoRegistry = new NodeRegistry()
      const graph = new DependencyGraph()
      graph.addNode(shortPath.id)
      graph.addNode(emptyPath.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      expect(graph.getDependencies(shortPath.id).size).toBe(0)
      expect(graph.getDependencies(emptyPath.id).size).toBe(0)
    })

    it('should not create edges for reference with non-string key', () => {
      const refWithNumberKey = ASTTestFactory.expression(ExpressionType.REFERENCE)
        .withId('compile_ast:1')
        .withProperty('path', ['answers', 123]) // Number instead of string
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(refWithNumberKey.id, refWithNumberKey)

      const pseudoRegistry = new NodeRegistry()
      const graph = new DependencyGraph()
      graph.addNode(refWithNumberKey.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      expect(graph.getDependencies(refWithNumberKey.id).size).toBe(0)
    })

    it('should not create edges when conditional branches are literal values', () => {
      const conditional = ASTTestFactory.expression(LogicType.CONDITIONAL)
        .withId('compile_ast:1')
        .withProperty('predicate', true) // Literal value
        .withProperty('then', 'value1') // Literal value
        .withProperty('else', 'value2') // Literal value
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(conditional.id, conditional)

      const pseudoRegistry = new NodeRegistry()
      const graph = new DependencyGraph()
      graph.addNode(conditional.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      // No dependencies should be created (all values are literals)
      expect(graph.getDependencies(conditional.id).size).toBe(0)
    })

    it('should not create edges when pipeline input is literal value', () => {
      const pipeline = ASTTestFactory.expression(ExpressionType.PIPELINE)
        .withId('compile_ast:1')
        .withProperty('input', 'literalValue')
        .withProperty('transformers', [])
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(pipeline.id, pipeline)

      const pseudoRegistry = new NodeRegistry()
      const graph = new DependencyGraph()
      graph.addNode(pipeline.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      expect(graph.getDependencies(pipeline.id).size).toBe(0)
    })

    it('should not create edges when format arguments array is empty', () => {
      const formatExpr = ASTTestFactory.expression(ExpressionType.FORMAT)
        .withId('compile_ast:1')
        .withProperty('template', 'Static text only')
        .withProperty('arguments', []) // No arguments
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(formatExpr.id, formatExpr)

      const pseudoRegistry = new NodeRegistry()
      const graph = new DependencyGraph()
      graph.addNode(formatExpr.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      // No dependencies should be created
      expect(graph.getDependencies(formatExpr.id).size).toBe(0)
    })

    it('should not create edges when validation condition is literal value', () => {
      const validation = ASTTestFactory.expression(ExpressionType.VALIDATION)
        .withId('compile_ast:1')
        .withProperty('condition', true) // Literal boolean
        .build()

      const astRegistry = new NodeRegistry()
      astRegistry.register(validation.id, validation)

      const pseudoRegistry = new NodeRegistry()
      const graph = new DependencyGraph()
      graph.addNode(validation.id)

      wireExpressionNodes(astRegistry, pseudoRegistry, graph)

      expect(graph.getDependencies(validation.id).size).toBe(0)
    })
  })
})
