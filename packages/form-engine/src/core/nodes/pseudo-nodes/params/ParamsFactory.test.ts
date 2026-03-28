import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import ParamsFactory from './ParamsFactory'

describe('ParamsFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: ParamsFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new ParamsFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create PARAMS pseudo node with generated ID', () => {
      // Arrange
      const paramName = 'journeyId'
      const generatedId = 'compile_pseudo:50'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create(paramName)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.PARAMS,
        properties: {
          paramName,
        },
      })
    })

    it('should use RUNTIME_PSEUDO category when specified', () => {
      // Arrange
      const runtimeFactory = new ParamsFactory(mockNodeIDGenerator, NodeIDCategory.RUNTIME_PSEUDO)
      const generatedId = 'runtime_pseudo:1'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = runtimeFactory.create('journeyId')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.RUNTIME_PSEUDO)
      expect(result.id).toBe(generatedId)
    })
  })
})
