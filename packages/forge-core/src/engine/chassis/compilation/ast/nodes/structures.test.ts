import { ASTNodeType } from '../../../contracts/ast/enums'
import {
  ExpressionType,
  StructureType,
  BlockType,
  FunctionType,
  HookType,
  PredicateType,
} from '../../../../../authoring/types/enums'
import type { JourneyDefinition, StepDefinition, ValidationExpr } from '../../../../../authoring/types/structures.type'
import type {
  BlockDefinition,
  ResolvableBoolean,
  FieldBlockDefinition,
} from '../../../../../components/types/structures.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import { StepASTNode, BlockASTNode } from '../../../contracts/ast/structures.type'
import { NodeFactory } from './NodeFactory'
import type {
  AccessHook,
  SubmitHook,
  HookOutcome,
  ResolvableValue,
  PredicateTestExpr,
} from '../../../../../authoring/types/expressions.type'
import { createBlockNode, createJourneyNode, createStepNode } from './structures'

describe('structures', () => {
  describe('createJourneyNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a Journey node with basic properties', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = createJourneyNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.properties.title).toBe('Test Journey')
      expect(result.properties.code).toBe('test-journey')
      expect(result.properties.path).toBe('test-journey')
    })

    it('should transform nested steps using nodeFactory', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [
          {
            type: StructureType.STEP,
            path: 'step1',
            title: 'step1',
            blocks: [] as BlockDefinition[],
          } satisfies StepDefinition,
          {
            type: StructureType.STEP,
            path: 'step2',
            title: 'step2',
            blocks: [] as BlockDefinition[],
          } satisfies StepDefinition,
        ],
      } satisfies JourneyDefinition

      // Act
      const result = createJourneyNode(json, nodeFactory.context)
      const steps = result.properties.steps as StepASTNode[]

      // Assert
      expect(Array.isArray(steps)).toBe(true)
      expect(steps).toHaveLength(2)
      steps.forEach((step: StepASTNode) => {
        expect(step.type).toBe(ASTNodeType.STEP)
      })
    })

    it('should exclude type from properties', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = createJourneyNode(json, nodeFactory.context)

      // Assert
      expect('type' in result.properties).toBe(false)
      expect('title' in result.properties).toBe(true)
    })

    it('should generate unique node IDs', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result1 = createJourneyNode(json, nodeFactory.context)
      const result2 = createJourneyNode(json, nodeFactory.context)

      // Assert
      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })

    it('should pass through unreachable redirect reachability config', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        reachability: {
          unreachableRedirect: 'frontier',
        },
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = createJourneyNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.reachability?.unreachableRedirect).toBe('frontier')
    })

    it('should omit resumeWhen from reachability config when set to false', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: false,
        },
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = createJourneyNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.reachability).toBeDefined()
      expect(result.properties.reachability?.resumeWhen).toBeUndefined()
    })

    it('should create a child node for resumeWhen when set to an expression', () => {
      // Arrange
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        reachability: {
          resumeWhen: {
            type: ExpressionType.REFERENCE,
            path: ['data', 'resumeActive'],
          } as unknown as ResolvableBoolean,
        },
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      // Act
      const result = createJourneyNode(json, nodeFactory.context)
      const resumeWhen = result.properties.reachability?.resumeWhen

      // Assert
      expect(resumeWhen).not.toBe(true)
      expect(resumeWhen).toMatchObject({ type: ASTNodeType.EXPRESSION, expressionType: ExpressionType.REFERENCE })
    })
  })

  describe('createStepNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

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
      const result = createStepNode(json, nodeFactory.context)

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
      const result = createStepNode(json, nodeFactory.context)
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
      const result = createStepNode(json, nodeFactory.context)
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
      const result = createStepNode(json, nodeFactory.context)
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
      const result = createStepNode(json, nodeFactory.context)

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
      const result = createStepNode(json, nodeFactory.context)

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
      const result = createStepNode(json, nodeFactory.context)

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
      const result = createStepNode(json, nodeFactory.context)

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
      const result = createStepNode(json, nodeFactory.context)

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
          entryWhen: { type: ExpressionType.REFERENCE, path: ['data', 'entryActive'] } as unknown as ResolvableBoolean,
        },
      } satisfies StepDefinition

      // Act
      const result = createStepNode(json, nodeFactory.context)
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
      const result = createStepNode(json, nodeFactory.context)

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
          {
            groups: ['conditional'],
            when: { type: ExpressionType.REFERENCE, path: ['data', 'entryValidation'] } as unknown as ResolvableBoolean,
          },
        ],
      } satisfies StepDefinition

      // Act
      const result = createStepNode(json, nodeFactory.context)
      const when = result.properties.validateOnEntry?.[0]?.when

      // Assert
      expect(when).not.toBe(true)
      expect(when).toMatchObject({ type: ASTNodeType.EXPRESSION, expressionType: ExpressionType.REFERENCE })
    })
  })

  describe('createBlockNode()', () => {
    let nodeIDGenerator: NodeIDGenerator
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeIDGenerator = new NodeIDGenerator()
      nodeFactory = new NodeFactory(nodeIDGenerator)
    })

    it('should create a basic Block node', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'TestBlock',
      } satisfies BlockDefinition

      // Act
      const result = createBlockNode(json, nodeFactory.context)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('TestBlock')
      expect(result.blockType).toBe(BlockType.BASIC)
    })

    it('should exclude type and variant from properties', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'TestBlock',
        customProp: 'value',
      } satisfies BlockDefinition & { customProp: string }

      // Act
      const result = createBlockNode(json, nodeFactory.context)

      // Assert
      expect('type' in result.properties).toBe(false)
      expect('variant' in result.properties).toBe(false)
      expect('customProp' in result.properties).toBe(true)
    })

    it('should transform nested blocks', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'Fieldset',
        blocks: [
          {
            type: StructureType.BLOCK,
            blockType: BlockType.FIELD,
            variant: 'TextInput',
            code: 'field1',
          } satisfies FieldBlockDefinition,
          {
            type: StructureType.BLOCK,
            blockType: BlockType.FIELD,
            variant: 'TextInput',
            code: 'field2',
          } satisfies FieldBlockDefinition,
        ],
      } satisfies BlockDefinition & { blocks: FieldBlockDefinition[] }

      // Act
      const result = createBlockNode(json, nodeFactory.context)
      const blocks = result.properties.blocks as BlockASTNode[]

      // Assert
      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks).toHaveLength(2)
      blocks.forEach((block: BlockASTNode) => {
        expect(block.type).toBe(ASTNodeType.BLOCK)
        expect(block.blockType).toBe(BlockType.FIELD)
      })
    })

    it('should create a field Block node with code property', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'email',
      } satisfies FieldBlockDefinition

      // Act
      const result = createBlockNode(json, nodeFactory.context)

      // Assert
      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('TextInput')
      expect(result.blockType).toBe(BlockType.FIELD)
      expect(result.properties.code).toBe('email')
    })

    it('should handle field block with validation', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'email',
        validWhen: [
          {
            type: ExpressionType.VALIDATION,
            condition: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ResolvableValue[] },
            },
            message: 'Email is required',
          },
        ] as ValidationExpr[],
      } satisfies FieldBlockDefinition

      // Act
      const result = createBlockNode(json, nodeFactory.context)
      const validWhen = result.properties.validWhen

      // Assert
      expect(Array.isArray(validWhen)).toBe(true)
      expect(validWhen).toHaveLength(1)
      expect(validWhen[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle field block with dependentWhen property', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'details',
        dependentWhen: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'showDetails'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
      } satisfies FieldBlockDefinition

      // Act
      const result = createBlockNode(json, nodeFactory.context)
      const dependentWhen = result.properties.dependentWhen

      // Assert
      expect(dependentWhen.type).toBe(ASTNodeType.PREDICATE)
    })

    it('should handle field block with custom properties', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'email',
        label: 'Email Address',
        hint: 'Enter your email',
      } satisfies FieldBlockDefinition & { label: string; hint: string }

      // Act
      const result = createBlockNode(json, nodeFactory.context)

      // Assert
      expect(result.properties.label).toBe('Email Address')
      expect(result.properties.hint).toBe('Enter your email')
    })

    it('should handle field block with all properties', () => {
      // Arrange
      const json: FieldBlockDefinition = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'email',
        dependentWhen: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'requireEmail'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ResolvableValue[] },
        } satisfies PredicateTestExpr,
        validWhen: [
          {
            type: ExpressionType.VALIDATION,
            condition: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ResolvableValue[] },
            },
            message: 'Required',
          },
        ],
      }

      // Act
      const result = createBlockNode(json, nodeFactory.context)

      // Assert
      expect(result.blockType).toBe(BlockType.FIELD)
      expect('code' in result.properties).toBe(true)
      expect('dependentWhen' in result.properties).toBe(true)
      expect('validWhen' in result.properties).toBe(true)
    })
  })
})
