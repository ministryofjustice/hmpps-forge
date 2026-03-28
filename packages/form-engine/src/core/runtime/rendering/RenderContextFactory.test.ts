import { AstNodeId } from '@form-engine/core/types/engine.type'
import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType } from '@form-engine/form/types/enums'
import { StepValidationFailure } from '@form-engine/core/compilation/thunks/ThunkEvaluationContext'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import RenderContextFactory, { RenderContextInput, RenderContextOptions } from './RenderContextFactory'
import { Evaluated, JourneyAncestor, JourneyMetadata, StepMetadata } from './types'

function createMockBlock(id: AstNodeId, overrides: Partial<Evaluated<BlockASTNode>['properties']> = {}) {
  return {
    id,
    type: ASTNodeType.BLOCK,
    variant: 'TextInput',
    blockType: BlockType.FIELD,
    properties: {
      label: 'Test Label',
      ...overrides,
    },
  } as Evaluated<BlockASTNode>
}

function createRenderInput(overrides: Partial<RenderContextInput> = {}): RenderContextInput {
  return {
    step: {
      path: '/journey/step',
      title: 'Step Title',
    },
    ancestors: [],
    blocks: [],
    answers: { email: { current: 'user@example.com', mutations: [] } },
    data: { existingData: 'value' },
    fieldValidationFailures: [],
    ...overrides,
  }
}

function createStoredStep(path: string, title?: string): StepMetadata {
  return {
    path,
    title,
  }
}

function createStoredJourney(
  path: string,
  children: Array<JourneyMetadata | StepMetadata>,
  overrides: Partial<JourneyMetadata> = {},
): JourneyMetadata {
  return {
    path,
    children,
    ...overrides,
  }
}

describe('RenderContextFactory', () => {
  describe('build()', () => {
    it('should build render context from explicit evaluated inputs', () => {
      // Arrange
      const block = createMockBlock('compile_ast:1')
      const ancestor: JourneyAncestor = {
        code: 'journey',
        path: '/journey',
        title: 'Journey Title',
      }
      const input = createRenderInput({
        ancestors: [ancestor],
        blocks: [block],
      })

      // Act
      const result = RenderContextFactory.build(input)

      // Assert
      expect(result.step).toEqual({
        path: '/journey/step',
        title: 'Step Title',
      })
      expect(result.ancestors).toEqual([ancestor])
      expect(result.blocks).toEqual([block])
      expect(result.answers).toEqual({ email: { current: 'user@example.com', mutations: [] } })
      expect(result.data).toEqual({ existingData: 'value' })
      expect(result.showValidationFailures).toBe(false)
      expect(result.fieldValidationErrors).toEqual([])
      expect(result.domainValidationErrors).toEqual([])
    })

    it('should attach stored validation failures to matching field blocks when enabled', () => {
      // Arrange
      const block = createMockBlock('compile_ast:2', {
        validate: [{ passed: false, message: 'Old cached error', submissionOnly: true }],
      })
      const failures: StepValidationFailure[] = [
        {
          blockId: block.id,
          blockCode: 'email',
          passed: false,
          message: 'Enter your email address',
          submissionOnly: true,
          details: { code: 'required' },
        },
      ]
      const input = createRenderInput({
        blocks: [block],
        fieldValidationFailures: failures,
      })

      // Act
      const result = RenderContextFactory.build(input, { showValidationFailures: true })

      // Assert
      expect(result.fieldValidationErrors).toEqual([
        {
          blockCode: 'email',
          passed: false,
          message: 'Enter your email address',
          submissionOnly: true,
          details: { code: 'required' },
        },
      ])
      expect(result.blocks[0].properties.validate).toEqual([
        {
          blockCode: 'email',
          passed: false,
          message: 'Enter your email address',
          submissionOnly: true,
          details: { code: 'required' },
        },
      ])
    })

    it('should preserve existing block validation state when failures are not supplied', () => {
      // Arrange
      const block = createMockBlock('compile_ast:3', {
        validate: [{ passed: false, message: 'Existing error', submissionOnly: true }],
      })
      const input = createRenderInput({
        blocks: [block],
      })

      // Act
      const result = RenderContextFactory.build(input, { showValidationFailures: true })

      // Assert
      expect(result.fieldValidationErrors).toEqual([])
      expect(result.blocks[0].properties.validate).toEqual([
        { passed: false, message: 'Existing error', submissionOnly: true },
      ])
    })

    it('should apply validation failures to nested field blocks', () => {
      // Arrange
      const nestedBlock = createMockBlock('compile_ast:4')
      const containerBlock = {
        id: 'compile_ast:container' as AstNodeId,
        type: ASTNodeType.BLOCK,
        variant: 'SummaryCard',
        blockType: BlockType.BASIC,
        properties: {
          content: {
            child: nestedBlock,
          },
        },
      } as Evaluated<BlockASTNode>
      const input = createRenderInput({
        blocks: [containerBlock],
        fieldValidationFailures: [
          {
            blockId: nestedBlock.id,
            blockCode: 'nested',
            passed: false,
            message: 'Nested error',
            submissionOnly: true,
          },
        ],
      })

      // Act
      const result = RenderContextFactory.build(input, { showValidationFailures: true })

      // Assert
      const renderedNestedBlock = (result.blocks[0].properties.content as { child: Evaluated<BlockASTNode> }).child

      expect(renderedNestedBlock.properties.validate).toEqual([
        {
          blockCode: 'nested',
          passed: false,
          message: 'Nested error',
          submissionOnly: true,
        },
      ])
    })

    it('should include domain validation errors when showValidationFailures is true', () => {
      // Arrange
      const input = createRenderInput({
        domainValidationFailures: [
          {
            passed: false,
            message: 'Assessment is not open',
            submissionOnly: false,
          },
        ],
      })

      // Act
      const result = RenderContextFactory.build(input, { showValidationFailures: true })

      // Assert
      expect(result.domainValidationErrors).toEqual([
        {
          passed: false,
          message: 'Assessment is not open',
          submissionOnly: false,
        },
      ])
    })

    it('should not include domain validation errors when showValidationFailures is false', () => {
      // Arrange
      const input = createRenderInput({
        domainValidationFailures: [
          {
            passed: false,
            message: 'Assessment is not open',
            submissionOnly: false,
          },
        ],
      })

      // Act
      const result = RenderContextFactory.build(input)

      // Assert
      expect(result.domainValidationErrors).toEqual([])
    })

    it('should build navigation tree with active state from metadata', () => {
      // Arrange
      const input = createRenderInput()
      const options: RenderContextOptions = {
        navigationMetadata: [
          createStoredJourney(
            '/journey',
            [
              createStoredStep('/journey/step-1', 'Step 1'),
              createStoredJourney('/journey/child', [createStoredStep('/journey/child/step', 'Child Step')], {
                title: 'Child Journey',
              }),
            ],
            {
              title: 'Journey',
              description: 'Journey Description',
            },
          ),
        ],
        currentStepPath: '/journey/child/step',
      }

      // Act
      const result = RenderContextFactory.build(input, options)

      // Assert
      expect(result.navigation).toEqual([
        {
          type: 'journey',
          title: 'Journey',
          description: 'Journey Description',
          path: '/journey',
          active: true,
          hiddenFromNavigation: undefined,
          children: [
            {
              type: 'step',
              title: 'Step 1',
              path: '/journey/step-1',
              active: false,
              hiddenFromNavigation: undefined,
            },
            {
              type: 'journey',
              title: 'Child Journey',
              description: undefined,
              path: '/journey/child',
              active: true,
              hiddenFromNavigation: undefined,
              children: [
                {
                  type: 'step',
                  title: 'Child Step',
                  path: '/journey/child/step',
                  active: true,
                  hiddenFromNavigation: undefined,
                },
              ],
            },
          ],
        },
      ])
    })
  })
})
