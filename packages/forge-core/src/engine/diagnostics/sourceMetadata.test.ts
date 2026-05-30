import { BlockType, ExpressionType, FunctionType, IteratorType, StructureType } from '../../authoring/types/enums'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { FunctionASTNode, IterateASTNode } from '../contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../contracts/ast/structures.type'
import type { TemplateNode } from '../contracts/ast/template.type'
import { NodeIDCategory, NodeIDGenerator } from '../ast/ast-state/NodeIDGenerator'
import { NodeFactory } from '../ast/nodes/NodeFactory'
import { ASTNodeType } from '../contracts/ast/enums'
import { createDSLSourceMap, getDSLSourceMetadata } from './sourceMetadata'

const createFactory = (journey: JourneyDefinition): NodeFactory => {
  const factory = new NodeFactory(new NodeIDGenerator(), NodeIDCategory.COMPILE_AST)

  factory.setSourceMap(createDSLSourceMap(journey))

  return factory
}

describe('sourceMetadata', () => {
  describe('createDSLSourceMap()', () => {
    it('should attach diagnostic metadata to AST nodes', () => {
      // Arrange
      const journey = {
        type: StructureType.JOURNEY,
        code: 'travel-declaration',
        path: '/travel-declaration',
        title: 'Travel declaration',
        steps: [
          {
            type: StructureType.STEP,
            code: 'personal-details',
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.FIELD,
                variant: 'GovUKInput',
                code: 'firstName',
                defaultValue: {
                  type: FunctionType.GENERATOR,
                  name: 'defaultFirstName',
                  arguments: [],
                },
              },
            ],
          },
        ],
      } as unknown as JourneyDefinition
      const factory = createFactory(journey)

      // Act
      const root = factory.createNode(journey) as JourneyASTNode
      const step = root.properties.steps![0] as StepASTNode
      const block = step.properties.blocks![0] as FieldBlockASTNode
      const defaultValue = block.properties.defaultValue as FunctionASTNode
      const metadata = getDSLSourceMetadata(defaultValue)

      // Assert
      expect(metadata?.dslPath).toEqual(['steps', 0, 'blocks', 0, 'defaultValue'])
      expect(metadata?.formattedDslPath).toBe(
        'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > defaultValue',
      )
      expect(Object.keys(defaultValue)).not.toContain('dslPath')
      expect(Object.keys(defaultValue)).not.toContain('formattedDslPath')
    })

    it('should preserve DSL paths on template nodes inside iterator yields', () => {
      // Arrange
      const journey = {
        type: StructureType.JOURNEY,
        code: 'travel-declaration',
        path: '/travel-declaration',
        title: 'Travel declaration',
        steps: [
          {
            type: StructureType.STEP,
            code: 'personal-details',
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
                variant: 'collection-block',
                items: {
                  type: ExpressionType.ITERATE,
                  input: { type: ExpressionType.REFERENCE, path: ['data', 'people'] },
                  iterator: {
                    type: IteratorType.MAP,
                    yield: {
                      type: StructureType.BLOCK,
                      blockType: BlockType.FIELD,
                      variant: 'GovUKInput',
                      code: 'firstName',
                    },
                  },
                },
              },
            ],
          },
        ],
      } as unknown as JourneyDefinition
      const factory = createFactory(journey)

      // Act
      const root = factory.createNode(journey) as JourneyASTNode
      const step = root.properties.steps![0] as StepASTNode
      const block = step.properties.blocks![0]
      const iterate = block.properties.items as IterateASTNode
      const template = iterate.properties.iterator.yieldTemplate as TemplateNode
      const metadata = getDSLSourceMetadata(template)

      // Assert
      expect(template.type).toBe(ASTNodeType.TEMPLATE)
      expect(metadata?.dslPath).toEqual(['steps', 0, 'blocks', 0, 'items', 'iterator', 'yield'])
      expect(metadata?.formattedDslPath).toBe(
        'travel-declaration > personal-details > blocks[0] (collection-block) > items > source > iterator > template',
      )
      expect(Object.keys(template)).not.toContain('dslPath')
      expect(Object.keys(template)).not.toContain('formattedDslPath')
    })
  })
})
