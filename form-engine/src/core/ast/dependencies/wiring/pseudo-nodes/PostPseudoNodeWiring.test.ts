import { when } from 'jest-when'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { WiringContext } from '@form-engine/core/ast/dependencies/WiringContext'
import DependencyGraph, { DependencyEdgeType } from '@form-engine/core/ast/dependencies/DependencyGraph'
import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import PostPseudoNodeWiring from './PostPseudoNodeWiring'

describe('PostPseudoNodeWiring', () => {
  let mockWiringContext: jest.Mocked<WiringContext>
  let mockGraph: jest.Mocked<DependencyGraph>
  let wiring: PostPseudoNodeWiring

  function createMockWiringContext(): jest.Mocked<WiringContext> {
    return {
      findPseudoNodesByType: jest.fn().mockReturnValue([]),
      findReferenceNodes: jest.fn().mockReturnValue([]),
      graph: mockGraph,
    } as unknown as jest.Mocked<WiringContext>
  }

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockGraph = {
      addNode: jest.fn(),
      addEdge: jest.fn(),
    } as unknown as jest.Mocked<DependencyGraph>

    mockWiringContext = createMockWiringContext()
    wiring = new PostPseudoNodeWiring(mockWiringContext)
  })

  describe('wire', () => {

    it('should wire post pseudo node to Post() reference consumers', () => {
      // Arrange
      const postNode = ASTTestFactory.postPseudoNode('firstName')
      const postRef = ASTTestFactory.reference(['post', 'firstName'])

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('post')
        .mockReturnValue([postRef])

      // Act
      wiring.wire()

      // Assert
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, postRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'firstName',
      })
    })

    it('should handle dotted field codes in references', () => {
      // Arrange
      const postNode = ASTTestFactory.postPseudoNode('address')
      const postRef = ASTTestFactory.reference(['post', 'address.postcode'])

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('post')
        .mockReturnValue([postRef])

      // Act
      wiring.wire()

      // Assert - should match base code 'address' from 'address.postcode'
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, postRef.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'address',
      })
    })

    it('should handle multiple post pseudo nodes', () => {
      // Arrange
      const postNode1 = ASTTestFactory.postPseudoNode('firstName')
      const postNode2 = ASTTestFactory.postPseudoNode('lastName')

      const postRef1 = ASTTestFactory.reference(['post', 'firstName'])
      const postRef2 = ASTTestFactory.reference(['post', 'lastName'])

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode1, postNode2])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('post')
        .mockReturnValue([postRef1, postRef2])

      // Act
      wiring.wire()

      // Assert - both consumer edges
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode1.id, postRef1.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'firstName',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode2.id, postRef2.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'lastName',
      })
    })

    it('should wire multiple references to the same post field', () => {
      // Arrange
      const postNode = ASTTestFactory.postPseudoNode('fieldName')

      const postRef1 = ASTTestFactory.reference(['post', 'fieldName'])
      const postRef2 = ASTTestFactory.reference(['post', 'fieldName'])
      const postRef3 = ASTTestFactory.reference(['post', 'fieldName'])

      when(mockWiringContext.findPseudoNodesByType)
        .calledWith(PseudoNodeType.POST)
        .mockReturnValue([postNode])

      when(mockWiringContext.findReferenceNodes)
        .calledWith('post')
        .mockReturnValue([postRef1, postRef2, postRef3])

      // Act
      wiring.wire()

      // Assert - all three references should be wired
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, postRef1.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'fieldName',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, postRef2.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'fieldName',
      })
      expect(mockGraph.addEdge).toHaveBeenCalledWith(postNode.id, postRef3.id, DependencyEdgeType.DATA_FLOW, {
        referenceType: 'post',
        fieldCode: 'fieldName',
      })
    })

    describe('edge cases', () => {
      it('should handle no post pseudo nodes', () => {
        // Arrange
        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.POST)
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when reference path is too short', () => {
        // Arrange
        const postNode = ASTTestFactory.postPseudoNode('field')
        const invalidRef = ASTTestFactory.reference(['post']) // Missing field name

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.POST)
          .mockReturnValue([postNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('post')
          .mockReturnValue([invalidRef])

        // Act
        wiring.wire()

        // Assert - no edge to invalid reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should not wire reference when field code does not match', () => {
        // Arrange
        const postNode = ASTTestFactory.postPseudoNode('firstName')
        const differentFieldRef = ASTTestFactory.reference(['post', 'lastName'])

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.POST)
          .mockReturnValue([postNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('post')
          .mockReturnValue([differentFieldRef])

        // Act
        wiring.wire()

        // Assert - no edge to non-matching reference
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })

      it('should handle post node with no consumers', () => {
        // Arrange
        const postNode = ASTTestFactory.postPseudoNode('unusedField')

        when(mockWiringContext.findPseudoNodesByType)
          .calledWith(PseudoNodeType.POST)
          .mockReturnValue([postNode])

        when(mockWiringContext.findReferenceNodes)
          .calledWith('post')
          .mockReturnValue([])

        // Act
        wiring.wire()

        // Assert - no consumer edges created
        expect(mockGraph.addEdge).not.toHaveBeenCalled()
      })
    })
  })
})
