import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import AnswerLocalFactory from './AnswerLocalFactory'

describe('AnswerLocalFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: AnswerLocalFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new AnswerLocalFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create ANSWER_LOCAL pseudo node with generated ID', () => {
      // Arrange
      const baseFieldCode = 'firstName'
      const fieldNodeId = 'compile_ast:100'
      const generatedId = 'compile_pseudo:10'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create(baseFieldCode, fieldNodeId)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.ANSWER_LOCAL,
        properties: {
          baseFieldCode,
          fieldNodeId,
        },
      })
    })

    it('should use RUNTIME_PSEUDO category when specified', () => {
      // Arrange
      const runtimeFactory = new AnswerLocalFactory(mockNodeIDGenerator, NodeIDCategory.RUNTIME_PSEUDO)
      const generatedId = 'runtime_pseudo:1'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = runtimeFactory.create('fieldName', 'compile_ast:1')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.RUNTIME_PSEUDO)
      expect(result.id).toBe(generatedId)
    })
  })
})
