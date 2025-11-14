import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { LogicType, FunctionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PredicateASTNode } from '@form-engine/core/types/expressions.type'
import LogicExpressionWiring from './LogicExpressionWiring'

describe('LogicExpressionWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: LogicExpressionWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      findNodesByType: jest.fn().mockReturnValue([]),
      graph: mockGraph,
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext()
    wiring = new LogicExpressionWiring(mockWiringContext)
  })

  describe('wire', () => {
    describe('TEST expressions (test predicates)', () => {
      it('should wire subject and condition to TEST expression', () => {
        // Arrange
        const subject = ASTTestFactory.reference(['answers', 'age'])
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', [])

        const testExpr = ASTTestFactory.expression(LogicType.TEST)
          .withSubject(subject)
          .withProperty('condition', condition)
          .withProperty('negate', false)
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([testExpr])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(subject.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'subject',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(condition.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'condition',
        })
      })

      it('should not wire primitive subject values', () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', ['John'])

        const testExpr = ASTTestFactory.expression(LogicType.TEST)
          .withProperty('subject', 'John') // Primitive string
          .withProperty('condition', condition)
          .withProperty('negate', false)
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([testExpr])

        // Act
        wiring.wire()

        // Assert - only condition wired (subject is primitive)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(condition.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'condition',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      })
    })

    describe('AND expressions', () => {
      it('should wire operands array to AND expression', () => {
        // Arrange
        const predicate1 = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'field1']),
        })

        const predicate2 = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'field2']),
        })

        const andExpr = ASTTestFactory.expression(LogicType.AND)
          .withProperty('operands', [predicate1, predicate2])
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([andExpr, predicate1, predicate2])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate1.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate2.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 1,
        })
      })
    })

    describe('OR expressions', () => {
      it('should wire operands array to OR expression', () => {
        // Arrange
        const predicate1 = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'field1']),
        })

        const predicate2 = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'field2']),
        })

        const orExpr = ASTTestFactory.expression(LogicType.OR)
          .withProperty('operands', [predicate1, predicate2])
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([orExpr, predicate1, predicate2])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate1.id, orExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate2.id, orExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 1,
        })
      })
    })

    describe('XOR expressions', () => {
      it('should wire operands array to XOR expression', () => {
        // Arrange
        const predicate1 = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'field1']),
        })

        const predicate2 = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'field2']),
        })

        const xorExpr = ASTTestFactory.expression(LogicType.XOR)
          .withProperty('operands', [predicate1, predicate2])
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([xorExpr, predicate1, predicate2])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate1.id, xorExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicate2.id, xorExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 1,
        })
      })
    })

    describe('NOT expressions (unary operator)', () => {
      it('should wire operand to NOT expression', () => {
        // Arrange
        const operandPredicate = ASTTestFactory.expression(LogicType.TEST)
          .withProperty('comparison', 'equals')
          .build()

        const notExpr = ASTTestFactory.expression(LogicType.NOT)
          .withProperty('operand', operandPredicate)
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([notExpr, operandPredicate])

        // Act
        wiring.wire()

        // Assert
        expect(mockGraph.addEdge).toHaveBeenCalledWith(operandPredicate.id, notExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operand',
        })
      })

      it('should not wire primitive operand', () => {
        // Arrange
        const notExpr = ASTTestFactory.expression(LogicType.NOT)
          .withProperty('operand', true) // Primitive boolean
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([notExpr])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })
    })

    describe('complex nested expressions', () => {
      it('should wire complex nested logic expressions', () => {
        // Arrange: (A AND B) OR NOT(C)
        const predicateA = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'a']),
        })

        const predicateB = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'b']),
        })

        const predicateC = ASTTestFactory.predicate(LogicType.TEST, {
          subject: ASTTestFactory.reference(['answers', 'c']),
        })

        const andExpr = ASTTestFactory.expression(LogicType.AND)
          .withProperty('operands', [predicateA, predicateB])
          .build()

        const notExpr = ASTTestFactory.expression(LogicType.NOT)
          .withProperty('operand', predicateC)
          .build()

        const orExpr = ASTTestFactory.expression(LogicType.OR)
          .withProperty('operands', [andExpr, notExpr])
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([orExpr, andExpr, notExpr, predicateA, predicateB, predicateC])

        // Act
        wiring.wire()

        // Assert - verify all edges created
        // AND edges (predicates to AND)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicateA.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicateB.id, andExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 1,
        })

        // NOT edge (predicate to NOT)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(predicateC.id, notExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operand',
        })

        // OR edges (operators to OR)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(andExpr.id, orExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 0,
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(notExpr.id, orExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'operands',
          index: 1,
        })

        // Total: 5 edges above + 3 edges from each TEST predicate wiring its subject (predicateA, B, C each have subjects)
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(8)
      })
    })

    describe('multiple predicate expressions', () => {
      it('should wire multiple independent predicates', () => {
        // Arrange
        const subject1 = ASTTestFactory.reference(['answers', 'field1'])
        const condition1 = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', [])

        const subject2 = ASTTestFactory.reference(['answers', 'field2'])
        const condition2 = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isEmail', [])

        const test1 = ASTTestFactory.expression(LogicType.TEST)
          .withSubject(subject1)
          .withProperty('condition', condition1)
          .withProperty('negate', false)
          .build()

        const test2 = ASTTestFactory.expression(LogicType.TEST)
          .withSubject(subject2)
          .withProperty('condition', condition2)
          .withProperty('negate', false)
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([test1, test2, subject1, subject2])

        // Act
        wiring.wire()

        // Assert - both tests wired (subject and condition for each)
        expect(mockGraph.addEdge).toHaveBeenCalledWith(subject1.id, test1.id, DependencyEdgeType.DATA_FLOW, {
          property: 'subject',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(condition1.id, test1.id, DependencyEdgeType.DATA_FLOW, {
          property: 'condition',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(subject2.id, test2.id, DependencyEdgeType.DATA_FLOW, {
          property: 'subject',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledWith(condition2.id, test2.id, DependencyEdgeType.DATA_FLOW, {
          property: 'condition',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(4)
      })
    })

    describe('edge cases', () => {
      it('should handle no predicate expressions', () => {
        // Arrange
        const nonPredicateExpr = ASTTestFactory.expression(LogicType.CONDITIONAL).build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([nonPredicateExpr])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle empty expression list', () => {
        // Arrange
        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle TEST predicate with missing subject property', () => {
        // Arrange
        const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', [])

        const testExpr = ASTTestFactory.expression<PredicateASTNode>(LogicType.TEST)
          .withProperty('condition', condition)
          .withProperty('negate', false)
          .build()

        // Remove subject property
        delete (testExpr.properties as any).subject

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([testExpr])

        // Act
        wiring.wire()

        // Assert - only condition wired
        expect(mockGraph.addEdge).toHaveBeenCalledWith(condition.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'condition',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      })

      it('should handle TEST predicate with missing condition property', () => {
        // Arrange
        const subject = ASTTestFactory.reference(['answers', 'field'])

        const testExpr = ASTTestFactory.expression<PredicateASTNode>(LogicType.TEST)
          .withSubject(subject)
          .withProperty('negate', false)
          .build()

        // Remove condition property
        delete (testExpr.properties as any).condition

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([testExpr])

        // Act
        wiring.wire()

        // Assert - only subject wired
        expect(mockGraph.addEdge).toHaveBeenCalledWith(subject.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
          property: 'subject',
        })
        expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
      })

      it('should handle unary operator with missing operand property', () => {
        // Arrange
        const notExpr = ASTTestFactory.expression<PredicateASTNode>(LogicType.NOT).build()

        // Remove operand property
        delete (notExpr.properties as any).operand

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([notExpr])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should skip unknown logic types', () => {
        // Arrange
        const subjectRef = ASTTestFactory.reference(['answers', 'field'])

        const unknownExpr = ASTTestFactory.expression('UNKNOWN_TYPE' as LogicType)
          .withProperty('subject', subjectRef)
          .build()

        when(mockWiringContext.findNodesByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([unknownExpr])

        // Act
        wiring.wire()

        // Assert - no edges created (default case in switch)
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })
    })
  })
})
