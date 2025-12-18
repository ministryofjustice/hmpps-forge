import AnswerRemoteHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/AnswerRemoteHandler'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

describe('AnswerRemoteHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return previously resolved answer for existing field', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('businessType')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockAnswers: { businessType: 'food-stall' } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('food-stall')
      expect(result.error).toBeUndefined()
    })

    it('should return undefined for non-existent answer', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('missingField')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockAnswers: { businessType: 'food-stall' } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return complex object answers', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('address')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const addressAnswer = {
        line1: '10 Downing Street',
        city: 'London',
        postcode: 'SW1A 2AA',
      }
      const mockContext = createMockContext({ mockAnswers: { address: addressAnswer } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(addressAnswer)
      expect(result.error).toBeUndefined()
    })

    it('should return array answers', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('interests')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const interests = ['coding', 'reading', 'gaming']
      const mockContext = createMockContext({ mockAnswers: { interests } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(interests)
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should return boolean answers', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('acceptTerms')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockAnswers: { acceptTerms: true } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe(true)
      expect(typeof result.value).toBe('boolean')
      expect(result.error).toBeUndefined()
    })

    it('should return numeric answers', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('age')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockAnswers: { age: 25 } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe(25)
      expect(typeof result.value).toBe('number')
      expect(result.error).toBeUndefined()
    })

    it('should handle null answer values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('optionalField')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockAnswers: { optionalField: null } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it('should handle empty string answers', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('optionalText')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockAnswers: { optionalText: '' } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe('')
      expect(result.error).toBeUndefined()
    })

    it('should store nodeId correctly', () => {
      // Arrange
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('test')
      const handler = new AnswerRemoteHandler(pseudoNode.id, pseudoNode)

      // Assert
      expect(handler.nodeId).toBe(pseudoNode.id)
    })
  })
})
