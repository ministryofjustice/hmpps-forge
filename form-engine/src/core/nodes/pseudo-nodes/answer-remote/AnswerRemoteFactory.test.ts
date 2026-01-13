import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import AnswerRemoteFactory from './AnswerRemoteFactory'

describe('AnswerRemoteFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: AnswerRemoteFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new AnswerRemoteFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create ANSWER_REMOTE pseudo node with generated ID', () => {
      // Arrange
      const baseFieldCode = 'previousAnswer'
      const generatedId = 'compile_pseudo:20'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create(baseFieldCode)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.ANSWER_REMOTE,
        properties: {
          baseFieldCode,
        },
      })
    })

    it('should use RUNTIME_PSEUDO category when specified', () => {
      // Arrange
      const runtimeFactory = new AnswerRemoteFactory(mockNodeIDGenerator, NodeIDCategory.RUNTIME_PSEUDO)
      const generatedId = 'runtime_pseudo:1'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = runtimeFactory.create('fieldName')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.RUNTIME_PSEUDO)
      expect(result.id).toBe(generatedId)
    })
  })
})
