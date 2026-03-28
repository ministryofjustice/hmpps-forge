import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import RequestFactory from './RequestFactory'

describe('RequestFactory', () => {
  let mockNodeIDGenerator: jest.Mocked<NodeIDGenerator>
  let factory: RequestFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: jest.fn(),
    } as unknown as jest.Mocked<NodeIDGenerator>

    factory = new RequestFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create REQUEST pseudo node with generated ID', () => {
      // Arrange
      const generatedId = 'compile_pseudo:50'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create('headers.x-request-id')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.REQUEST,
        properties: {
          requestPath: 'headers.x-request-id',
        },
      })
    })

    it('should create unkeyed REQUEST pseudo node', () => {
      // Arrange
      const generatedId = 'compile_pseudo:51'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create('path')

      // Assert
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.REQUEST,
        properties: {
          requestPath: 'path',
        },
      })
    })
  })
})
