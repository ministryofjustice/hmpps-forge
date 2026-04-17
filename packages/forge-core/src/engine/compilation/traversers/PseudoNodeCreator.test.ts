import { when } from 'vitest-when'
import { ASTTestFactory } from '../../../testing/ASTTestFactory'
import { ASTNodeType } from '../../types/enums'
import { BlockType, ExpressionType } from '../../../authoring/types/enums'
import { FieldBlockASTNode } from '../../types/structures.type'
import { ReferenceASTNode } from '../../types/expressions.type'
import PseudoNodeFactory from '../../nodes/PseudoNodeFactory'
import MetadataRegistry from '../registries/MetadataRegistry'
import NodeRegistry from '../registries/NodeRegistry'
import PseudoNodeCreator from './PseudoNodeCreator'

describe('PseudoNodeCreator', () => {
  let mockNodeRegistry: Mocked<NodeRegistry>
  let mockMetadataRegistry: Mocked<MetadataRegistry>
  let mockPseudoNodeFactory: Mocked<PseudoNodeFactory>
  let creator: PseudoNodeCreator

  beforeEach(() => {
    ASTTestFactory.resetIds()
    mockNodeRegistry = {
      findByType: vi.fn().mockReturnValue([]),
      register: vi.fn(),
    } as unknown as Mocked<NodeRegistry>

    mockMetadataRegistry = {
      get: vi.fn(),
    } as unknown as Mocked<MetadataRegistry>

    mockPseudoNodeFactory = {
      createAnswerLocalPseudoNode: vi.fn(),
      createAnswerRemotePseudoNode: vi.fn(),
      createPostPseudoNode: vi.fn(),
      createQueryPseudoNode: vi.fn(),
      createParamsPseudoNode: vi.fn(),
      createDataPseudoNode: vi.fn(),
      createRequestPseudoNode: vi.fn(),
      createSessionPseudoNode: vi.fn(),
    } as unknown as Mocked<PseudoNodeFactory>

    creator = new PseudoNodeCreator(mockNodeRegistry, mockPseudoNodeFactory, mockMetadataRegistry)
  })

  describe('createForFields()', () => {
    it('should create ANSWER_LOCAL and POST pseudo nodes for fields on current step', () => {
      // Arrange
      const fieldBlock = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .withCode('firstName')
        .build() as FieldBlockASTNode
      const answerLocalPseudoNode = ASTTestFactory
        .answerLocalPseudoNode('firstName', fieldBlock.id)
      const postPseudoNode = ASTTestFactory
        .postPseudoNode('firstName', fieldBlock.id)

      when(mockMetadataRegistry.get)
        .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
        .thenReturn(true)

      when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
        .calledWith('firstName', fieldBlock.id)
        .thenReturn(answerLocalPseudoNode)

      when(mockPseudoNodeFactory.createPostPseudoNode)
        .calledWith('firstName', fieldBlock.id)
        .thenReturn(postPseudoNode)

      // Act
      creator.createForFields([fieldBlock])

      // Assert
      expect(mockNodeRegistry.register).toHaveBeenNthCalledWith(1, answerLocalPseudoNode.id, answerLocalPseudoNode)
      expect(mockNodeRegistry.register).toHaveBeenNthCalledWith(2, postPseudoNode.id, postPseudoNode)
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(2)
    })

    it('should not create pseudo nodes for fields not on current step', () => {
      // Arrange
      const fieldBlock = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .withCode('firstName')
        .build() as FieldBlockASTNode

      when(mockMetadataRegistry.get)
        .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
        .thenReturn(false)

      // Act
      creator.createForFields([fieldBlock])

      // Assert
      expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
    })

    it('should skip field blocks without code property', () => {
      // Arrange
      const fieldBlock = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .build() as FieldBlockASTNode

      when(mockMetadataRegistry.get)
        .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
        .thenReturn(true)

      // Act
      creator.createForFields([fieldBlock])

      // Assert
      expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
    })

    it('should skip field blocks with non-string code property', () => {
      // Arrange
      const fieldBlock: FieldBlockASTNode = {
        id: 'compile_ast:1',
        type: ASTNodeType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        properties: {
          code: ASTTestFactory.reference(['test']),
        },
      }

      when(mockMetadataRegistry.get)
        .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
        .thenReturn(true)

      // Act
      creator.createForFields([fieldBlock])

      // Assert
      expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
    })

    it('should handle multiple field blocks', () => {
      // Arrange
      const firstNameBlock = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .withCode('firstName')
        .build() as FieldBlockASTNode
      const lastNameBlock = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .withCode('lastName')
        .build() as FieldBlockASTNode
      const firstNameAnswerLocal = ASTTestFactory
        .answerLocalPseudoNode('firstName', firstNameBlock.id)
      const lastNameAnswerLocal = ASTTestFactory
        .answerLocalPseudoNode('lastName', lastNameBlock.id)
      const firstNamePost = ASTTestFactory
        .postPseudoNode('firstName', firstNameBlock.id)
      const lastNamePost = ASTTestFactory
        .postPseudoNode('lastName', lastNameBlock.id)

      when(mockMetadataRegistry.get)
        .calledWith(firstNameBlock.id, 'isDescendantOfStep', false)
        .thenReturn(true)

      when(mockMetadataRegistry.get)
        .calledWith(lastNameBlock.id, 'isDescendantOfStep', false)
        .thenReturn(true)

      when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
        .calledWith('firstName', firstNameBlock.id)
        .thenReturn(firstNameAnswerLocal)

      when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
        .calledWith('lastName', lastNameBlock.id)
        .thenReturn(lastNameAnswerLocal)

      when(mockPseudoNodeFactory.createPostPseudoNode)
        .calledWith('firstName', firstNameBlock.id)
        .thenReturn(firstNamePost)

      when(mockPseudoNodeFactory.createPostPseudoNode)
        .calledWith('lastName', lastNameBlock.id)
        .thenReturn(lastNamePost)

      // Act
      creator.createForFields([firstNameBlock, lastNameBlock])

      // Assert
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNameAnswerLocal.id, firstNameAnswerLocal)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNameAnswerLocal.id, lastNameAnswerLocal)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNamePost.id, firstNamePost)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNamePost.id, lastNamePost)
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(4)
    })
  })

  describe('createForReferences()', () => {
    it('should create pseudo nodes for each reference type', () => {
      // Arrange
      const queryRef = ASTTestFactory.reference(['query', 'returnUrl'])
      const paramsRef = ASTTestFactory.reference(['params', 'journeyId'])
      const postRef = ASTTestFactory.reference(['post', 'firstName'])
      const dataRef = ASTTestFactory.reference(['data', 'userData'])
      const requestRef = ASTTestFactory.reference(['request', 'headers', 'x-request-id'])
      const sessionRef = ASTTestFactory.reference(['session', 'user', 'name'])
      const answersRef = ASTTestFactory.reference(['answers', 'age'])

      const queryPseudo = ASTTestFactory.queryPseudoNode('returnUrl')
      const paramsPseudo = ASTTestFactory.paramsPseudoNode('journeyId')
      const postPseudo = ASTTestFactory.postPseudoNode('firstName')
      const dataPseudo = ASTTestFactory.dataPseudoNode('userData')
      const requestPseudo = ASTTestFactory.requestPseudoNode('headers.x-request-id')
      const sessionPseudo = ASTTestFactory.sessionPseudoNode('user')
      const answerRemotePseudo = ASTTestFactory.answerRemotePseudoNode('age')

      when(mockPseudoNodeFactory.createQueryPseudoNode).calledWith('returnUrl').thenReturn(queryPseudo)
      when(mockPseudoNodeFactory.createParamsPseudoNode).calledWith('journeyId').thenReturn(paramsPseudo)
      when(mockPseudoNodeFactory.createPostPseudoNode).calledWith('firstName', undefined).thenReturn(postPseudo)
      when(mockPseudoNodeFactory.createDataPseudoNode).calledWith('userData').thenReturn(dataPseudo)
      when(mockPseudoNodeFactory.createRequestPseudoNode)
        .calledWith('headers.x-request-id')
        .thenReturn(requestPseudo)
      when(mockPseudoNodeFactory.createSessionPseudoNode).calledWith('user').thenReturn(sessionPseudo)
      when(mockPseudoNodeFactory.createAnswerRemotePseudoNode).calledWith('age').thenReturn(answerRemotePseudo)

      // Act
      creator.createForReferences([queryRef, paramsRef, postRef, dataRef, requestRef, sessionRef, answersRef])

      // Assert
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(queryPseudo.id, queryPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(paramsPseudo.id, paramsPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(dataPseudo.id, dataPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(requestPseudo.id, requestPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(sessionPseudo.id, sessionPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(answerRemotePseudo.id, answerRemotePseudo)
    })

    it('should use the base key for Request.State dotted paths', () => {
      // Arrange
      const requestRef1 = ASTTestFactory.reference(['request', 'state', 'user', 'name'])
      const requestRef2 = ASTTestFactory.reference(['request', 'state', 'user', 'role'])
      const requestPseudo = ASTTestFactory.requestPseudoNode('state.user')

      when(mockPseudoNodeFactory.createRequestPseudoNode).calledWith('state.user').thenReturn(requestPseudo)

      // Act
      creator.createForReferences([requestRef1, requestRef2])

      // Assert
      expect(mockPseudoNodeFactory.createRequestPseudoNode).toHaveBeenCalledTimes(1)
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(requestPseudo.id, requestPseudo)
    })

    it('should use the base key for Session dotted paths', () => {
      // Arrange
      const sessionRef1 = ASTTestFactory.reference(['session', 'user', 'name'])
      const sessionRef2 = ASTTestFactory.reference(['session', 'user', 'role'])
      const sessionPseudo = ASTTestFactory.sessionPseudoNode('user')

      when(mockPseudoNodeFactory.createSessionPseudoNode).calledWith('user').thenReturn(sessionPseudo)

      // Act
      creator.createForReferences([sessionRef1, sessionRef2])

      // Assert
      expect(mockPseudoNodeFactory.createSessionPseudoNode).toHaveBeenCalledTimes(1)
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(sessionPseudo.id, sessionPseudo)
    })

    it('should deduplicate pseudo nodes with same key', () => {
      // Arrange
      const queryRef1 = ASTTestFactory.reference(['query', 'returnUrl'])
      const queryRef2 = ASTTestFactory.reference(['query', 'returnUrl'])
      const queryPseudo = ASTTestFactory.queryPseudoNode('returnUrl')

      when(mockPseudoNodeFactory.createQueryPseudoNode).calledWith('returnUrl').thenReturn(queryPseudo)

      // Act
      creator.createForReferences([queryRef1, queryRef2])

      // Assert
      expect(mockPseudoNodeFactory.createQueryPseudoNode).toHaveBeenCalledTimes(1)
      expect(mockPseudoNodeFactory.createQueryPseudoNode).toHaveBeenCalledWith('returnUrl')
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(queryPseudo.id, queryPseudo)
    })

    it('should extract base field code from dotted paths', () => {
      // Arrange
      const postRef = ASTTestFactory.reference(['post', 'address.street.name'])
      const postPseudo = ASTTestFactory.postPseudoNode('address')

      when(mockPseudoNodeFactory.createPostPseudoNode).calledWith('address', undefined).thenReturn(postPseudo)

      // Act
      creator.createForReferences([postRef])

      // Assert
      expect(mockPseudoNodeFactory.createPostPseudoNode).toHaveBeenCalledWith('address', undefined)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
    })

    it('should deduplicate pseudo nodes with different nested paths but same base field', () => {
      // Arrange
      const postRef1 = ASTTestFactory.reference(['post', 'address.street'])
      const postRef2 = ASTTestFactory.reference(['post', 'address.city'])
      const postPseudo = ASTTestFactory.postPseudoNode('address')

      when(mockPseudoNodeFactory.createPostPseudoNode).calledWith('address', undefined).thenReturn(postPseudo)

      // Act
      creator.createForReferences([postRef1, postRef2])

      // Assert
      expect(mockPseudoNodeFactory.createPostPseudoNode).toHaveBeenCalledTimes(1)
      expect(mockPseudoNodeFactory.createPostPseudoNode).toHaveBeenCalledWith('address', undefined)
      expect(mockNodeRegistry.register).toHaveBeenCalledTimes(1)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
    })

    it('should not create ANSWER_REMOTE when ANSWER_LOCAL exists for same field code', () => {
      // Arrange
      const fieldBlock = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .withCode('firstName')
        .build() as FieldBlockASTNode
      const answersRef = ASTTestFactory.reference(['answers', 'firstName'])
      const answerLocalPseudo = ASTTestFactory.answerLocalPseudoNode('firstName', fieldBlock.id)
      const postPseudo = ASTTestFactory.postPseudoNode('firstName', fieldBlock.id)

      when(mockMetadataRegistry.get)
        .calledWith(fieldBlock.id, 'isDescendantOfStep', false)
        .thenReturn(true)

      when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
        .calledWith('firstName', fieldBlock.id)
        .thenReturn(answerLocalPseudo)

      when(mockPseudoNodeFactory.createPostPseudoNode)
        .calledWith('firstName', fieldBlock.id)
        .thenReturn(postPseudo)

      // Act
      creator.createForFields([fieldBlock])
      creator.createForReferences([answersRef])

      // Assert
      expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).toHaveBeenCalledWith('firstName', fieldBlock.id)
      expect(mockPseudoNodeFactory.createAnswerRemotePseudoNode).not.toHaveBeenCalled()
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(answerLocalPseudo.id, answerLocalPseudo)
      expect(mockNodeRegistry.register).toHaveBeenCalledWith(postPseudo.id, postPseudo)
    })

    it('should skip references with unknown source types', () => {
      // Arrange
      const unknownRef = ASTTestFactory.reference(['unknown', 'someValue'])

      // Act
      creator.createForReferences([unknownRef])

      // Assert
      expect(mockPseudoNodeFactory.createQueryPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createParamsPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createDataPseudoNode).not.toHaveBeenCalled()
      expect(mockPseudoNodeFactory.createSessionPseudoNode).not.toHaveBeenCalled()
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

      // Act
      creator.createForReferences([shortPathRef, nonArrayRef, nonStringKeyRef])

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
    const firstNameBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
      .withCode('firstName')
      .build() as FieldBlockASTNode
    const lastNameBlock = ASTTestFactory.block('TextInput', BlockType.FIELD)
      .withCode('lastName')
      .build() as FieldBlockASTNode
    const queryRef = ASTTestFactory.reference(['query', 'returnUrl'])
    const dataRef = ASTTestFactory.reference(['data', 'userData'])
    const requestRef = ASTTestFactory.reference(['request', 'method'])
    const answersRef = ASTTestFactory.reference(['answers', 'age'])

    const firstNameAnswerLocal = ASTTestFactory.answerLocalPseudoNode('firstName', firstNameBlock.id)
    const lastNameAnswerLocal = ASTTestFactory.answerLocalPseudoNode('lastName', lastNameBlock.id)
    const firstNamePost = ASTTestFactory.postPseudoNode('firstName', firstNameBlock.id)
    const lastNamePost = ASTTestFactory.postPseudoNode('lastName', lastNameBlock.id)
    const queryPseudo = ASTTestFactory.queryPseudoNode('returnUrl')
    const dataPseudo = ASTTestFactory.dataPseudoNode('userData')
    const requestPseudo = ASTTestFactory.requestPseudoNode('method')
    const answerRemotePseudo = ASTTestFactory.answerRemotePseudoNode('age')

    when(mockMetadataRegistry.get).calledWith(firstNameBlock.id, 'isDescendantOfStep', false).thenReturn(true)
    when(mockMetadataRegistry.get).calledWith(lastNameBlock.id, 'isDescendantOfStep', false).thenReturn(true)
    when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
      .calledWith('firstName', firstNameBlock.id)
      .thenReturn(firstNameAnswerLocal)
    when(mockPseudoNodeFactory.createAnswerLocalPseudoNode)
      .calledWith('lastName', lastNameBlock.id)
      .thenReturn(lastNameAnswerLocal)
    when(mockPseudoNodeFactory.createPostPseudoNode)
      .calledWith('firstName', firstNameBlock.id)
      .thenReturn(firstNamePost)
    when(mockPseudoNodeFactory.createPostPseudoNode)
      .calledWith('lastName', lastNameBlock.id)
      .thenReturn(lastNamePost)
    when(mockPseudoNodeFactory.createQueryPseudoNode).calledWith('returnUrl').thenReturn(queryPseudo)
    when(mockPseudoNodeFactory.createDataPseudoNode).calledWith('userData').thenReturn(dataPseudo)
    when(mockPseudoNodeFactory.createRequestPseudoNode).calledWith('method').thenReturn(requestPseudo)
    when(mockPseudoNodeFactory.createAnswerRemotePseudoNode).calledWith('age').thenReturn(answerRemotePseudo)

    // Act
    creator.createForFields([firstNameBlock, lastNameBlock])
    creator.createForReferences([queryRef, dataRef, requestRef, answersRef])

    // Assert
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNameAnswerLocal.id, firstNameAnswerLocal)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNameAnswerLocal.id, lastNameAnswerLocal)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(firstNamePost.id, firstNamePost)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(lastNamePost.id, lastNamePost)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(queryPseudo.id, queryPseudo)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(dataPseudo.id, dataPseudo)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(requestPseudo.id, requestPseudo)
    expect(mockNodeRegistry.register).toHaveBeenCalledWith(answerRemotePseudo.id, answerRemotePseudo)
    expect(mockNodeRegistry.register).toHaveBeenCalledTimes(8)
  })

  it('should handle empty inputs', () => {
    // Act
    creator.createForFields([])
    creator.createForReferences([])

    // Assert
    expect(mockPseudoNodeFactory.createAnswerLocalPseudoNode).not.toHaveBeenCalled()
    expect(mockPseudoNodeFactory.createPostPseudoNode).not.toHaveBeenCalled()
    expect(mockPseudoNodeFactory.createQueryPseudoNode).not.toHaveBeenCalled()
    expect(mockPseudoNodeFactory.createParamsPseudoNode).not.toHaveBeenCalled()
    expect(mockPseudoNodeFactory.createDataPseudoNode).not.toHaveBeenCalled()
    expect(mockPseudoNodeFactory.createRequestPseudoNode).not.toHaveBeenCalled()
    expect(mockPseudoNodeFactory.createAnswerRemotePseudoNode).not.toHaveBeenCalled()
    expect(mockNodeRegistry.register).not.toHaveBeenCalled()
  })
})
