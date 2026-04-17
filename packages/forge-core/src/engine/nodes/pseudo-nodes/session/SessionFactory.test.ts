import { NodeIDCategory, NodeIDGenerator } from '../../../compilation/id-generators/NodeIDGenerator'
import { PseudoNodeType } from '../../../types/pseudoNodes.type'
import SessionFactory from './SessionFactory'

describe('SessionFactory', () => {
  let mockNodeIDGenerator: Mocked<NodeIDGenerator>
  let factory: SessionFactory

  beforeEach(() => {
    mockNodeIDGenerator = {
      next: vi.fn(),
    } as unknown as Mocked<NodeIDGenerator>

    factory = new SessionFactory(mockNodeIDGenerator, NodeIDCategory.COMPILE_PSEUDO)
  })

  describe('create()', () => {
    it('should create SESSION pseudo node with generated ID', () => {
      // Arrange
      const generatedId = 'compile_pseudo:60'

      mockNodeIDGenerator.next.mockReturnValue(generatedId)

      // Act
      const result = factory.create('user')

      // Assert
      expect(mockNodeIDGenerator.next).toHaveBeenCalledWith(NodeIDCategory.COMPILE_PSEUDO)
      expect(result).toEqual({
        id: generatedId,
        type: PseudoNodeType.SESSION,
        properties: {
          baseSessionKey: 'user',
        },
      })
    })
  })
})
