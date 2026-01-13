import { AstNodeId, NodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'
import { EvaluationResult } from '@form-engine/core/compilation/thunks/ThunkEvaluator'
import { BlockASTNode, JourneyASTNode, StepASTNode } from '@form-engine/core/types/structures.type'
import MetadataRegistry from '@form-engine/core/compilation/registries/MetadataRegistry'
import ThunkCacheManager from '@form-engine/core/compilation/thunks/ThunkCacheManager'
import NodeRegistry from '@form-engine/core/compilation/registries/NodeRegistry'
import RenderContextFactory, { RenderContextOptions } from './RenderContextFactory'
import { Evaluated, JourneyMetadata, StepMetadata } from './types'

describe('RenderContextFactory', () => {
  const createMockBlock = (id: AstNodeId, variant: string = 'TextInput'): Evaluated<BlockASTNode> => ({
    id,
    type: ASTNodeType.BLOCK,
    variant,
    blockType: BlockType.FIELD,
    properties: { label: 'Test Label' },
  })

  const createMockStep = (
    id: AstNodeId,
    overrides: Partial<Evaluated<StepASTNode>['properties']> = {},
  ): Evaluated<StepASTNode> => ({
    id,
    type: ASTNodeType.STEP,
    properties: {
      path: '/test-step',
      title: 'Test Step',
      blocks: [],
      ...overrides,
    },
  })

  const createMockJourney = (
    id: AstNodeId,
    steps: Evaluated<StepASTNode>[],
    overrides: Partial<JourneyASTNode['properties']> = {},
  ): JourneyASTNode =>
    ({
      id,
      type: ASTNodeType.JOURNEY,
      properties: {
        code: 'test-journey',
        path: '/test-journey',
        steps,
        ...overrides,
      } as any,
    }) as any

  /**
   * Build parent map from journey structure for metadata registry
   */
  const buildParentMapFromJourney = (journey: JourneyASTNode): Record<NodeId, NodeId> => {
    const parentMap: Record<NodeId, NodeId> = {}

    const traverse = (node: JourneyASTNode, parentId?: NodeId) => {
      if (parentId) {
        parentMap[node.id] = parentId
      }

      node.properties.steps?.forEach(step => {
        parentMap[step.id] = node.id
      })

      node.properties.children?.forEach(child => {
        traverse(child as JourneyASTNode, node.id)
      })
    }

    traverse(journey)

    return parentMap
  }

  /**
   * Collect all nodes from journey tree to populate cache
   */
  const collectNodesFromJourney = (
    journey: JourneyASTNode,
  ): Map<NodeId, Evaluated<JourneyASTNode> | Evaluated<StepASTNode>> => {
    const nodes = new Map<NodeId, Evaluated<JourneyASTNode> | Evaluated<StepASTNode>>()

    const traverse = (node: JourneyASTNode) => {
      nodes.set(node.id, node as Evaluated<JourneyASTNode>)

      node.properties.steps?.forEach(step => {
        nodes.set(step.id, step as Evaluated<StepASTNode>)
      })

      node.properties.children?.forEach(child => {
        traverse(child as JourneyASTNode)
      })
    }

    traverse(journey)

    return nodes
  }

  const createMockMetadataRegistry = (parentMap: Record<NodeId, NodeId>): MetadataRegistry => {
    const registry = new MetadataRegistry()

    Object.entries(parentMap).forEach(([childId, parentId]) => {
      registry.set(childId as NodeId, 'attachedToParentNode', parentId)
    })

    return registry
  }

  const createMockCacheManager = (
    nodes: Map<NodeId, Evaluated<JourneyASTNode> | Evaluated<StepASTNode>>,
  ): ThunkCacheManager => {
    const cacheManager = new ThunkCacheManager()

    nodes.forEach((value, nodeId) => {
      cacheManager.set(nodeId, { value, metadata: {} })
    })

    return cacheManager
  }

  const createMockNodeRegistry = (): NodeRegistry => {
    // Create a mock registry that returns empty arrays for pseudo node lookups
    return {
      findByPseudoType: jest.fn().mockReturnValue([]),
    } as unknown as NodeRegistry
  }

  const createMockEvaluationResult = (journeyValue: JourneyASTNode): EvaluationResult => {
    const parentMap = buildParentMapFromJourney(journeyValue)
    const nodes = collectNodesFromJourney(journeyValue)

    return {
      context: {
        global: {
          answers: { existingAnswer: { current: 'answer-value', mutations: [] } },
          data: { existingData: 'data-value' },
        },
        metadataRegistry: createMockMetadataRegistry(parentMap),
        cacheManager: createMockCacheManager(nodes),
        nodeRegistry: createMockNodeRegistry(),
      } as any,
      journey: {
        value: journeyValue,
        metadata: { source: 'test', timestamp: Date.now() },
      },
    }
  }

  const createStoredStep = (path: string, title?: string): StepMetadata => ({
    path,
    title,
  })

  const createStoredJourney = (
    path: string,
    children: Array<JourneyMetadata | StepMetadata>,
    overrides: Partial<JourneyMetadata> = {},
  ): JourneyMetadata => ({
    path,
    children,
    ...overrides,
  })

  describe('build()', () => {
    it('should build render context with step and blocks', () => {
      // Arrange
      const block = createMockBlock('compile_ast:3')
      const step = createMockStep('compile_ast:2', { blocks: [block] })
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.step).toEqual({
        path: '/test-step',
        title: 'Test Step',
      })
      expect(result.blocks).toEqual([block])
      expect(result.showValidationFailures).toBe(false)
    })

    it('should include answers and data from evaluation context', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.answers).toEqual({ existingAnswer: { current: 'answer-value', mutations: [] } })
      expect(result.data).toEqual({ existingData: 'data-value' })
    })

    it('should set showValidationFailures when option is true', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)
      const options: RenderContextOptions = { showValidationFailures: true }

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2' as NodeId, options)

      // Assert
      expect(result.showValidationFailures).toBe(true)
    })

    it('should exclude transitions from step properties', () => {
      // Arrange
      const step = createMockStep('compile_ast:2', {
        onLoad: [{ type: 'load-transition' }],
        onAction: [{ type: 'action-transition' }],
        onSubmission: [{ type: 'submit-transition' }],
        backlink: '/previous',
        metadata: { custom: 'value' },
      })
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.step).toEqual({
        path: '/test-step',
        title: 'Test Step',
        backlink: '/previous',
        metadata: { custom: 'value' },
      })
      expect(result.step).not.toHaveProperty('onLoad')
      expect(result.step).not.toHaveProperty('onAction')
      expect(result.step).not.toHaveProperty('onSubmission')
      expect(result.step).not.toHaveProperty('blocks')
    })

    it('should preserve custom step properties', () => {
      // Arrange
      const step = createMockStep('compile_ast:2', {
        view: { layout: 'two-thirds', template: 'custom' },
        customProperty: 'custom-value',
      } as any)
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.step.view).toEqual({ layout: 'two-thirds', template: 'custom' })
      expect((result.step as any).customProperty).toBe('custom-value')
    })

    it('should return empty ancestors array for step in root journey', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.ancestors).toHaveLength(1)
      expect(result.ancestors[0]).toEqual({
        code: 'test-journey',
        path: '/test-journey',
      })
    })

    it('should collect journey ancestors from root to parent', () => {
      // Arrange
      const step = createMockStep('compile_ast:3')
      const childJourney: JourneyASTNode = {
        id: 'compile_ast:2' as NodeId,
        type: 'AstNode.Journey',
        properties: {
          code: 'child-journey',
          path: '/parent/child',
          title: 'Child Journey',
          steps: [step],
        },
      } as any
      const parentJourney: JourneyASTNode = {
        id: 'compile_ast:1' as NodeId,
        type: 'AstNode.Journey',
        properties: {
          code: 'parent-journey',
          path: '/parent',
          title: 'Parent Journey',
          children: [childJourney],
          steps: [],
        },
      } as any
      const evaluationResult = createMockEvaluationResult(parentJourney)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:3' as NodeId)

      // Assert
      expect(result.ancestors).toHaveLength(2)
      expect(result.ancestors[0]).toEqual({
        code: 'parent-journey',
        path: '/parent',
        title: 'Parent Journey',
      })
      expect(result.ancestors[1]).toEqual({
        code: 'child-journey',
        path: '/parent/child',
        title: 'Child Journey',
      })
    })

    it('should exclude transitions from journey ancestors', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step], {
        onLoad: [{ type: ASTNodeType.TRANSITION }] as any,
        onAccess: [{ type: ASTNodeType.TRANSITION }] as any,
        title: 'Journey Title',
        metadata: { version: '1.0' },
      })
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.ancestors[0]).toEqual({
        code: 'test-journey',
        path: '/test-journey',
        title: 'Journey Title',
        metadata: { version: '1.0' },
      })
      expect(result.ancestors[0]).not.toHaveProperty('onLoad')
      expect(result.ancestors[0]).not.toHaveProperty('onAccess')
      expect(result.ancestors[0]).not.toHaveProperty('children')
      expect(result.ancestors[0]).not.toHaveProperty('steps')
    })

    it('should return empty navigation when no metadata provided', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2')

      // Assert
      expect(result.navigation).toEqual([])
    })

    it('should build navigation tree from metadata', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      const navigationMetadata: JourneyMetadata[] = [
        createStoredJourney('/journey-1', [createStoredStep('/journey-1/step-1', 'Step 1')], { title: 'Journey 1' }),
      ]

      const options: RenderContextOptions = { navigationMetadata }

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2' as NodeId, options)

      // Assert
      expect(result.navigation).toHaveLength(1)
      expect(result.navigation[0]).toEqual({
        type: 'journey',
        title: 'Journey 1',
        description: undefined,
        path: '/journey-1',
        active: false,
        children: [
          {
            type: 'step',
            title: 'Step 1',
            path: '/journey-1/step-1',
            active: false,
          },
        ],
      })
    })

    it('should mark current step as active', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      const navigationMetadata: JourneyMetadata[] = [
        createStoredJourney('/journey', [
          createStoredStep('/journey/step-1', 'Step 1'),
          createStoredStep('/journey/step-2', 'Step 2'),
        ]),
      ]

      const options: RenderContextOptions = {
        navigationMetadata,
        currentStepPath: '/journey/step-2',
      }

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2' as NodeId, options)

      // Assert
      expect(result.navigation[0].active).toBe(true)
      expect(result.navigation[0].children[0].active).toBe(false)
      expect(result.navigation[0].children[1].active).toBe(true)
    })

    it('should mark parent journey as active when child step is active', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      const navigationMetadata: JourneyMetadata[] = [
        createStoredJourney('/parent', [
          createStoredJourney('/parent/child', [createStoredStep('/parent/child/step', 'Active Step')]),
        ]),
      ]

      const options: RenderContextOptions = {
        navigationMetadata,
        currentStepPath: '/parent/child/step',
      }

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2' as NodeId, options)

      // Assert
      expect(result.navigation[0].active).toBe(true)
      expect((result.navigation[0].children[0] as any).active).toBe(true)
      expect((result.navigation[0].children[0] as any).children[0].active).toBe(true)
    })

    it('should handle deeply nested navigation structure', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      const navigationMetadata: JourneyMetadata[] = [
        createStoredJourney(
          '/level1',
          [
            createStoredJourney(
              '/level1/level2',
              [
                createStoredJourney(
                  '/level1/level2/level3',
                  [createStoredStep('/level1/level2/level3/step', 'Deep Step')],
                  {
                    title: 'Level 3',
                  },
                ),
              ],
              { title: 'Level 2' },
            ),
          ],
          { title: 'Level 1' },
        ),
      ]

      const options: RenderContextOptions = {
        navigationMetadata,
        currentStepPath: '/level1/level2/level3/step',
      }

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2' as NodeId, options)

      // Assert
      const level1 = result.navigation[0]
      const level2 = level1.children[0] as any
      const level3 = level2.children[0] as any
      const deepStep = level3.children[0]

      expect(level1.active).toBe(true)
      expect(level2.active).toBe(true)
      expect(level3.active).toBe(true)
      expect(deepStep.active).toBe(true)
    })

    it('should include description in navigation journey', () => {
      // Arrange
      const step = createMockStep('compile_ast:2')
      const journey = createMockJourney('compile_ast:1', [step])
      const evaluationResult = createMockEvaluationResult(journey)

      const navigationMetadata: JourneyMetadata[] = [
        createStoredJourney('/journey', [createStoredStep('/journey/step', 'Step')], {
          title: 'Journey Title',
          description: 'Journey Description',
        }),
      ]

      const options: RenderContextOptions = { navigationMetadata }

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:2' as NodeId, options)

      // Assert
      expect(result.navigation[0].description).toBe('Journey Description')
    })

    it('should find step in nested journey structure', () => {
      // Arrange
      const targetStep = createMockStep('compile_ast:4', { title: 'Target Step' })
      const otherStep = createMockStep('compile_ast:3', { title: 'Other Step' })
      const childJourney = createMockJourney('compile_ast:2', [targetStep], {
        code: 'child',
        path: '/parent/child',
      })
      const parentJourney = createMockJourney('compile_ast:1', [otherStep], {
        code: 'parent',
        path: '/parent',
        children: [childJourney],
      })
      const evaluationResult = createMockEvaluationResult(parentJourney)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:4')

      // Assert
      expect(result.step.title).toBe('Target Step')
    })

    it('should find step among multiple steps in journey', () => {
      // Arrange
      const step1 = createMockStep('compile_ast:2', { title: 'First Step' })
      const step2 = createMockStep('compile_ast:3', { title: 'Second Step' })
      const step3 = createMockStep('compile_ast:4', { title: 'Third Step' })
      const journey = createMockJourney('compile_ast:1', [step1, step2, step3])
      const evaluationResult = createMockEvaluationResult(journey)

      // Act
      const result = RenderContextFactory.build(evaluationResult, 'compile_ast:3' as NodeId)

      // Assert
      expect(result.step.title).toBe('Second Step')
    })
  })
})
