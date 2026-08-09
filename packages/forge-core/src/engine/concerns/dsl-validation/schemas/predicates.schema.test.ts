import { ConditionNotExprSchema, MatchBranchSchema, MatchExprSchema } from './predicates.schema'
import { ConditionCombinatorType, ExpressionType, FunctionType, PredicateType } from '../../../../authoring/types/enums'

describe('predicates.schema', () => {
  const condition = (value: string) => ({ type: FunctionType.CONDITION, name: 'Equals', arguments: [value] })

  const matchOn = (branchCondition: unknown) => ({
    type: ExpressionType.MATCH,
    subject: { type: ExpressionType.REFERENCE, path: ['data', 'status'] },
    branches: [{ condition: branchCondition, value: 'Result' }],
  })

  describe('MatchExprSchema', () => {
    it('should accept a branch whose condition is a single condition', () => {
      // Arrange
      const json = matchOn(condition('A'))

      // Act
      const result = MatchExprSchema.safeParse(json)

      // Assert
      expect(result.success).toBe(true)
    })

    it('should accept a branch whose condition is a nested combinator tree', () => {
      // Arrange
      const json = matchOn({
        type: ConditionCombinatorType.OR,
        operands: [
          { type: ConditionCombinatorType.AND, operands: [condition('A'), condition('B')] },
          { type: ConditionCombinatorType.NOT, operand: condition('C') },
        ],
      })

      // Act
      const result = MatchExprSchema.safeParse(json)

      // Assert
      expect(result.success).toBe(true)
    })
  })

  describe('MatchBranchSchema', () => {
    it('should reject a branch whose condition is a predicate', () => {
      // Arrange
      const branch = { condition: { type: PredicateType.AND, operands: [condition('A'), condition('B')] }, value: 'A' }

      // Act
      const result = MatchBranchSchema.safeParse(branch)

      // Assert
      expect(result.success).toBe(false)
    })

    it('should reject a branch whose combinator has fewer than two operands', () => {
      // Arrange
      const branch = { condition: { type: ConditionCombinatorType.AND, operands: [condition('A')] }, value: 'A' }

      // Act
      const result = MatchBranchSchema.safeParse(branch)

      // Assert
      expect(result.success).toBe(false)
    })
  })

  describe('ConditionNotExprSchema', () => {
    it('should accept a NOT combinator with a single operand', () => {
      // Arrange
      const json = { type: ConditionCombinatorType.NOT, operand: condition('A') }

      // Act
      const result = ConditionNotExprSchema.safeParse(json)

      // Assert
      expect(result.success).toBe(true)
    })
  })
})
