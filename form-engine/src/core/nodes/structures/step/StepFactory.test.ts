import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType, StructureType, TransitionType } from '@form-engine/form/types/enums'
import type { BlockDefinition, StepDefinition } from '@form-engine/form/types/structures.type'
import type {
  AccessTransition,
  EffectFunctionExpr,
  LoadTransition,
  NextExpr,
  SubmitTransition,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { NodeFactory } from '@form-engine/core/ast/nodes/NodeFactory'
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

    it('should transform onLoad transitions', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        onLoad: [
          {
            type: TransitionType.LOAD,
            effects: [] as EffectFunctionExpr[],
          } satisfies LoadTransition,
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const onLoad = result.properties.onLoad

      // Assert
      expect(Array.isArray(onLoad)).toBe(true)
      expect(onLoad).toHaveLength(1)
    })

    it('should transform onAccess transitions', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        onAccess: [
          {
            type: TransitionType.ACCESS,
            redirect: [] as NextExpr[],
          } satisfies AccessTransition,
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const onAccess = result.properties.onAccess

      // Assert
      expect(Array.isArray(onAccess)).toBe(true)
      expect(onAccess).toHaveLength(1)
    })

    it('should transform onSubmission transitions', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        onSubmission: [
          {
            type: TransitionType.SUBMIT,
            validate: false,
            onAlways: {
              next: [] as NextExpr[],
            },
          } satisfies SubmitTransition,
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const onSubmission = result.properties.onSubmission

      // Assert
      expect(Array.isArray(onSubmission)).toBe(true)
      expect(onSubmission).toHaveLength(1)
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
