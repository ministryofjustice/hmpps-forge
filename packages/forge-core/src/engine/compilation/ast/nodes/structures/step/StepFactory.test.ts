import { ASTNodeType } from '../../../../../contracts/ast/enums'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  HookType,
  PredicateType,
  StructureType,
} from '../../../../../../authoring/types/enums'
import type { StepDefinition } from '../../../../../../authoring/types/structures.type'
import type { BlockDefinition } from '../../../../../../components/types/structures.type'
import type {
  AccessHook,
  SubmitHook,
  HookOutcome,
  ResolvableValue,
} from '../../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { BlockASTNode } from '../../../../../contracts/ast/structures.type'
import { NodeFactory } from '../../NodeFactory'
import StepFactory from './StepFactory'

describe('StepFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let stepFactory: StepFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator)
    stepFactory = new StepFactory(nodeIDGenerator, nodeFactory)
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

    it('should transform validateOnEntry predicates', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        validateOnEntry: [
          {
            groups: ['contact'],
            when: true,
          },
          {
            groups: ['address'],
            when: {
              type: PredicateType.TEST,
              negate: false,
              subject: { type: ExpressionType.REFERENCE, path: ['data', 'addressLoaded'] },
              condition: { type: FunctionType.CONDITION, name: 'Equals', arguments: [true] as ResolvableValue[] },
            },
          },
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect(result.properties.validateOnEntry).toHaveLength(2)
      expect(result.properties.validateOnEntry?.[0]).toEqual({ groups: ['contact'], when: true })
      expect(result.properties.validateOnEntry?.[1].groups).toEqual(['address'])
      expect(result.properties.validateOnEntry?.[1].when).toMatchObject({ type: ASTNodeType.PREDICATE })
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

    it('should omit entryWhen from reachability config when set to false', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        reachability: {
          entryWhen: false,
        },
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect(result.properties.reachability).toBeDefined()
      expect(result.properties.reachability?.entryWhen).toBeUndefined()
    })

    it('should create a child node for entryWhen when set to an expression', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        reachability: {
          entryWhen: { type: ExpressionType.REFERENCE, path: ['data', 'entryActive'] },
        },
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const entryWhen = result.properties.reachability?.entryWhen

      // Assert
      expect(entryWhen).not.toBe(true)
      expect(entryWhen).toMatchObject({ type: ASTNodeType.EXPRESSION, expressionType: ExpressionType.REFERENCE })
    })

    it('should drop validateOnEntry rules whose when is false while keeping the others', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        validateOnEntry: [
          { groups: ['always'], when: true },
          { groups: ['never'], when: false },
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)

      // Assert
      expect(result.properties.validateOnEntry).toHaveLength(1)
      expect(result.properties.validateOnEntry?.[0]).toEqual({ groups: ['always'], when: true })
    })

    it('should create a child node for validateOnEntry when when is set to an expression', () => {
      // Arrange
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        validateOnEntry: [
          { groups: ['conditional'], when: { type: ExpressionType.REFERENCE, path: ['data', 'entryValidation'] } },
        ],
      } satisfies StepDefinition

      // Act
      const result = stepFactory.create(json)
      const when = result.properties.validateOnEntry?.[0]?.when

      // Assert
      expect(when).not.toBe(true)
      expect(when).toMatchObject({ type: ASTNodeType.EXPRESSION, expressionType: ExpressionType.REFERENCE })
    })
  })
})
