import { ExpressionType, FunctionType, PredicateType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/ast.type'
import { ASTNodeType } from '../../../chassis/contracts/ast/enums'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import RequestTimeReferenceAnalyzer from './RequestTimeReferenceAnalyzer'

describe('RequestTimeReferenceAnalyzer', () => {
  let analyzer: RequestTimeReferenceAnalyzer

  beforeEach(() => {
    ASTTestFactory.resetIds()
    analyzer = new RequestTimeReferenceAnalyzer()
  })

  describe('containsRequestTimeReference()', () => {
    it.each(['post', 'params', 'query', 'request'])(
      'should return true when a reference starts with the %s namespace',
      namespace => {
        // Arrange
        const reference = ASTTestFactory.reference([namespace, 'value'])

        // Act
        const result = analyzer.containsRequestTimeReference(reference)

        // Assert
        expect(result).toBe(true)
      },
    )

    it('should return true when a nested function argument references request-time state', () => {
      // Arrange
      const queryReference = ASTTestFactory.reference(['query', 'mode'])
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['answers', 'choice']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', [queryReference]),
      }) as ASTNode

      // Act
      const result = analyzer.containsRequestTimeReference(predicate)

      // Assert
      expect(result).toBe(true)
    })

    it('should return true when a plain object property contains a request-time reference', () => {
      // Arrange
      const matchExpression = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.MATCH,
        id: ASTTestFactory.getId(),
        diagnostics: ASTTestFactory.diagnostics(),
        properties: {
          branches: [
            {
              predicate: ASTTestFactory.reference(['params', 'kind']),
              value: 'matched',
            },
          ],
        },
      } as ASTNode

      // Act
      const result = analyzer.containsRequestTimeReference(matchExpression)

      // Assert
      expect(result).toBe(true)
    })

    it('should return false when references only use stable namespaces', () => {
      // Arrange
      const predicate = ASTTestFactory.predicate(PredicateType.TEST, {
        subject: ASTTestFactory.reference(['answers', 'choice']),
        condition: ASTTestFactory.functionExpression(FunctionType.CONDITION, 'equals', [
          ASTTestFactory.reference(['data', 'expectedChoice']),
        ]),
      }) as ASTNode

      // Act
      const result = analyzer.containsRequestTimeReference(predicate)

      // Assert
      expect(result).toBe(false)
    })

    it.each(['answers', 'data', 'session', 'requester'])(
      'should return false when a reference starts with the stable %s namespace',
      namespace => {
        // Arrange
        const reference = ASTTestFactory.reference([namespace, 'value'])

        // Act
        const result = analyzer.containsRequestTimeReference(reference)

        // Assert
        expect(result).toBe(false)
      },
    )
  })
})
