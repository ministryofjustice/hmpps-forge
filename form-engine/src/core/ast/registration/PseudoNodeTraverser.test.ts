import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType } from '@form-engine/form/types/enums'
import { FieldBlockASTNode } from '@form-engine/core/types/structures.type'
import { ReferenceASTNode } from '@form-engine/core/types/expressions.type'
import { when } from 'jest-when'
import { PseudoNodeFactory } from '@form-engine/core/ast/nodes/PseudoNodeFactory'
import MetadataRegistry from './MetadataRegistry'
import NodeRegistry from './NodeRegistry'
import PseudoNodeTraverser from './PseudoNodeTraverser'

describe('PseudoNodeTraverser', () => {
  let mockNodeRegistry: jest.Mocked<NodeRegistry>
  let mockMetadataRegistry: jest.Mocked<MetadataRegistry>
  let mockPseudoNodeFactory: jest.Mocked<PseudoNodeFactory>
  let traverser: PseudoNodeTraverser

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockNodeRegistry = {
      findByType: jest.fn().mockReturnValue([]),
      register: jest.fn(),
    } as unknown as jest.Mocked<NodeRegistry>

    mockMetadataRegistry = {
      get: jest.fn(),
    } as unknown as jest.Mocked<MetadataRegistry>

    mockPseudoNodeFactory = {
      createAnswerLocalPseudoNode: jest.fn(),
      createAnswerRemotePseudoNode: jest.fn(),
      createPostPseudoNode: jest.fn(),
      createQueryPseudoNode: jest.fn(),
      createParamsPseudoNode: jest.fn(),
      createDataPseudoNode: jest.fn(),
    } as unknown as jest.Mocked<PseudoNodeFactory>

    traverser = new PseudoNodeTraverser(mockNodeRegistry, mockPseudoNodeFactory, mockMetadataRegistry)
  })

  describe('createPseudoNodes', () => {
    describe('when processing field blocks', () => {
      it('should create ANSWER_LOCAL and POST pseudo nodes for fields on current step', () => {
        // Arrange
        const fieldBlock = ASTTestFactory
          .block('TextInput', 'field')
          .withCode('firstName')
          .build()
        const answerLocalPseudoNode = ASTTestFactory
          .answerLocalPseudoNode('firstName', fieldBlock.id)
        const postPseudoNode = ASTTestFactory
          .postPseudoNode('firstName', fieldBlock.id)

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([fieldBlock])

        when(mockMetadataRegistry.get)
          .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
          .calledWith('firstName', fieldBlock.id)
          .mockReturnValue(answerLocalPseudoNode)

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('firstName', fieldBlock.id)
          .mockReturnValue(postPseudoNode)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockNodeRegistry.register).toHaveBeenNthCalledWith(1, answerLocalPseudoNode.id, answerLocalPseudoNode)
        expect(mockNodeRegistry.register).toHaveBeenNthCalledWith(2, postPseudoNode.id, postPseudoNode)
        expect(mockNodeRegistry.register).toHaveBeenCalledTimes(2)
      })

      it('should not create pseudo nodes for fields not on current step', () => {
        // Arrange
        const fieldBlock = ASTTestFactory
          .block('TextInput', 'field')
          .withCode('firstName')
          .build()

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([fieldBlock])

        when(mockMetadataRegistry.get)
          .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(false)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
      })

      it('should skip field blocks without code property', () => {
        // Arrange
        const fieldBlock = ASTTestFactory
          .block('TextInput', 'field')
          .build()

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([fieldBlock])

        when(mockMetadataRegistry.get)
          .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
      })

      it('should skip field blocks with non-string code property', () => {
        // Arrange
        const fieldBlock: FieldBlockASTNode = {
          id: 'compile_ast:1',
          type: ASTNodeType.BLOCK,
          blockType: 'field',
          variant: 'TextInput',
          properties: {
            code: ASTTestFactory.reference(['test']),
          },
        }

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([fieldBlock])

        when(mockMetadataRegistry.get)
          .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
      })

      it('should skip non-field blocks', () => {
        // Arrange
        const basicBlock = ASTTestFactory
          .block('Heading', 'basic')
          .withCode('heading')
          .build()

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([basicBlock])

        when(mockMetadataRegistry.get)
          .calledWith(basicBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
      })

      it('should handle multiple field blocks', () => {
        // Arrange
        const firstNameBlock = ASTTestFactory
          .block('TextInput', 'field')
          .withCode('firstName')
          .build()
        const lastNameBlock = ASTTestFactory
          .block('TextInput', 'field')
          .withCode('lastName')
          .build()
        const firstNameAnswerLocal = ASTTestFactory
          .answerLocalPseudoNode('firstName', firstNameBlock.id)
        const lastNameAnswerLocal = ASTTestFactory
          .answerLocalPseudoNode('lastName', lastNameBlock.id)
        const firstNamePost = ASTTestFactory
          .postPseudoNode('firstName', firstNameBlock.id)
        const lastNamePost = ASTTestFactory
          .postPseudoNode('lastName', lastNameBlock.id)

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([firstNameBlock, lastNameBlock])

        when(mockMetadataRegistry.get)
          .calledWith(firstNameBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        when(mockMetadataRegistry.get)
          .calledWith(lastNameBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
          .calledWith('firstName', firstNameBlock.id)
          .mockReturnValue(firstNameAnswerLocal)

        when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
          .calledWith('lastName', lastNameBlock.id)
          .mockReturnValue(lastNameAnswerLocal)

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('firstName', firstNameBlock.id)
          .mockReturnValue(firstNamePost)

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('lastName', lastNameBlock.id)
          .mockReturnValue(lastNamePost)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNameAnswerLocal.id, firstNameAnswerLocal)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNameAnswerLocal.id, lastNameAnswerLocal)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNamePost.id, firstNamePost)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNamePost.id, lastNamePost)
        expect(mockNodeRegistry.register).toHaveBeenCalledTimes(4)
      })
    })

    describe('when processing reference expressions', () => {
      it('should create pseudo nodes for each reference type', () => {
        // Arrange
        const queryRef = ASTTestFactory
          .reference(['query', 'returnUrl'])
        const paramsRef = ASTTestFactory
          .reference(['params', 'journeyId'])
        const postRef = ASTTestFactory
          .reference(['post', 'firstName'])
        const dataRef = ASTTestFactory
          .reference(['data', 'userData'])
        const answersRef = ASTTestFactory
          .reference(['answers', 'age'])

        const queryPseudo = ASTTestFactory
          .queryPseudoNode('returnUrl')
        const paramsPseudo = ASTTestFactory
          .paramsPseudoNode('journeyId')
        const postPseudo = ASTTestFactory
          .postPseudoNode('firstName')
        const dataPseudo = ASTTestFactory
          .dataPseudoNode('userData')
        const answerRemotePseudo = ASTTestFactory
          .answerRemotePseudoNode('age')

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([queryRef, paramsRef, postRef, dataRef, answersRef])

        when(mockPseudoNodeFactory.createQueryPseudoNode)
          .calledWith('returnUrl')
          .mockReturnValue(queryPseudo)

        when(mockPseudoNodeFactory.createParamsPseudoNode)
          .calledWith('journeyId')
          .mockReturnValue(paramsPseudo)

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('firstName', undefined)
          .mockReturnValue(postPseudo)

        when(mockPseudoNodeFactory.createDataPseudoNode)
          .calledWith('userData')
          .mockReturnValue(dataPseudo)

        when(mockPseudoNodeFactory.createAnswerRemotePseudoNode)
          .calledWith('age')
          .mockReturnValue(answerRemotePseudo)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(queryPseudo.id, queryPseudo)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(paramsPseudo.id, paramsPseudo)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(dataPseudo.id, dataPseudo)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(answerRemotePseudo.id, answerRemotePseudo)
      })

      it('should deduplicate pseudo nodes with same key', () => {
        // Arrange
        const queryRef1 = ASTTestFactory
          .reference(['query', 'returnUrl'])
        const queryRef2 = ASTTestFactory
          .reference(['query', 'returnUrl'])
        const queryPseudo = ASTTestFactory
          .queryPseudoNode('returnUrl')

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([queryRef1, queryRef2])

        when(mockPseudoNodeFactory.createQueryPseudoNode)
          .calledWith('returnUrl')
          .mockReturnValue(queryPseudo)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createQueryPseudoNode).toHaveBeenCalledTimes(1)
        expect(mockPseudoNodeFactory.createQueryPseudoNode).toHaveBeenCalledWith('returnUrl')
        expect(mockNodeRegistry.register).toHaveBeenCalledTimes(1)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(queryPseudo.id, queryPseudo)
      })

      it('should extract base field code from dotted paths', () => {
        // Arrange
        const postRef = ASTTestFactory
          .reference(['post', 'address.street.name'])
        const postPseudo = ASTTestFactory
          .postPseudoNode('address')

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([postRef])

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('address', undefined)
          .mockReturnValue(postPseudo)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createPostPseudoNode).toHaveBeenCalledWith('address', undefined)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
      })

      it('should deduplicate pseudo nodes with different nested paths but same base field', () => {
        // Arrange
        const postRef1 = ASTTestFactory
          .reference(['post', 'address.street'])
        const postRef2 = ASTTestFactory
          .reference(['post', 'address.city'])
        const postPseudo = ASTTestFactory
          .postPseudoNode('address')

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([postRef1, postRef2])

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('address', undefined)
          .mockReturnValue(postPseudo)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createPostPseudoNode).toHaveBeenCalledTimes(1)
        expect(mockPseudoNodeFactory.createPostPseudoNode).toHaveBeenCalledWith('address', undefined)
        expect(mockNodeRegistry.register).toHaveBeenCalledTimes(1)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
      })

      it('should not create ANSWER_REMOTE when ANSWER_LOCAL exists for same field code', () => {
        // Arrange
        const fieldBlock = ASTTestFactory
          .block('TextInput', 'field')
          .withCode('firstName')
          .build()
        const answersRef = ASTTestFactory
          .reference(['answers', 'firstName'])
        const answerLocalPseudo = ASTTestFactory
          .answerLocalPseudoNode('firstName', fieldBlock.id)
        const postPseudo = ASTTestFactory
          .postPseudoNode('firstName', fieldBlock.id)

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([fieldBlock])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([answersRef])

        when(mockMetadataRegistry.get)
          .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
          .mockReturnValue(true)

        when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
          .calledWith('firstName', fieldBlock.id)
          .mockReturnValue(answerLocalPseudo)

        when(mockPseudoNodeFactory.createPostPseudoNode)
          .calledWith('firstName', fieldBlock.id)
          .mockReturnValue(postPseudo)

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).toHaveBeenCalledWith('firstName', fieldBlock.id)
        expect(mockPseudoNodeFactory.createAnswerRemotePseudoNode).not.toHaveBeenCalled()
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(answerLocalPseudo.id, answerLocalPseudo)
        expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
      })

      it('should skip references with unknown source types', () => {
        // Arrange
        const unknownRef = ASTTestFactory
          .reference(['unknown', 'someValue'])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([unknownRef])

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createQueryPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createParamsPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createDataPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createAnswerRemotePseudoNode).not.toHaveBeenCalled()
        expect(mockNodeRegistry.register).not.toHaveBeenCalled()
      })

      it('should skip references with invalid path structure', () => {
        // Arrange
        const shortPathRef: ReferenceASTNode = {
          id: 'compile_ast:1',
          type: ASTNodeType.EXPRESSION,
          expressionType: ExpressionType.REFERENCE,
          properties: { path: ['query'] },
        }

        const nonArrayRef: ReferenceASTNode = {
          id: 'compile_ast:2',
          type: ASTNodeType.EXPRESSION,
          expressionType: ExpressionType.REFERENCE,
          properties: { path: ['query.returnUrl'] },
        }

        const nonStringKeyRef: ReferenceASTNode = {
          id: 'compile_ast:3',
          type: ASTNodeType.EXPRESSION,
          expressionType: ExpressionType.REFERENCE,
          properties: { path: ['query', 123] },
        }

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.BLOCK)
          .mockReturnValue([])

        when(mockNodeRegistry.findByType)
          .calledWith(ASTNodeType.EXPRESSION)
          .mockReturnValue([shortPathRef, nonArrayRef, nonStringKeyRef])

        // Act
        traverser.createPseudoNodes()

        // Assert
        expect(mockPseudoNodeFactory.createQueryPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createParamsPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createDataPseudoNode).not.toHaveBeenCalled()
        expect(mockPseudoNodeFactory.createAnswerRemotePseudoNode).not.toHaveBeenCalled()
        expect(mockNodeRegistry.register).not.toHaveBeenCalled()
      })
    })

    it('should handle mixed field blocks and reference expressions', () => {
      // Arrange
      const firstNameBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('firstName')
        .build()
      const lastNameBlock = ASTTestFactory
        .block('TextInput', 'field')
        .withCode('lastName')
        .build()
      const queryRef = ASTTestFactory
        .reference(['query', 'returnUrl'])
      const dataRef = ASTTestFactory
        .reference(['data', 'userData'])
      const answersRef = ASTTestFactory
        .reference(['answers', 'age'])

      const firstNameAnswerLocal = ASTTestFactory
        .answerLocalPseudoNode('firstName', firstNameBlock.id)
      const lastNameAnswerLocal = ASTTestFactory
        .answerLocalPseudoNode('lastName', lastNameBlock.id)
      const firstNamePost = ASTTestFactory
        .postPseudoNode('firstName', firstNameBlock.id)
      const lastNamePost = ASTTestFactory
        .postPseudoNode('lastName', lastNameBlock.id)
      const queryPseudo = ASTTestFactory
        .queryPseudoNode('returnUrl')
      const dataPseudo = ASTTestFactory
        .dataPseudoNode('userData')
      const answerRemotePseudo = ASTTestFactory
        .answerRemotePseudoNode('age')

      when(mockNodeRegistry.findByType)
        .calledWith(ASTNodeType.BLOCK)
        .mockReturnValue([firstNameBlock, lastNameBlock])

      when(mockNodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([queryRef, dataRef, answersRef])

      when(mockMetadataRegistry.get)
        .calledWith(firstNameBlock.id, 'isDescendantOfStep', false)
        .mockReturnValue(true)

      when(mockMetadataRegistry.get)
        .calledWith(lastNameBlock.id, 'isDescendantOfStep', false)
        .mockReturnValue(true)

      when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
        .calledWith('firstName', firstNameBlock.id)
        .mockReturnValue(firstNameAnswerLocal)

      when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
        .calledWith('lastName', lastNameBlock.id)
        .mockReturnValue(lastNameAnswerLocal)

      when(mockPseudoNodeFactory.createPostPseudoNode)
        .calledWith('firstName', firstNameBlock.id)
        .mockReturnValue(firstNamePost)

      when(mockPseudoNodeFactory.createPostPseudoNode)
        .calledWith('lastName', lastNameBlock.id)
        .mockReturnValue(lastNamePost)

      when(mockPseudoNodeFactory.createQueryPseudoNode)
        .calledWith('returnUrl')
        .mockReturnValue(queryPseudo)

      when(mockPseudoNodeFactory.createDataPseudoNode)
        .calledWith('userData')
        .mockReturnValue(dataPseudo)

      when(mockPseudoNodeFactory.createAnswerRemotePseudoNode)
        .calledWith('age')
        .mockReturnValue(answerRemotePseudo)

      // Act
      traverser.createPseudoNodes()

      // Assert
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNameAnswerLocal.id, firstNameAnswerLocal)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNameAnswerLocal.id, lastNameAnswerLocal)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNamePost.id, firstNamePost)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNamePost.id, lastNamePost)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(queryPseudo.id, queryPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(dataPseudo.id, dataPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(answerRemotePseudo.id, answerRemotePseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(7)
    })

    it('should handle empty node registry', () => {
      // Arrange
      when(mockNodeRegistry.findByType)
        .calledWith(ASTNodeType.BLOCK)
        .mockReturnValue([])

      when(mockNodeRegistry.findByType)
        .calledWith(ASTNodeType.EXPRESSION)
        .mockReturnValue([])

      // Act
      traverser.createPseudoNodes()

      // Assert
      expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createQueryPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createParamsPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createDataPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createAnswerRemotePseudoNode).not.toHaveBeenCalled()
      expect(mockNodeRegistry.register).not.toHaveBeenCalled()
    })
  })
})
