import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType } from '@form-engine/form/types/enums'
import {
  findRelevantPseudoNodes,
  findStepArtefactRelevantNodes,
  findJourneyMetadataArtefactRelevantNodes,
} from './findRelevantNodes'

describe('findRelevantNodes', () => {
  let nodeRegistry: NodeRegistry
  let metadataRegistry: MetadataRegistry

  beforeEach(() => {
    nodeRegistry = new NodeRegistry()
    metadataRegistry = new MetadataRegistry()
    ASTTestFactory.resetIds()
  })

  describe('findStepArtefactRelevantNodes', () => {
    it('should include Journey nodes marked as ancestor of step', () => {
      const journeyNode = ASTTestFactory.journey().build()

      metadataRegistry.set(journeyNode.id, 'isAncestorOfStep', true)

      const result = findStepArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).toContainEqual(journeyNode)
    })

    it('should include Steps marked as ancestor and their subtrees', () => {
      const journeyNode = ASTTestFactory.journey()
        .withStep(step => step.withBlock('TextInput', 'field', block => block.withCode('firstName')))
        .build()

      const stepNode = journeyNode.properties.steps[0]
      const blockNode = stepNode.properties.blocks[0]

      metadataRegistry.set(stepNode.id, 'isAncestorOfStep', true)

      const result = findStepArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).toContainEqual(stepNode)
      expect(result).toContainEqual(blockNode)
    })

    it('should not include nodes from journey not marked as ancestor', () => {
      const journeyNode = ASTTestFactory.journey()
        .withStep(step => step.withBlock('TextInput', 'field', block => block.withCode('name')))
        .build()

      metadataRegistry.set(journeyNode.id, 'isAncestorOfStep', false)

      const result = findStepArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).not.toContainEqual(journeyNode)
      expect(result).toEqual([])
    })

    it('should include relevant pseudo nodes from references', () => {
      const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('firstName')

      const journeyNode = ASTTestFactory.journey()
        .withStep(step => step.withProperty('entry', referenceNode))
        .build()

      nodeRegistry.register(pseudoNode.id, pseudoNode)
      metadataRegistry.set(journeyNode.properties.steps[0].id, 'isAncestorOfStep', true)

      const result = findStepArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).toContainEqual(pseudoNode)
    })
  })

  describe('findJourneyMetadataArtefactRelevantNodes', () => {
    it('should collect all nodes in journey', () => {
      const journeyNode = ASTTestFactory.journey()
        .withStep(step => step.withBlock('TextInput', 'field', block => block.withCode('name')))
        .build()

      const result = findJourneyMetadataArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).toContainEqual(journeyNode)
      expect(result).toContainEqual(journeyNode.properties.steps[0])
    })

    it('should include OnLoad transitions when owner is ancestor of step', () => {
      const onLoadNode = ASTTestFactory.transition(TransitionType.LOAD).build()
      const journeyNode = ASTTestFactory.journey().withProperty('onLoad', onLoadNode).build()

      metadataRegistry.set(journeyNode.id, 'isAncestorOfStep', true)

      const result = findJourneyMetadataArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).toContainEqual(onLoadNode)
    })

    it('should include OnSubmit transitions from steps', () => {
      const onSubmitNode = ASTTestFactory.transition(TransitionType.SUBMIT).build()
      const journeyNode = ASTTestFactory.journey()
        .withStep(step => step.withProperty('onSubmission', onSubmitNode))
        .build()

      const result = findJourneyMetadataArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).toContainEqual(onSubmitNode)
    })

    it('should skip OnSubmit when no owner Step found', () => {
      const onSubmitNode = ASTTestFactory.transition(TransitionType.SUBMIT).build()
      const journeyNode = ASTTestFactory.journey().withProperty('onSubmission', onSubmitNode).build()

      const result = findJourneyMetadataArtefactRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

      expect(result).not.toContainEqual(onSubmitNode)
    })
  })

  describe('findRelevantPseudoNodes', () => {
    describe('when scanning reference nodes', () => {
      it('should extract Answer reference identifiers', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
        const pseudoNode = ASTTestFactory.answerLocalPseudoNode('firstName')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should extract Data reference identifiers', () => {
        const referenceNode = ASTTestFactory.reference(['data', 'userId'])
        const pseudoNode = ASTTestFactory.dataPseudoNode('userId')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should extract Post reference identifiers', () => {
        const referenceNode = ASTTestFactory.reference(['post', 'formData'])
        const pseudoNode = ASTTestFactory.postPseudoNode('formData')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should extract Query parameter identifiers', () => {
        const referenceNode = ASTTestFactory.reference(['query', 'returnUrl'])
        const pseudoNode = ASTTestFactory.queryPseudoNode('returnUrl')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should extract Params parameter identifiers', () => {
        const referenceNode = ASTTestFactory.reference(['params', 'id'])
        const pseudoNode = ASTTestFactory.paramsPseudoNode('id')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should extract base field code from dotted paths', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'address.postcode'])
        const pseudoNode = ASTTestFactory.answerLocalPseudoNode('address')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should handle multiple reference nodes', () => {
        const ref1 = ASTTestFactory.reference(['answers', 'firstName'])
        const ref2 = ASTTestFactory.reference(['query', 'returnUrl'])
        const pseudo1 = ASTTestFactory.answerLocalPseudoNode('firstName')
        const pseudo2 = ASTTestFactory.queryPseudoNode('returnUrl')

        nodeRegistry.register(pseudo1.id, pseudo1)
        nodeRegistry.register(pseudo2.id, pseudo2)

        const result = findRelevantPseudoNodes([ref1, ref2], nodeRegistry)

        expect(result).toContainEqual(pseudo1)
        expect(result).toContainEqual(pseudo2)
      })

      it('should skip non-reference nodes', () => {
        const logicNode = ASTTestFactory.expression('LogicType.Test' as any).build()

        const result = findRelevantPseudoNodes([logicNode], nodeRegistry)

        expect(result).toEqual([])
      })

      it('should skip reference nodes with invalid path structure', () => {
        const invalidRef1 = ASTTestFactory.reference([])
        const invalidRef2 = ASTTestFactory.reference(['answers'])

        const result = findRelevantPseudoNodes([invalidRef1, invalidRef2], nodeRegistry)

        expect(result).toEqual([])
      })

      it('should skip reference nodes with unknown source', () => {
        const unknownRef = ASTTestFactory.reference(['unknown', 'field'])

        const result = findRelevantPseudoNodes([unknownRef], nodeRegistry)

        expect(result).toEqual([])
      })
    })

    describe('when filtering pseudo nodes from registry', () => {
      it('should only include pseudo nodes matching extracted identifiers', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
        const matchingPseudo = ASTTestFactory.answerLocalPseudoNode('firstName')
        const nonMatchingPseudo = ASTTestFactory.answerLocalPseudoNode('lastName')

        nodeRegistry.register(matchingPseudo.id, matchingPseudo)
        nodeRegistry.register(nonMatchingPseudo.id, nonMatchingPseudo)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(matchingPseudo)
        expect(result).not.toContainEqual(nonMatchingPseudo)
      })

      it('should filter non-pseudo nodes from registry', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
        const pseudoNode = ASTTestFactory.answerLocalPseudoNode('firstName')
        const astNode = ASTTestFactory.block('TextInput', 'field').build()

        nodeRegistry.register(pseudoNode.id, pseudoNode)
        nodeRegistry.register(astNode.id, astNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
        expect(result).not.toContainEqual(astNode)
      })

      it('should return empty array when no matching pseudo nodes found', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
        const nonMatchingPseudo = ASTTestFactory.answerLocalPseudoNode('lastName')

        nodeRegistry.register(nonMatchingPseudo.id, nonMatchingPseudo)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toEqual([])
      })
    })

    describe('when handling different pseudo node types', () => {
      it('should match ANSWER_LOCAL pseudo nodes', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'field1'])
        const pseudoNode = ASTTestFactory.answerLocalPseudoNode('field1')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should match ANSWER_REMOTE pseudo nodes', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'field1'])
        const pseudoNode = ASTTestFactory.answerRemotePseudoNode('field1')

        nodeRegistry.register(pseudoNode.id, pseudoNode)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).toContainEqual(pseudoNode)
      })

      it('should not match pseudo nodes with wrong type', () => {
        const referenceNode = ASTTestFactory.reference(['answers', 'field1'])
        const wrongTypePseudo = ASTTestFactory.queryPseudoNode('field1')

        nodeRegistry.register(wrongTypePseudo.id, wrongTypePseudo)

        const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

        expect(result).not.toContainEqual(wrongTypePseudo)
      })
    })
  })
})
