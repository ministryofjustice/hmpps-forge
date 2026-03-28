import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import QueryFactory from './QueryFactory'

describe('QueryFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: QueryFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new QueryFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create QUERY pseudo node with generated ID', () => {
      // Arrange
      const paramName = 'returnUrl'
      const generatedId = 'compile_pseudo:40'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create(paramName)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.QUERY,
        properties: {
          paramName,
        },
      })
    })

    it('should use RUNTIME_PSEUDO category when specified', () => {
      // Arrange
      const runtimeFactory = new QueryFactory(mockNodeIDGenerator, NodeIDCategory.RUNTIME_PSEUDO)
      const generatedId = 'runtime_pseudo:1'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = runtimeFactory.create('returnUrl')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.RUNTIME_PSEUDO)
      expect(result.id).toBe(generatedId)
    })
  })
})
