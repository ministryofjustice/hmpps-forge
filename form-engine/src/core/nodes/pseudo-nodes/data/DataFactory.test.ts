import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import DataFactory from './DataFactory'

describe('DataFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: DataFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new DataFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create DATA pseudo node with generated ID', () => {
      // Arrange
      const baseProperty = 'userData'
      const generatedId = 'compile_pseudo:30'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create(baseProperty)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.DATA,
        properties: {
          baseProperty,
        },
      })
    })

    it('should use RUNTIME_PSEUDO category when specified', () => {
      // Arrange
      const runtimeFactory = new DataFactory(mockNodeIDGenerator, NodeIDCategory.RUNTIME_PSEUDO)
      const generatedId = 'runtime_pseudo:1'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = runtimeFactory.create('userData')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.RUNTIME_PSEUDO)
      expect(result.id).toBe(generatedId)
    })
  })
})
