import { CompilationDependencies } from './CompilationDependencies'
import { ASTNode, AstNodeId } from '../types/engine.type'
import { ASTNodeType } from '../types/enums'
import {
  AccessTransitionASTNode,
  ActionTransitionASTNode,
  IterateASTNode,
  SubmitTransitionASTNode,
} from '../types/expressions.type'
import { BasicBlockASTNode, FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../types/structures.type'
import { TemplateValue } from '../types/template.type'
import { BlockType, ExpressionType, IteratorType, TransitionType } from '../../authoring/types/enums'
import { ASTTestFactory } from '../../testing/ASTTestFactory'
import RuntimePlanBuilder from './RuntimePlanBuilder'

function createAccessTransition(id: AstNodeId): AccessTransitionASTNode {
  return ASTTestFactory.transition(TransitionType.ACCESS)
    .withId(id)
    .build() as AccessTransitionASTNode
}

function createActionTransition(id: AstNodeId): ActionTransitionASTNode {
  return ASTTestFactory.transition(TransitionType.ACTION)
    .withId(id)
    .withProperty('when', { id: 'compile_ast:99', type: ASTNodeType.EXPRESSION })
    .withProperty('effects', [])
    .build() as ActionTransitionASTNode
}

function createSubmitTransition(id: AstNodeId): SubmitTransitionASTNode {
  return ASTTestFactory.transition(TransitionType.SUBMIT)
    .withId(id)
    .withProperty('validate', false)
    .build() as SubmitTransitionASTNode
}

function createJourney(id: AstNodeId, onAccess: AccessTransitionASTNode[]): JourneyASTNode {
  return ASTTestFactory.journey()
    .withId(id)
    .withProperty('path', '/journey')
    .withCode('journey')
    .withTitle('Journey')
    .withProperty('onAccess', onAccess)
    .build()
}

function createStep(
  id: AstNodeId,
  options: {
    onAccess?: AccessTransitionASTNode[]
    onAction?: ActionTransitionASTNode[]
    onSubmission?: SubmitTransitionASTNode[]
  } = {},
): StepASTNode {
  const step = ASTTestFactory.step()
    .withId(id)
    .withPath('/step')
    .withTitle('Step')

  if (options.onAccess) {
    step.withProperty('onAccess', options.onAccess)
  }

  if (options.onAction) {
    step.withProperty('onAction', options.onAction)
  }

  if (options.onSubmission) {
    step.withProperty('onSubmission', options.onSubmission)
  }

  return step.build()
}

function createBlock(id: AstNodeId): BasicBlockASTNode {
  return ASTTestFactory.block('test', BlockType.BASIC)
    .withId(id)
    .build() as BasicBlockASTNode
}

function createFieldBlock(id: AstNodeId, validate = false): FieldBlockASTNode {
  return ASTTestFactory.block('text-input', BlockType.FIELD)
    .withId(id)
    .withProperty(
      'validate',
      validate
        ? [
            {
              id: `${id}:validation` as AstNodeId,
              type: ASTNodeType.EXPRESSION,
              expressionType: ExpressionType.VALIDATION,
              properties: {
                when: { id: `${id}:when` as AstNodeId, type: ASTNodeType.EXPRESSION } as ASTNode,
                message: 'Required',
              },
            },
          ]
        : [],
    )
    .build() as FieldBlockASTNode
}

function createIterate(id: AstNodeId, yieldTemplate?: TemplateValue): IterateASTNode {
  return ASTTestFactory.expression<IterateASTNode>(ExpressionType.ITERATE)
    .withId(id)
    .withProperty('input', [])
    .withProperty('iterator', {
      type: IteratorType.MAP,
      yieldTemplate,
    })
    .build()
}

describe('RuntimePlanBuilder', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildStepRuntimePlan()', () => {
    it('should compile the step runtime topology from metadata and node registry', () => {
      // Arrange
      const dependencies = new CompilationDependencies()
      const journeyAccess = createAccessTransition('compile_ast:1')
      const stepAccess = createAccessTransition('compile_ast:2')
      const action = createActionTransition('compile_ast:3')
      const submit = createSubmitTransition('compile_ast:4')
      const journey = createJourney('compile_ast:5', [journeyAccess])
      const step = createStep('compile_ast:6', {
        onAccess: [stepAccess],
        onAction: [action],
        onSubmission: [submit],
      })
      const block = createBlock('compile_ast:7')
      const staticValidatingField = createFieldBlock('compile_ast:8', true)
      const externalBlock = createBlock('compile_ast:9')
      const iterateA = createIterate('compile_ast:10', {
        field: {
          type: ASTNodeType.TEMPLATE,
          originalType: ASTNodeType.BLOCK,
          id: 'template:1',
          blockType: BlockType.FIELD,
          properties: {
            validate: ['required'],
          },
        },
      })
      const iterateB = createIterate('compile_ast:11', {
        field: {
          type: ASTNodeType.TEMPLATE,
          originalType: ASTNodeType.BLOCK,
          id: 'template:2',
          blockType: BlockType.FIELD,
          properties: {},
        },
      })

      dependencies.nodeRegistry.register(journey.id, journey)
      dependencies.nodeRegistry.register(step.id, step)
      dependencies.nodeRegistry.register(block.id, block)
      dependencies.nodeRegistry.register(staticValidatingField.id, staticValidatingField)
      dependencies.nodeRegistry.register(externalBlock.id, externalBlock)
      dependencies.nodeRegistry.register(iterateA.id, iterateA)
      dependencies.nodeRegistry.register(iterateB.id, iterateB)

      dependencies.metadataRegistry.set(step.id, 'attachedToParentNode', journey.id)
      dependencies.metadataRegistry.set(block.id, 'attachedToParentNode', step.id)
      dependencies.metadataRegistry.set(staticValidatingField.id, 'attachedToParentNode', step.id)
      dependencies.metadataRegistry.set(iterateA.id, 'attachedToParentNode', block.id)
      dependencies.metadataRegistry.set(iterateB.id, 'attachedToParentNode', block.id)
      dependencies.metadataRegistry.set(externalBlock.id, 'attachedToParentNode', journey.id)

      dependencies.astNodeTree.addNode(journey.id)
      dependencies.astNodeTree.addNode(step.id, journey.id)
      dependencies.astNodeTree.addNode(block.id, step.id)
      dependencies.astNodeTree.addNode(staticValidatingField.id, step.id)
      dependencies.astNodeTree.addNode(iterateA.id, block.id)
      dependencies.astNodeTree.addNode(iterateB.id, block.id)
      dependencies.astNodeTree.addNode(externalBlock.id, journey.id)

      const builder = new RuntimePlanBuilder(
        dependencies.nodeRegistry,
        dependencies.metadataRegistry,
        dependencies.astNodeTree,
      )

      // Act
      const result = builder.buildStepRuntimePlan(step, dependencies)

      // Assert
      expect(result).toEqual({
        stepId: step.id,
        path: 'step',
        code: undefined,
        accessAncestorIds: [journey.id, step.id],
        actionTransitionIds: [action.id],
        submitTransitionIds: [submit.id],
        fieldIteratorRootIds: [block.id],
        validationIterateNodeIds: [iterateA.id],
        validationBlockIds: [staticValidatingField.id],
        domainValidationNodeIds: [],
        renderAncestorIds: [journey.id],
        renderStepId: step.id,
        isRenderSync: true,
        isAnswerPrepareSync: false,
        isValidationSync: false,
        hasValidatingSubmitTransition: false,
        hasDomainValidation: false,
      })
    })
  })
})
