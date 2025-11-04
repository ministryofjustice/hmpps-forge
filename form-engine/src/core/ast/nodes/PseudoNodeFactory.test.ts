import { PseudoNodeType } from '@form-engine/core/types/pseudoNodes.type'
import { PseudoNodeFactory } from './PseudoNodeFactory'
import { NodeIDGenerator } from './NodeIDGenerator'

describe('PseudoNodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let factory: PseudoNodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    factory = new PseudoNodeFactory(nodeIDGenerator)
  })

  describe('createPostPseudoNode()', () => {
    it('should create a POST pseudo node with auto-generated ID', () => {
      const postNode = factory.createPostPseudoNode('email')

      expect(postNode).toEqual({
        id: 'compile_pseudo:1',
        type: PseudoNodeType.POST,
        metadata: {
          fieldCode: 'email',
        },
      })
    })

    it('should generate sequential IDs for multiple nodes', () => {
      const post1 = factory.createPostPseudoNode('email')
      const post2 = factory.createPostPseudoNode('name')

      expect(post1.id).toBe('compile_pseudo:1')
      expect(post2.id).toBe('compile_pseudo:2')
    })
  })

  describe('createAnswerPseudoNode()', () => {
    it('should create an ANSWER pseudo node with auto-generated ID', () => {
      const answerNode = factory.createAnswerPseudoNode('email')

      expect(answerNode).toEqual({
        id: 'compile_pseudo:1',
        type: PseudoNodeType.ANSWER,
        metadata: {
          fieldCode: 'email',
          fieldNodeId: undefined,
        },
      })
    })

    it('should include fieldNodeId when provided', () => {
      const answerNode = factory.createAnswerPseudoNode('email', 'compile_ast:42')

      expect(answerNode.metadata.fieldNodeId).toBe('compile_ast:42')
    })
  })

  describe('createDataPseudoNode()', () => {
    it('should create a DATA pseudo node with auto-generated ID', () => {
      const dataNode = factory.createDataPseudoNode('currentUser')

      expect(dataNode).toEqual({
        id: 'compile_pseudo:1',
        type: PseudoNodeType.DATA,
        metadata: {
          dataKey: 'currentUser',
        },
      })
    })
  })

  describe('createQueryPseudoNode()', () => {
    it('should create a QUERY pseudo node with auto-generated ID', () => {
      const queryNode = factory.createQueryPseudoNode('returnUrl')

      expect(queryNode).toEqual({
        id: 'compile_pseudo:1',
        type: PseudoNodeType.QUERY,
        metadata: {
          paramName: 'returnUrl',
        },
      })
    })
  })

  describe('createParamsPseudoNode()', () => {
    it('should create a PARAMS pseudo node with auto-generated ID', () => {
      const paramsNode = factory.createParamsPseudoNode('userId')

      expect(paramsNode).toEqual({
        id: 'compile_pseudo:1',
        type: PseudoNodeType.PARAMS,
        metadata: {
          paramName: 'userId',
        },
      })
    })
  })
})
