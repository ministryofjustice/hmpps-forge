import NodeRegistry from '@form-engine/core/ast/registration/NodeRegistry'
import MetadataRegistry from '@form-engine/core/ast/registration/MetadataRegistry'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { TransitionType, ExpressionType, IteratorType, StructureType } from '@form-engine/form/types/enums'
import { IterateASTNode } from '@form-engine/core/types/expressions.type'
import { findRelevantPseudoNodes, findRelevantNodes } from './findRelevantNodes'

describe('findRelevantNodes', () => {
  let nodeRegistry: NodeRegistry
  let metadataRegistry: MetadataRegistry

  beforeEach(() => {
    nodeRegistry = new NodeRegistry()
    metadataRegistry = new MetadataRegistry()
    ASTTestFactory.resetIds()
  })

  it('should include Journey nodes', () => {
    // Arrange
    const journeyNode = ASTTestFactory.journey().build()

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(journeyNode)
  })

  it('should fully traverse current step marked with isCurrentStep', () => {
    // Arrange
    const journeyNode = ASTTestFactory.journey()
      .withStep(step => step.withBlock('TextInput', 'field', block => block.withCode('firstName')))
      .build()

    const stepNode = journeyNode.properties.steps[0]
    const blockNode = stepNode.properties.blocks[0]

    metadataRegistry.set(stepNode.id, 'isCurrentStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(stepNode)
    expect(result).toContainEqual(blockNode)
  })

  it('should include OnLoad transitions when owner is ancestor of step', () => {
    // Arrange
    const onLoadNode = ASTTestFactory.transition(TransitionType.LOAD).build()
    const journeyNode = ASTTestFactory.journey().withProperty('onLoad', onLoadNode).build()

    metadataRegistry.set(journeyNode.id, 'isAncestorOfStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(onLoadNode)
  })

  it('should include OnSubmit transitions from steps', () => {
    // Arrange
    const onSubmitNode = ASTTestFactory.transition(TransitionType.SUBMIT).build()
    const journeyNode = ASTTestFactory.journey()
      .withStep(step => step.withProperty('onSubmission', onSubmitNode))
      .build()

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(onSubmitNode)
  })

  it('should skip OnSubmit when no owner Step found', () => {
    // Arrange
    const onSubmitNode = ASTTestFactory.transition(TransitionType.SUBMIT).build()
    const journeyNode = ASTTestFactory.journey().withProperty('onSubmission', onSubmitNode).build()

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).not.toContainEqual(onSubmitNode)
  })

  it('should include OnAction transitions when owner is current step', () => {
    // Arrange
    const onActionNode = ASTTestFactory.transition(TransitionType.ACTION).build()
    const journeyNode = ASTTestFactory.journey()
      .withStep(step => step.withProperty('onAction', [onActionNode]))
      .build()

    const stepNode = journeyNode.properties.steps[0]
    metadataRegistry.set(stepNode.id, 'isCurrentStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(onActionNode)
  })

  it('should skip OnAction transitions when owner is not current step', () => {
    // Arrange
    const onActionNode = ASTTestFactory.transition(TransitionType.ACTION).build()
    const journeyNode = ASTTestFactory.journey()
      .withStep(step => step.withProperty('onAction', [onActionNode]))
      .build()

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).not.toContainEqual(onActionNode)
  })

  it('should traverse Iterate expressions in non-standard block properties', () => {
    // Arrange
    const iterateSourceRef = ASTTestFactory.reference(['data', 'items'])

    const iterateExpr = ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
      .withProperty('input', iterateSourceRef)
      .withProperty('iterator', {
        type: IteratorType.MAP,
        yield: [{ type: StructureType.BLOCK, variant: 'TextInput', code: 'nestedField' }],
      })
      .build()

    const journeyNode = ASTTestFactory.journey()
      .withStep(step =>
        step.withBlock('WrapperBlock', 'basic', block =>
          block.withCode('wrapperField').withProperty('leftSideFields', iterateExpr),
        ),
      )
      .build()

    const stepNode = journeyNode.properties.steps[0]
    metadataRegistry.set(stepNode.id, 'isCurrentStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(iterateExpr)
    expect(result).toContainEqual(iterateSourceRef)
  })

  it('should include structural nodes for non-current steps but filter properties', () => {
    // Arrange
    const journeyNode = ASTTestFactory.journey()
      .withStep(step => step.withPath('/step-one').withBlock('TextInput', 'field', block => block.withCode('field1')))
      .withStep(step => step.withPath('/step-two').withBlock('TextInput', 'field', block => block.withCode('field2')))
      .build()

    const step1 = journeyNode.properties.steps[0]
    const step2 = journeyNode.properties.steps[1]

    // Mark step1 as current
    metadataRegistry.set(step1.id, 'isCurrentStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert - Both steps should be included as structural nodes
    expect(result).toContainEqual(step1)
    expect(result).toContainEqual(step2)
  })

  it('should include relevant pseudo nodes from references in current step', () => {
    // Arrange
    const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
    const pseudoNode = ASTTestFactory.answerLocalPseudoNode('firstName')

    const journeyNode = ASTTestFactory.journey()
      .withStep(step => step.withProperty('entry', referenceNode))
      .build()

    nodeRegistry.register(pseudoNode.id, pseudoNode)
    metadataRegistry.set(journeyNode.properties.steps[0].id, 'isCurrentStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert
    expect(result).toContainEqual(pseudoNode)
  })

  it('should never return duplicate nodes', () => {
    // Arrange - Create a complex journey with all transition types
    const nextExpr = ASTTestFactory.expression(ExpressionType.NEXT).withProperty('goto', '/next-step').build()
    const onSubmitNode = ASTTestFactory.transition(TransitionType.SUBMIT)
      .withProperty('onValid', { next: [nextExpr] })
      .build()
    const onLoadNode = ASTTestFactory.transition(TransitionType.LOAD).build()
    const onAccessNode = ASTTestFactory.transition(TransitionType.ACCESS).build()
    const onActionNode = ASTTestFactory.transition(TransitionType.ACTION).build()

    const journeyNode = ASTTestFactory.journey()
      .withProperty('onLoad', onLoadNode)
      .withStep(step =>
        step
          .withProperty('onSubmission', [onSubmitNode])
          .withProperty('onAccess', onAccessNode)
          .withProperty('onAction', [onActionNode])
          .withBlock('TextInput', 'field', block => block.withCode('firstName')),
      )
      .build()

    const stepNode = journeyNode.properties.steps[0]

    metadataRegistry.set(journeyNode.id, 'isAncestorOfStep', true)
    metadataRegistry.set(stepNode.id, 'isCurrentStep', true)

    // Act
    const result = findRelevantNodes(journeyNode, nodeRegistry, metadataRegistry)

    // Assert - No duplicates allowed
    const ids = result.map(n => n.id)
    const uniqueIds = new Set(ids)

    expect(ids.length).toBe(uniqueIds.size)
  })
})

describe('findRelevantPseudoNodes', () => {
  let nodeRegistry: NodeRegistry

  beforeEach(() => {
    nodeRegistry = new NodeRegistry()
    ASTTestFactory.resetIds()
  })

  describe('when scanning reference nodes', () => {
    it('should extract Answer reference identifiers', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('firstName')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should extract Data reference identifiers', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['data', 'userId'])
      const pseudoNode = ASTTestFactory.dataPseudoNode('userId')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should extract Post reference identifiers', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['post', 'formData'])
      const pseudoNode = ASTTestFactory.postPseudoNode('formData')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should extract Query parameter identifiers', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['query', 'returnUrl'])
      const pseudoNode = ASTTestFactory.queryPseudoNode('returnUrl')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should extract Params parameter identifiers', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['params', 'id'])
      const pseudoNode = ASTTestFactory.paramsPseudoNode('id')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should extract base field code from dotted paths', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'address.postcode'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('address')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should handle multiple reference nodes', () => {
      // Arrange
      const ref1 = ASTTestFactory.reference(['answers', 'firstName'])
      const ref2 = ASTTestFactory.reference(['query', 'returnUrl'])
      const pseudo1 = ASTTestFactory.answerLocalPseudoNode('firstName')
      const pseudo2 = ASTTestFactory.queryPseudoNode('returnUrl')

      nodeRegistry.register(pseudo1.id, pseudo1)
      nodeRegistry.register(pseudo2.id, pseudo2)

      // Act
      const result = findRelevantPseudoNodes([ref1, ref2], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudo1)
      expect(result).toContainEqual(pseudo2)
    })

    it('should skip non-reference nodes', () => {
      // Arrange
      const logicNode = ASTTestFactory.expression('LogicType.Test' as any).build()

      // Act
      const result = findRelevantPseudoNodes([logicNode], nodeRegistry)

      // Assert
      expect(result).toEqual([])
    })

    it('should skip reference nodes with invalid path structure', () => {
      // Arrange
      const invalidRef1 = ASTTestFactory.reference([])
      const invalidRef2 = ASTTestFactory.reference(['answers'])

      // Act
      const result = findRelevantPseudoNodes([invalidRef1, invalidRef2], nodeRegistry)

      // Assert
      expect(result).toEqual([])
    })

    it('should skip reference nodes with unknown source', () => {
      // Arrange
      const unknownRef = ASTTestFactory.reference(['unknown', 'field'])

      // Act
      const result = findRelevantPseudoNodes([unknownRef], nodeRegistry)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('when filtering pseudo nodes from registry', () => {
    it('should only include pseudo nodes matching extracted identifiers', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
      const matchingPseudo = ASTTestFactory.answerLocalPseudoNode('firstName')
      const nonMatchingPseudo = ASTTestFactory.answerLocalPseudoNode('lastName')

      nodeRegistry.register(matchingPseudo.id, matchingPseudo)
      nodeRegistry.register(nonMatchingPseudo.id, nonMatchingPseudo)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(matchingPseudo)
      expect(result).not.toContainEqual(nonMatchingPseudo)
    })

    it('should filter non-pseudo nodes from registry', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('firstName')
      const astNode = ASTTestFactory.block('TextInput', 'field').build()

      nodeRegistry.register(pseudoNode.id, pseudoNode)
      nodeRegistry.register(astNode.id, astNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
      expect(result).not.toContainEqual(astNode)
    })

    it('should return empty array when no matching pseudo nodes found', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'firstName'])
      const nonMatchingPseudo = ASTTestFactory.answerLocalPseudoNode('lastName')

      nodeRegistry.register(nonMatchingPseudo.id, nonMatchingPseudo)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toEqual([])
    })
  })

  describe('when handling different pseudo node types', () => {
    it('should match ANSWER_LOCAL pseudo nodes', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'field1'])
      const pseudoNode = ASTTestFactory.answerLocalPseudoNode('field1')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should match ANSWER_REMOTE pseudo nodes', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'field1'])
      const pseudoNode = ASTTestFactory.answerRemotePseudoNode('field1')

      nodeRegistry.register(pseudoNode.id, pseudoNode)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).toContainEqual(pseudoNode)
    })

    it('should not match pseudo nodes with wrong type', () => {
      // Arrange
      const referenceNode = ASTTestFactory.reference(['answers', 'field1'])
      const wrongTypePseudo = ASTTestFactory.queryPseudoNode('field1')

      nodeRegistry.register(wrongTypePseudo.id, wrongTypePseudo)

      // Act
      const result = findRelevantPseudoNodes([referenceNode], nodeRegistry)

      // Assert
      expect(result).not.toContainEqual(wrongTypePseudo)
    })
  })
})
