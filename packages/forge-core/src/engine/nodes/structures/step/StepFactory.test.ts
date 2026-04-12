import { ASTNodeType } from '../../../types/enums'
import { BlockType, HookType, StructureType } from '../../../../authoring/types/enums'
import type { StepDefinition } from '../../../../authoring/types/structures.type'
import type { BlockDefinition } from '../../../../components/types/structures.type'
import type { AccessHook, SubmitHook, HookOutcome } from '../../../../authoring/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '../../../compilation/id-generators/NodeIDGenerator'
import { BlockASTNode } from '../../../types/structures.type'
import { NodeFactory } from '../../NodeFactory'
import StepFactory from './StepFactory'

describe('StepFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let stepFactory: StepFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    stepFactory = new StepFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create()', () => {
    it('should create a Step node with basic properties', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        code: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.STEP)
      expect(result.raw).toBe(json)
      expect(result.properties.path).toBe('test-step')
      expect(result.properties.code).toBe('test-step')
    })

    it('should transform nested blocks using nodeFactory', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [
          {
            type: StructureType.BLOCK,
            blockType: BlockType.BASIC,
            variant: 'Block1',
          } satisfies BlockDefinition,
          {
            type: StructureType.BLOCK,
            blockType: BlockType.BASIC,
            variant: 'Block2',
          } satisfies BlockDefinition,
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const blocks = result.properties.blocks as BlockASTNode[]

      // Assert
      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks).toHaveLength(2)
      blocks.forEach((block: BlockASTNode) => {
        expect(block.type).toBe(ASTNodeType.BLOCK)
      })
    })

    it('should transform onAccess hooks', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        onAccess: [
          {
            type: HookType.ACCESS,
            next: [] as HookOutcome[],
          } satisfies AccessHook,
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const onAccess = result.properties.onAccess

      // Assert
      expect(Array.isArray(onAccess)).toBe(true)
      expect(onAccess).toHaveLength(1)
    })

    it('should transform onSubmission hooks', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        onSubmission: [
          {
            type: HookType.SUBMIT,
            validate: false,
            onAlways: {
              next: [] as HookOutcome[],
            },
          } satisfies SubmitHook,
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const onSubmission = result.properties.onSubmission

      // Assert
      expect(Array.isArray(onSubmission)).toBe(true)
      expect(onSubmission).toHaveLength(1)
    })

    it('should pass through cleardownFieldCodes', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        cleardownFieldCodes: ['fieldA', '^task_\\d+$'],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect(result.properties.cleardownFieldCodes).toEqual(['fieldA', '^task_\\d+$'])
    })

    it('should omit cleardownFieldCodes when not specified', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect(result.properties.cleardownFieldCodes).toBeUndefined()
    })

    it('should exclude type from properties', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect('type' in result.properties).toBe(false)
      expect('path' in result.properties).toBe(true)
    })
  })
})
