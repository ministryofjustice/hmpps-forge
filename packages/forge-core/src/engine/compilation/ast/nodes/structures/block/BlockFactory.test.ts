import { ASTNodeType } from '../../../../../contracts/ast/enums'
import {
  BlockType,
  ExpressionType,
  FunctionType,
  PredicateType,
  StructureType,
} from '../../../../../../authoring/types/enums'
import type { ValidationExpr } from '../../../../../../authoring/types/structures.type'
import type { BlockDefinition, FieldBlockDefinition } from '../../../../../../components/types/structures.type'
import type { PredicateTestExpr, ResolvableValue } from '../../../../../../authoring/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '../../../ast-state/NodeIDGenerator'
import { BlockASTNode } from '../../../../../contracts/ast/structures.type'
import { NodeFactory } from '../../NodeFactory'
import BlockFactory from './BlockFactory'

describe('BlockFactory', () => {
  let nodeIDGenerator: NodeIDGenerator
  let nodeFactory: NodeFactory
  let blockFactory: BlockFactory

  beforeEach(() => {
    nodeIDGenerator = new NodeIDGenerator()
    nodeFactory = new NodeFactory(nodeIDGenerator, NodeIDCategory.COMPILE_AST)
    blockFactory = new BlockFactory(nodeIDGenerator, nodeFactory, NodeIDCategory.COMPILE_AST)
  })

  describe('create() - basic blocks', () => {
    it('should create a basic Block node', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.BASIC,
        variant: 'TestBlock',
      } satisfies BlockDefinition

      // Act
      const result = blockFactory.create(json)

      // Assert
      expect(result.id).toBeDefined()
      expect(result.type).toBe(ASTNodeType.BLOCK)
      expect(result.variant).toBe('TestBlock')
      expect(result.blockType).toBe(BlockType.BASIC)
      expect(result).not.toHaveProperty('raw')
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
      const result = blockFactory.create(json)

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
      const result = blockFactory.create(json)
      const blocks = result.properties.blocks as BlockASTNode[]

      // Assert
      expect(Array.isArray(blocks)).toBe(true)
      expect(blocks).toHaveLength(2)
      blocks.forEach((block: BlockASTNode) => {
        expect(block.type).toBe(ASTNodeType.BLOCK)
        expect(block.blockType).toBe(BlockType.FIELD)
      })
    })
  })

  describe('create() - field blocks', () => {
    it('should create a field Block node with code property', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'email',
      } satisfies FieldBlockDefinition

      // Act
      const result = blockFactory.create(json)

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
      const result = blockFactory.create(json)
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
      const result = blockFactory.create(json)
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
      const result = blockFactory.create(json)

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
      const result = blockFactory.create(json)

      // Assert
      expect(result.blockType).toBe(BlockType.FIELD)
      expect('code' in result.properties).toBe(true)
      expect('dependentWhen' in result.properties).toBe(true)
      expect('validWhen' in result.properties).toBe(true)
    })
  })
})
