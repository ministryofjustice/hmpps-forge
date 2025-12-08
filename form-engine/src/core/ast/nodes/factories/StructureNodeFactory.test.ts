import { ASTNodeType } from '@form-engine/core/types/enums'
import { ExpressionType, FunctionType, LogicType, StructureType, TransitionType } from '@form-engine/form/types/enums'
import type {
  BlockDefinition,
  FieldBlockDefinition,
  JourneyDefinition,
  StepDefinition,
  ValidationExpr,
} from '@form-engine/form/types/structures.type'
import type {
  AccessTransition,
  EffectFunctionExpr,
  LoadTransition,
  NextExpr,
  PredicateTestExpr,
  SubmitTransition,
  ValueExpr,
} from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/ast/nodes/NodeIDGenerator'
import {
  BasicBlockASTNode,
  BlockASTNode,
  FieldBlockASTNode,
  JourneyASTNode,
  StepASTNode,
} from '@form-engine/core/types/structures.type'
import { NodeFactory } from '../NodeFactory'
import { StructureNodeFactory } from './StructureNodeFactory'

describe('StructureNodeFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let structureFactory: StructureNodeFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    structureFactory = new StructureNodeFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create', () => {
    it('should route to createJourney for Journey definitions', () => {
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      const result = structureFactory.create(json)

      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createStep for Step definitions', () => {
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
      } satisfies StepDefinition

      const result = structureFactory.create(json)

      expect(result.type).toBe(ASTNodeType.STEP)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })

    it('should route to createBlock for Block definitions', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TestBlock',
      } satisfies BlockDefinition

      const result = structureFactory.create(json)

      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.raw).toBe(json)
      expect(result.id).toBeDefined()
    })
  })

  describe('createJourney', () => {
    it('should create a Journey node with basic properties', () => {
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      const result = structureFactory.create(json) as JourneyASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.JOURNEY)
      expect(result.raw).toBe(json)

      expect('title' in result.properties).toBe(true)
      expect(result.properties.title).toBe('Test Journey')
      expect('steps' in result.properties).toBe(true)
    })

    it('should transform nested steps using real nodeFactory', () => {
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

      const result = structureFactory.create(json) as JourneyASTNode
      const steps = result.properties.steps

      expect(Array.isArray(steps)).toBe(true)
      expect(steps).toHaveLength(2)

      steps.forEach((step: StepASTNode) => {
        expect(step.type).toBe(ASTNodeType.STEP)
      })
    })

    it('should exclude type from properties', () => {
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      const result = structureFactory.create(json) as JourneyASTNode

      expect('type' in result.properties).toBe(false)
      expect('title' in result.properties).toBe(true)
    })

    it('should generate unique node IDs', () => {
      const json = {
        type: StructureType.JOURNEY,
        code: 'test-journey',
        path: 'test-journey',
        title: 'Test Journey',
        steps: [] as StepDefinition[],
      } satisfies JourneyDefinition

      const result1 = structureFactory.create(json)
      const result2 = structureFactory.create(json)

      expect(result1.id).toBeDefined()
      expect(result2.id).toBeDefined()
      expect(result1.id).not.toBe(result2.id)
    })
  })

  describe('createStep', () => {
    it('should create a Step node with basic properties', () => {
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
      } satisfies StepDefinition

      const result = structureFactory.create(json) as StepASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.STEP)
      expect(result.raw).toBe(json)

      expect('path' in result.properties).toBe(true)
      expect(result.properties.path).toBe('test-step')
      expect('blocks' in result.properties).toBe(true)
    })

    it('should transform nested blocks using real nodeFactory', () => {
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [
          {
            type: StructureType.BLOCK,
            variant: 'Block1',
          } satisfies BlockDefinition,
          {
            type: StructureType.BLOCK,
            variant: 'Block2',
          } satisfies BlockDefinition,
        ],
      } satisfies StepDefinition

      const result = structureFactory.create(json) as StepASTNode
      const blocks = result.properties.blocks

      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks).toHaveLength(2)

      blocks.forEach((block: BlockASTNode) => {
        expect(block.type).toBe(ASTNodeType.BLOCK)
      })
    })

    it('should transform onLoad transitions', () => {
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

      const result = structureFactory.create(json) as StepASTNode
      const onLoad = result.properties.onLoad

      expect(Array.isArray(onLoad)).toBe(true)
      expect(onLoad).toHaveLength(1)
    })

    it('should transform onAccess transitions', () => {
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
        onAccess: [
          {
            type: TransitionType.ACCESS,
          } satisfies AccessTransition,
        ],
      } satisfies StepDefinition

      const result = structureFactory.create(json) as StepASTNode
      const onAccess = result.properties.onAccess

      expect(Array.isArray(onAccess)).toBe(true)
      expect(onAccess).toHaveLength(1)
    })

    it('should transform onSubmit transitions', () => {
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

      const result = structureFactory.create(json) as StepASTNode
      const onSubmit = result.properties.onSubmission

      expect(Array.isArray(onSubmit)).toBe(true)
      expect(onSubmit).toHaveLength(1)
    })

    it('should exclude type from properties', () => {
      const json = {
        type: StructureType.STEP,
        path: 'test-step',
        title: 'test-step',
        blocks: [] as BlockDefinition[],
      } satisfies StepDefinition

      const result = structureFactory.create(json)

      expect('type' in result.properties).toBe(false)
      expect('path' in result.properties).toBe(true)
    })
  })

  describe('createBlock', () => {
    it('should create a basic Block node', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TestBlock',
      } satisfies BlockDefinition

      const result = structureFactory.create(json) as BlockASTNode

      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('TestBlock')
      expect(result.blockType).toBe('basic')
      expect(result.raw).toBe(json)
    })

    it('should create a field Block node when code property exists', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TextInput',
        code: 'email',
      } satisfies FieldBlockDefinition

      const result = structureFactory.create(json) as BlockASTNode

      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('TextInput')
      expect(result.blockType).toBe('field')

      expect('code' in result.properties).toBe(true)
      expect(result.properties.code).toBe('email')
    })

    it('should exclude type and variant from properties', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TestBlock',
        customProp: 'value',
      } satisfies BlockDefinition & { customProp: string }

      const result = structureFactory.create(json)

      expect('type' in result.properties).toBe(false)
      expect('variant' in result.properties).toBe(false)
      expect('customProp' in result.properties).toBe(true)
    })

    it('should transform nested blocks in block', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'Fieldset',
        blocks: [
          {
            type: StructureType.BLOCK,
            variant: 'TextInput',
            code: 'field1',
          } satisfies FieldBlockDefinition,
          {
            type: StructureType.BLOCK,
            variant: 'TextInput',
            code: 'field2',
          } satisfies FieldBlockDefinition,
        ],
      }

      const result = structureFactory.create(json) as BasicBlockASTNode
      const blocks = result.properties.blocks

      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks).toHaveLength(2)

      blocks.forEach((block: BlockASTNode) => {
        expect(block.type).toBe(ASTNodeType.BLOCK)
        expect(block.blockType).toBe('field')
      })
    })

    it('should handle field block with validation', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TextInput',
        code: 'email',
        validate: [
          {
            type: ExpressionType.VALIDATION,
            when: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
            },
            message: 'Email is required',
          },
        ] as ValidationExpr[],
      } satisfies FieldBlockDefinition

      const result = structureFactory.create(json) as FieldBlockASTNode
      const validate = result.properties.validate

      expect(Array.isArray(validate)).toBe(true)
      expect(validate).toHaveLength(1)
      expect(validate[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle field block with dependent property', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TextInput',
        code: 'details',
        dependent: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'showDetails'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies FieldBlockDefinition

      const result = structureFactory.create(json) as FieldBlockASTNode
      const dependent = result.properties.dependent

      expect(dependent.type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle field block with custom properties', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TextInput',
        code: 'email',
        label: 'Email Address',
        hint: 'Enter your email',
      } satisfies FieldBlockDefinition & { label: string; hint: string }

      const result = structureFactory.create(json) as FieldBlockASTNode

      expect(result.properties.label).toBe('Email Address')
    })

    it('should handle block with all properties', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TextInput',
        code: 'email',
        dependent: {
          type: LogicType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'requireEmail'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        validate: [
          {
            type: ExpressionType.VALIDATION,
            when: {
              type: LogicType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
            },
            message: 'Required',
          },
        ],
      }

      const result = structureFactory.create(json) as BlockASTNode

      expect(result.blockType).toBe('field')
      expect('code' in result.properties).toBe(true)
      expect('dependent' in result.properties).toBe(true)
      expect('validate' in result.properties).toBe(true)
    })
  })

  describe('determineBlockType', () => {
    it('should determine field type correctly', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'TextInput',
        code: 'email',
      } satisfies FieldBlockDefinition

      const result = structureFactory.create(json) as BlockASTNode

      expect(result.blockType).toBe('field')
    })

    it('should determine basic type correctly', () => {
      const json = {
        type: StructureType.BLOCK,
        variant: 'Heading',
        text: 'Hello',
      }

      const result = structureFactory.create(json) as BlockASTNode

      expect(result.blockType).toBe('basic')
    })
  })
})
