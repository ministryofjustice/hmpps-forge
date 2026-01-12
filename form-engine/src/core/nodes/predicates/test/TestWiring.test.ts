import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { PredicateType, FunctionType } from '@form-engine/form/types/enums'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { TestPredicateASTNode } from '@form-engine/core/types/predicates.type'
import TestWiring from './TestWiring'

describe('TestWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: TestWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      nodeRegistry: {
        findByType: jest.fn().mockReturnValue([]),
        get: jest.fn(),
      },
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
    wiring = new TestWiring(mockWiringContext)
  })

  describe('wire()', () => {
    it('should wire subject and condition to TEST expression', () => {
      // Arrange
      const subject = ASTTestFactory.reference(['answers', 'age'])
      const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', [])

      const testExpr = ASTTestFactory.expression(PredicateType.TEST)
        .withSubject(subject)
        .withProperty('condition', condition)
        .withProperty('negate', false)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
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

      const testExpr = ASTTestFactory.expression(PredicateType.TEST)
        .withProperty('subject', 'John') // Primitive string
        .withProperty('condition', condition)
        .withProperty('negate', false)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([testExpr])

      // Act
      wiring.wire()

      // Assert - only condition wired (subject is primitive)
      expect(mockGraph.addEdge).toHaveBeenCalledWith(condition.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'condition',
      })

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
    })

    it('should wire multiple independent TEST predicates', () => {
      // Arrange
      const subject1 = ASTTestFactory.reference(['answers', 'field1'])
      const condition1 = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', [])

      const subject2 = ASTTestFactory.reference(['answers', 'field2'])
      const condition2 = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isEmail', [])

      const test1 = ASTTestFactory.expression(PredicateType.TEST)
        .withSubject(subject1)
        .withProperty('condition', condition1)
        .withProperty('negate', false)
        .build()

      const test2 = ASTTestFactory.expression(PredicateType.TEST)
        .withSubject(subject2)
        .withProperty('condition', condition2)
        .withProperty('negate', false)
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
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

    it('should handle TEST predicate with missing subject property', () => {
      // Arrange
      const condition = ASTTestFactory.functionExpression(FunctionType.CONDITION, 'isRequired', [])

      const testExpr = ASTTestFactory.expression<TestPredicateASTNode>(PredicateType.TEST)
        .withProperty('condition', condition)
        .withProperty('negate', false)
        .build()

      // Remove subject property
      delete (testExpr.properties as any).subject

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
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

      const testExpr = ASTTestFactory.expression<TestPredicateASTNode>(PredicateType.TEST)
        .withSubject(subject)
        .withProperty('negate', false)
        .build()

      // Remove condition property
      delete (testExpr.properties as any).condition

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([testExpr])

      // Act
      wiring.wire()

      // Assert - only subject wired
      expect(mockGraph.addEdge).toHaveBeenCalledWith(subject.id, testExpr.id, DependencyEdgeType.DATA_FLOW, {
        property: 'subject',
      })

      expect(mockGraph.addEdge).toHaveBeenCalledTimes(1)
    })

    it('should not wire non-TEST expressions', () => {
      // Arrange
      const andExpr = ASTTestFactory.expression(PredicateType.AND)
        .withProperty('operands', [])
        .build()

      when(mockWiringContext.nodeRegistry.findByType)
        .calledWith(ASTNodeType.PREDICATE)
        .mockReturnValue([andExpr])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).not.toHaveBeenCalled()
    })
  })
})
