import { ASTNodeType } from '@form-engine/core/types/enums'
import { BlockType, ExpressionType, FunctionType, PredicateType, StructureType } from '@form-engine/form/types/enums'
import type { BlockDefinition, FieldBlockDefinition, ValidationExpr } from '@form-engine/form/types/structures.type'
import type { PredicateTestExpr, ValueExpr } from '@form-engine/form/types/expressions.type'
import { NodeIDCategory, NodeIDGenerator } from '@form-engine/core/compilation/id-generators/NodeIDGenerator'
import { BlockASTNode } from '@form-engine/core/types/structures.type'
import { NodeFactory } from '@form-engine/core/nodes/NodeFactory'
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
      expect(result.raw).toBe(json)
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
        validate: [
          {
            type: ExpressionType.VALIDATION,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
            },
            message: 'Email is required',
          },
        ] as ValidationExpr[],
      } satisfies FieldBlockDefinition

      // Act
      const result = blockFactory.create(json)
      const validate = result.properties.validate

      // Assert
      expect(Array.isArray(validate)).toBe(true)
      expect(validate).toHaveLength(1)
      expect(validate[0].type).toBe(ASTNodeType.EXPRESSION)
    })

    it('should handle field block with dependent property', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        blockType: BlockType.FIELD,
        variant: 'TextInput',
        code: 'details',
        dependent: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'showDetails'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
      } satisfies FieldBlockDefinition

      // Act
      const result = blockFactory.create(json)
      const dependent = result.properties.dependent

      // Assert
      expect(dependent.type).toBe(ASTNodeType.PREDICATE)
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
        dependent: {
          type: PredicateType.TEST,
          subject: { type: ExpressionType.REFERENCE, path: ['answers', 'requireEmail'] },
          negate: false,
          condition: { type: FunctionType.CONDITION, name: 'IsTrue', arguments: [] as ValueExpr[] },
        } satisfies PredicateTestExpr,
        validate: [
          {
            type: ExpressionType.VALIDATION,
            when: {
              type: PredicateType.TEST,
              subject: { type: ExpressionType.REFERENCE, path: ['@self'] },
              negate: true,
              condition: { type: FunctionType.CONDITION, name: 'IsRequired', arguments: [] as ValueExpr[] },
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
      expect('dependent' in result.properties).toBe(true)
      expect('validate' in result.properties).toBe(true)
    })
  })
})
