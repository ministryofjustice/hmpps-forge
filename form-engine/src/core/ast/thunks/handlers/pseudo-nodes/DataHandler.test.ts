import DataHandler from '@form-engine/core/ast/thunks/handlers/pseudo-nodes/DataHandler'
import { createMockContext } from '@form-engine/test-utils/thunkTestHelpers'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'

describe('DataHandler', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('evaluate()', () => {
    it('should return external data object for existing key', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('user')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const userData = { id: 123, name: 'John Doe', role: 'admin' }
      const mockContext = createMockContext({ mockData: { user: userData } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(userData)
      expect(result.error).toBeUndefined()
    })

    it('should return undefined for non-existent data key', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('missingData')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockData: { user: { name: 'John' } } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeUndefined()
      expect(result.error).toBeUndefined()
    })

    it('should return complete nested object without traversing properties', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('address')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const addressData = {
        line1: '10 Downing Street',
        line2: 'Westminster',
        city: 'London',
        postcode: 'SW1A 2AA',
        country: 'UK',
      }
      const mockContext = createMockContext({ mockData: { address: addressData } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(addressData)
      expect(result.value).toHaveProperty('line1')
      expect(result.value).toHaveProperty('postcode')
      expect(result.error).toBeUndefined()
    })

    it('should handle array data values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('items')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const items = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
        { id: 3, name: 'Item 3' },
      ]
      const mockContext = createMockContext({ mockData: { items } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(items)
      expect(Array.isArray(result.value)).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should handle primitive data values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('isActive')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockData: { isActive: true } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBe(true)
      expect(typeof result.value).toBe('boolean')
      expect(result.error).toBeUndefined()
    })

    it('should handle null and undefined data values', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('nullableField')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const mockContext = createMockContext({ mockData: { nullableField: null } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it('should handle deeply nested objects returned as-is', async () => {
      // Arrange
      const pseudoNode = ASTTestFactory.dataPseudoNode('business')
      const handler = new DataHandler(pseudoNode.id, pseudoNode)
      const businessData = {
        details: {
          name: 'ACME Corp',
          registration: {
            number: '12345',
            date: '2020-01-01',
          },
        },
        address: {
          line1: '123 Main St',
          postcode: 'AB1 2CD',
        },
      }
      const mockContext = createMockContext({ mockData: { business: businessData } })

      // Act
      const result = handler.evaluateSync(mockContext)

      // Assert
      expect(result.value).toEqual(businessData)
      expect(result.error).toBeUndefined()
    })

  })
})
