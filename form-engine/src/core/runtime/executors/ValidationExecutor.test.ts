import { ThunkInvocationAdapter, ThunkResult } from '@form-engine/core/compilation/thunks/types'
import ThunkEvaluationContext from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { StepRuntimePlan } from '@form-engine/core/compilation/StepRuntimePlanBuilder'
import { AstNodeId, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { IterateASTNode, ValidationASTNode } from '@form-engine/core/types/expressions.type'
import { FieldBlockASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import { TemplateValue } from '@form-engine/core/types/template.type'
import { BlockType, ExpressionType, IteratorType, PredicateType } from '@form-engine/form/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import ValidationExecutor from './ValidationExecutor'

function createStep(id: AstNodeId): StepASTNode {
  return ASTTestFactory.step()
    .withId(id)
    .withPath('/step')
    .withTitle('Step')
    .build()
}

function createFieldBlock(id: AstNodeId): FieldBlockASTNode {
  return ASTTestFactory.block('text-input', BlockType.FIELD)
    .withId(id)
    .build() as FieldBlockASTNode
}

function createValidationNode(id: AstNodeId, message: string): ValidationASTNode {
  const predicateNode = ASTTestFactory.predicate(PredicateType.TEST)

  return ASTTestFactory.expression<ValidationASTNode>(ExpressionType.VALIDATION)
    .withId(id)
    .withProperty('when', predicateNode)
    .withProperty('message', message)
    .build()
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

function createRuntimePlan(stepId: NodeId, options: Partial<StepRuntimePlan> = {}): StepRuntimePlan {
  return {
    stepId,
    accessAncestorIds: [stepId],
    actionTransitionIds: [],
    submitTransitionIds: [],
    fieldIteratorRootIds: [],
    validationIterateNodeIds: [],
    validationBlockIds: [],
    renderAncestorIds: [],
    renderStepId: stepId,
    isRenderSync: false,
    isAnswerPrepareSync: false,
    isValidationSync: false,
    hasValidatingSubmitTransition: false,
    ...options,
  }
}

function successResult<T>(value: T): ThunkResult<T> {
  return { value, metadata: { source: 'test', timestamp: Date.now() } }
}

describe('ValidationExecutor', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  function setup(): {
    context: jest.Mocked<ThunkEvaluationContext>
    invoker: jest.Mocked<ThunkInvocationAdapter>
    nodes: Map<NodeId, any>
    parentByNodeId: Map<NodeId, NodeId>
  } {
    const nodes = new Map<NodeId, any>()
    const parentByNodeId = new Map<NodeId, NodeId>()

    const context = {
      nodeRegistry: {
        get: jest.fn((nodeId: NodeId) => nodes.get(nodeId)),
        findByType: jest.fn((type: string) => {
          const allNodes = [...nodes.values()]

          if (type === ExpressionType.ITERATE) {
            return allNodes.filter(
              node => node.type === ASTNodeType.EXPRESSION && node.expressionType === ExpressionType.ITERATE,
            )
          }

          if (type === BlockType.FIELD) {
            return allNodes.filter(node => node.type === ASTNodeType.BLOCK && node.blockType === BlockType.FIELD)
          }

          return []
        }),
      },
      metadataRegistry: {
        get: jest.fn((nodeId: NodeId, key: string) => {
          if (key === 'attachedToParentNode') {
            return parentByNodeId.get(nodeId)
          }

          return undefined
        }),
      },
      global: {
        answers: {},
        data: {},
      },
    } as unknown as jest.Mocked<ThunkEvaluationContext>

    const invoker = {
      invoke: jest.fn(),
      invokeSync: jest.fn(),
    } as jest.Mocked<ThunkInvocationAdapter>

    return { context, invoker, nodes, parentByNodeId }
  }

  it('should evaluate static validation blocks', async () => {
    // Arrange
    const step = createStep('compile_ast:1')
    const block = createFieldBlock('compile_ast:2')
    const validationNode = createValidationNode('compile_ast:7', 'Looks good')
    const runtimePlan = createRuntimePlan(step.id, { validationBlockIds: [block.id] })
    const { context, invoker, nodes, parentByNodeId } = setup()

    block.properties.code = 'field-1'
    block.properties.validate = [validationNode]
    nodes.set(step.id, step)
    nodes.set(block.id, block)
    nodes.set(validationNode.id, validationNode)
    nodes.set(validationNode.properties.when.id, validationNode.properties.when)
    parentByNodeId.set(block.id, step.id)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === validationNode.id) {
        return successResult({ passed: true, message: 'Looks good', submissionOnly: true })
      }

      return successResult(undefined)
    })

    // Act
    const executor = new ValidationExecutor()
    const result = await executor.execute(runtimePlan, invoker, context)

    // Assert
    expect(result).toEqual({
      isValid: true,
      failures: [],
    })
    expect(invoker.invoke).not.toHaveBeenCalledWith(block.id, context)
  })

  it('should expand validation iterators and evaluate runtime-created field validations', async () => {
    // Arrange
    const step = createStep('compile_ast:3')
    const iterate = createIterate('compile_ast:4', {
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
    const runtimeBlock = createFieldBlock('runtime_ast:1')
    const runtimeValidationNode = createValidationNode('runtime_ast:5', 'This field is required')
    const runtimePlan = createRuntimePlan(step.id, { validationIterateNodeIds: [iterate.id] })
    const { context, invoker, nodes, parentByNodeId } = setup()

    runtimeBlock.properties.code = 'runtime-field'
    runtimeBlock.properties.validate = [runtimeValidationNode]
    nodes.set(step.id, step)
    nodes.set(iterate.id, iterate)
    nodes.set(runtimeValidationNode.id, runtimeValidationNode)
    nodes.set(runtimeValidationNode.properties.when.id, runtimeValidationNode.properties.when)
    parentByNodeId.set(iterate.id, step.id)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === iterate.id) {
        nodes.set(runtimeBlock.id, runtimeBlock)
        parentByNodeId.set(runtimeBlock.id, iterate.id)

        return successResult([])
      }

      if (nodeId === runtimeValidationNode.id) {
        return successResult({ passed: false, message: 'This field is required', submissionOnly: true })
      }

      return successResult(undefined)
    })

    // Act
    const executor = new ValidationExecutor()
    const result = await executor.execute(runtimePlan, invoker, context)

    // Assert
    expect(result).toEqual({
      isValid: false,
      failures: [
        {
          blockId: runtimeBlock.id,
          blockCode: 'runtime-field',
          message: 'This field is required',
          passed: false,
          submissionOnly: true,
        },
      ],
    })
    expect(invoker.invoke).not.toHaveBeenCalledWith(runtimeBlock.id, context)
  })

  it('should recursively expand nested validation iterators', async () => {
    // Arrange
    const step = createStep('compile_ast:5')
    const outerIterate = createIterate('compile_ast:6', {
      nested: {
        type: ASTNodeType.TEMPLATE,
        originalType: ASTNodeType.EXPRESSION,
        id: 'template:2',
        expressionType: ExpressionType.ITERATE,
        properties: {
          iterator: {
            yieldTemplate: {
              field: {
                type: ASTNodeType.TEMPLATE,
                originalType: ASTNodeType.BLOCK,
                id: 'template:3',
                blockType: BlockType.FIELD,
                properties: {
                  validate: ['required'],
                },
              },
            },
          },
        },
      },
    })
    const runtimeNestedIterate = createIterate('runtime_ast:2', {
      field: {
        type: ASTNodeType.TEMPLATE,
        originalType: ASTNodeType.BLOCK,
        id: 'template:4',
        blockType: BlockType.FIELD,
        properties: {
          validate: ['required'],
        },
      },
    })
    const runtimeBlock = createFieldBlock('runtime_ast:3')
    const runtimeValidationNode = createValidationNode('runtime_ast:8', 'Looks good')
    const runtimePlan = createRuntimePlan(step.id, { validationIterateNodeIds: [outerIterate.id] })
    const { context, invoker, nodes, parentByNodeId } = setup()

    runtimeBlock.properties.code = 'nested-field'
    runtimeBlock.properties.validate = [runtimeValidationNode]
    nodes.set(step.id, step)
    nodes.set(outerIterate.id, outerIterate)
    nodes.set(runtimeValidationNode.id, runtimeValidationNode)
    nodes.set(runtimeValidationNode.properties.when.id, runtimeValidationNode.properties.when)
    parentByNodeId.set(outerIterate.id, step.id)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === outerIterate.id) {
        nodes.set(runtimeNestedIterate.id, runtimeNestedIterate)
        parentByNodeId.set(runtimeNestedIterate.id, outerIterate.id)

        return successResult([])
      }

      if (nodeId === runtimeNestedIterate.id) {
        nodes.set(runtimeBlock.id, runtimeBlock)
        parentByNodeId.set(runtimeBlock.id, runtimeNestedIterate.id)

        return successResult([])
      }

      if (nodeId === runtimeValidationNode.id) {
        return successResult({ passed: true, message: 'Looks good', submissionOnly: true })
      }

      return successResult(undefined)
    })

    // Act
    const executor = new ValidationExecutor()
    const result = await executor.execute(runtimePlan, invoker, context)

    // Assert
    expect(result).toEqual({
      isValid: true,
      failures: [],
    })
    expect(invoker.invoke).not.toHaveBeenCalledWith(runtimeBlock.id, context)
  })

  it('should order validation failures by document position when iterator fields appear before static fields', async () => {
    // Arrange
    const step = createStep('compile_ast:20')
    const wrapperBlock = ASTTestFactory.block('template-wrapper', BlockType.BASIC).withId('compile_ast:21').build()
    const iterate = createIterate('compile_ast:22', {
      field: {
        type: ASTNodeType.TEMPLATE,
        originalType: ASTNodeType.BLOCK,
        id: 'template:10',
        blockType: BlockType.FIELD,
        properties: {
          validate: ['required'],
        },
      },
    })
    const staticBlock = createFieldBlock('compile_ast:23')
    const staticValidationNode = createValidationNode('compile_ast:24', 'Static field is required')
    const runtimeBlock = createFieldBlock('runtime_ast:10')
    const runtimeValidationNode = createValidationNode('runtime_ast:11', 'Dynamic field is required')

    step.properties.blocks = [wrapperBlock, staticBlock]

    const runtimePlan = createRuntimePlan(step.id, {
      validationBlockIds: [staticBlock.id],
      validationIterateNodeIds: [iterate.id],
    })
    const { context, invoker, nodes, parentByNodeId } = setup()

    staticBlock.properties.code = 'static-field'
    staticBlock.properties.validate = [staticValidationNode]
    runtimeBlock.properties.code = 'dynamic-field'
    runtimeBlock.properties.validate = [runtimeValidationNode]

    nodes.set(step.id, step)
    nodes.set(wrapperBlock.id, wrapperBlock)
    nodes.set(iterate.id, iterate)
    nodes.set(staticBlock.id, staticBlock)
    nodes.set(staticValidationNode.id, staticValidationNode)
    nodes.set(staticValidationNode.properties.when.id, staticValidationNode.properties.when)
    nodes.set(runtimeValidationNode.id, runtimeValidationNode)
    nodes.set(runtimeValidationNode.properties.when.id, runtimeValidationNode.properties.when)

    parentByNodeId.set(wrapperBlock.id, step.id)
    parentByNodeId.set(iterate.id, wrapperBlock.id)
    parentByNodeId.set(staticBlock.id, step.id)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === iterate.id) {
        nodes.set(runtimeBlock.id, runtimeBlock)
        parentByNodeId.set(runtimeBlock.id, iterate.id)

        return successResult([])
      }

      if (nodeId === runtimeValidationNode.id) {
        return successResult({ passed: false, message: 'Dynamic field is required', submissionOnly: true })
      }

      if (nodeId === staticValidationNode.id) {
        return successResult({ passed: false, message: 'Static field is required', submissionOnly: true })
      }

      return successResult(undefined)
    })

    // Act
    const executor = new ValidationExecutor()
    const result = await executor.execute(runtimePlan, invoker, context)

    // Assert
    expect(result.isValid).toBe(false)
    expect(result.failures).toHaveLength(2)
    expect(result.failures[0].blockCode).toBe('dynamic-field')
    expect(result.failures[1].blockCode).toBe('static-field')
  })

  describe('executeSync()', () => {
    it('should evaluate static validation blocks synchronously', () => {
      // Arrange
      const step = createStep('compile_ast:30')
      const block = createFieldBlock('compile_ast:31')
      const validationNode = createValidationNode('compile_ast:32', 'Looks good')
      const runtimePlan = createRuntimePlan(step.id, { validationBlockIds: [block.id] })
      const { context, invoker, nodes, parentByNodeId } = setup()

      block.properties.code = 'field-1'
      block.properties.validate = [validationNode]
      nodes.set(step.id, step)
      nodes.set(block.id, block)
      nodes.set(validationNode.id, validationNode)
      nodes.set(validationNode.properties.when.id, validationNode.properties.when)
      parentByNodeId.set(block.id, step.id)

      invoker.invokeSync.mockImplementation(nodeId => {
        if (nodeId === validationNode.id) {
          return successResult({ passed: true, message: 'Looks good', submissionOnly: true })
        }

        return successResult(undefined)
      })

      // Act
      const executor = new ValidationExecutor()
      const result = executor.executeSync(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({
        isValid: true,
        failures: [],
      })
      expect(invoker.invokeSync).not.toHaveBeenCalledWith(block.id, context)
    })

    it('should collect failures synchronously', () => {
      // Arrange
      const step = createStep('compile_ast:33')
      const block = createFieldBlock('compile_ast:34')
      const validationNode = createValidationNode('compile_ast:35', 'This field is required')
      const runtimePlan = createRuntimePlan(step.id, { validationBlockIds: [block.id] })
      const { context, invoker, nodes, parentByNodeId } = setup()

      block.properties.code = 'field-1'
      block.properties.validate = [validationNode]
      nodes.set(step.id, step)
      nodes.set(block.id, block)
      nodes.set(validationNode.id, validationNode)
      nodes.set(validationNode.properties.when.id, validationNode.properties.when)
      parentByNodeId.set(block.id, step.id)

      invoker.invokeSync.mockImplementation(nodeId => {
        if (nodeId === validationNode.id) {
          return successResult({ passed: false, message: 'This field is required', submissionOnly: true })
        }

        return successResult(undefined)
      })

      // Act
      const executor = new ValidationExecutor()
      const result = executor.executeSync(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({
        isValid: false,
        failures: [
          {
            blockId: block.id,
            blockCode: 'field-1',
            message: 'This field is required',
            passed: false,
            submissionOnly: true,
          },
        ],
      })
    })

    it('should skip validation when dependent evaluates to false synchronously', () => {
      // Arrange
      const step = createStep('compile_ast:36')
      const block = createFieldBlock('compile_ast:37')
      const dependentNode = ASTTestFactory.reference(['answers', 'businessType'])
      const validationNode = createValidationNode('compile_ast:38', 'Should not run')
      const runtimePlan = createRuntimePlan(step.id, { validationBlockIds: [block.id] })
      const { context, invoker, nodes, parentByNodeId } = setup()

      block.properties.code = 'business-hours'
      block.properties.dependent = dependentNode
      block.properties.validate = [validationNode]
      nodes.set(step.id, step)
      nodes.set(block.id, block)
      nodes.set(dependentNode.id, dependentNode)
      nodes.set(validationNode.id, validationNode)
      nodes.set(validationNode.properties.when.id, validationNode.properties.when)
      parentByNodeId.set(block.id, step.id)

      invoker.invokeSync.mockImplementation(nodeId => {
        if (nodeId === dependentNode.id) {
          return successResult(false)
        }

        if (nodeId === validationNode.id) {
          return successResult({ passed: false, message: 'Should not run', submissionOnly: true })
        }

        return successResult(undefined)
      })

      // Act
      const executor = new ValidationExecutor()
      const result = executor.executeSync(runtimePlan, invoker, context)

      // Assert
      expect(result).toEqual({
        isValid: true,
        failures: [],
      })
      expect(invoker.invokeSync).toHaveBeenCalledWith(dependentNode.id, context)
      expect(invoker.invokeSync).not.toHaveBeenCalledWith(validationNode.id, context)
    })
  })

  it('should skip validation nodes when dependent evaluates to false', async () => {
    // Arrange
    const step = createStep('compile_ast:9')
    const block = createFieldBlock('compile_ast:10')
    const dependentNode = ASTTestFactory.reference(['answers', 'businessType'])
    const validationNode = createValidationNode('compile_ast:11', 'Should not run')
    const runtimePlan = createRuntimePlan(step.id, { validationBlockIds: [block.id] })
    const { context, invoker, nodes, parentByNodeId } = setup()

    block.properties.code = 'business-hours'
    block.properties.dependent = dependentNode
    block.properties.validate = [validationNode]
    nodes.set(step.id, step)
    nodes.set(block.id, block)
    nodes.set(dependentNode.id, dependentNode)
    nodes.set(validationNode.id, validationNode)
    nodes.set(validationNode.properties.when.id, validationNode.properties.when)
    parentByNodeId.set(block.id, step.id)

    invoker.invoke.mockImplementation(async nodeId => {
      if (nodeId === dependentNode.id) {
        return successResult(false)
      }

      if (nodeId === validationNode.id) {
        return successResult({ passed: false, message: 'Should not run', submissionOnly: true })
      }

      return successResult(undefined)
    })

    // Act
    const executor = new ValidationExecutor()
    const result = await executor.execute(runtimePlan, invoker, context)

    // Assert
    expect(result).toEqual({
      isValid: true,
      failures: [],
    })
    expect(invoker.invoke).toHaveBeenCalledWith(dependentNode.id, context)
    expect(invoker.invoke).not.toHaveBeenCalledWith(validationNode.id, context)
  })
})
