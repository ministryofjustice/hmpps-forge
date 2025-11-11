import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'

describe('PseudoNodeFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: PseudoNodeFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new PseudoNodeFactory(mockNodeIDGenerator)
  })

  describe('createPostPseudoNode', () => {
    it('should create POST pseudo node with generated ID from nodeIDGenerator', () => {
      // Arrange
      const baseFieldCode = 'firstName'
      const generatedId = 'compile_pseudo:1'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.createPostPseudoNode(baseFieldCode)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.POST,
        properties: {
          baseFieldCode,
        },
      })
    })
  })

  describe('createAnswerLocalPseudoNode', () => {
    it('should create ANSWER_LOCAL pseudo node with generated ID from nodeIDGenerator', () => {
      // Arrange
      const baseFieldCode = 'firstName'
      const fieldNodeId = 'compile_ast:100'
      const generatedId = 'compile_pseudo:10'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.createAnswerLocalPseudoNode(baseFieldCode, fieldNodeId)

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
  })

  describe('createAnswerRemotePseudoNode', () => {
    it('should create ANSWER_REMOTE pseudo node with generated ID from nodeIDGenerator', () => {
      // Arrange
      const baseFieldCode = 'previousAnswer'
      const generatedId = 'compile_pseudo:20'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.createAnswerRemotePseudoNode(baseFieldCode)

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
  })

  describe('createDataPseudoNode', () => {
    it('should create DATA pseudo node with generated ID from nodeIDGenerator', () => {
      // Arrange
      const baseFieldCode = 'userData'
      const generatedId = 'compile_pseudo:30'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.createDataPseudoNode(baseFieldCode)

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.DATA,
        properties: {
          baseFieldCode,
        },
      })
    })
  })

  describe('createQueryPseudoNode', () => {
    it('should create QUERY pseudo node with generated ID from nodeIDGenerator', () => {
      // Arrange
      const paramName = 'returnUrl'
      const generatedId = 'compile_pseudo:40'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.createQueryPseudoNode(paramName)

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
  })

  describe('createParamsPseudoNode', () => {
    it('should create PARAMS pseudo node with generated ID from nodeIDGenerator', () => {
      // Arrange
      const paramName = 'journeyId'
      const generatedId = 'compile_pseudo:50'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.createParamsPseudoNode(paramName)

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
  })
})
