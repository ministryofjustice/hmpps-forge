import { BlockType, ExpressionType, FunctionType, IteratorType, StructureType } from '../../authoring/types/enums'
import type { JourneyDefinition } from '../../authoring/types/structures.type'
import type { FunctionASTNode, IterateASTNode, MatchASTNode } from '../../engine/chassis/contracts/ast/expressions.type'
import type { FieldBlockASTNode, JourneyASTNode, StepASTNode } from '../../engine/chassis/contracts/ast/structures.type'
import type { TestPredicateASTNode } from '../../engine/chassis/contracts/ast/predicates.type'
import type { TemplateNode } from '../../engine/chassis/contracts/ast/template.type'
import { NodeIDGenerator } from '../../engine/chassis/compilation/ast/ast-state/NodeIDGenerator'
import { NodeFactory } from '../../engine/chassis/compilation/ast/nodes/NodeFactory'
import { ASTNodeType } from '../../engine/chassis/contracts/ast/enums'
import { finaliseBuilders } from '../../authoring/builders/utils/finaliseBuilders'
import DSLSourceLocator from './DSLSourceLocator'

const compileJourney = (journey: JourneyDefinition): JourneyASTNode => {
  const factory = new NodeFactory(new NodeIDGenerator())

  return factory.createNode(finaliseBuilders(journey)) as JourneyASTNode
}

describe('DSLSourceLocator', () => {
  describe('fromPath()', () => {
    it('should return a source location with a formatted path', () => {
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
          },
        ],
      }
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.fromPath(['steps', 0])

      // Assert
      expect(result).toEqual({
        path: ['steps', 0],
        formattedPath: 'travel-declaration > personal-details',
      })
    })

    it('should add diagnostic source to nested AST nodes', () => {
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

      // Act
      const root = compileJourney(journey)
      const step = root.properties.steps![0] as StepASTNode
      const block = step.properties.blocks![0] as FieldBlockASTNode
      const defaultValue = block.properties.defaultValue as FunctionASTNode

      // Assert
      expect(defaultValue.diagnostics?.source.path).toEqual(['steps', 0, 'blocks', 0, 'defaultValue'])
      expect(defaultValue.diagnostics?.source.formattedPath).toBe(
        'travel-declaration > personal-details > blocks[0] (GovUKInput - firstName) > defaultValue',
      )
      expect(defaultValue).not.toHaveProperty('raw')
    })

    it('should preserve diagnostic source on template nodes inside iterator yields', () => {
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

      // Act
      const root = compileJourney(journey)
      const step = root.properties.steps![0] as StepASTNode
      const block = step.properties.blocks![0]
      const iterate = block.properties.items as IterateASTNode
      const template = iterate.properties.iterator.yieldTemplate as TemplateNode

      // Assert
      expect(template.type).toBe(ASTNodeType.TEMPLATE)
      expect(template.diagnostics?.source.path).toEqual(['steps', 0, 'blocks', 0, 'items', 'iterator', 'yield'])
      expect(template.diagnostics?.source.formattedPath).toBe(
        'travel-declaration > personal-details > blocks[0] (collection-block) > items > source > iterator > template',
      )
      expect(template).not.toHaveProperty('raw')
    })

    it('should use branch condition source for synthetic match predicates', () => {
      // Arrange
      const journey = {
        type: StructureType.JOURNEY,
        code: 'travel-declaration',
        path: '/travel-declaration',
        title: 'Travel declaration',
        steps: [
          {
            type: StructureType.STEP,
            path: '/personal-details',
            title: 'Personal details',
            blocks: [
              {
                type: StructureType.BLOCK,
                blockType: BlockType.BASIC,
                variant: 'GovUKBody',
                content: {
                  type: ExpressionType.MATCH,
                  subject: { type: ExpressionType.REFERENCE, path: ['answers', 'role'] },
                  branches: [
                    {
                      condition: {
                        type: FunctionType.CONDITION,
                        name: 'Equals',
                        arguments: ['admin'],
                      },
                      value: 'Administrator',
                    },
                  ],
                },
              },
            ],
          },
        ],
      } as unknown as JourneyDefinition

      // Act
      const root = compileJourney(journey)
      const step = root.properties.steps![0] as StepASTNode
      const block = step.properties.blocks![0]
      const match = block.properties.content as MatchASTNode
      const predicate = match.properties.branches[0].predicate as TestPredicateASTNode

      // Assert
      expect(predicate.diagnostics?.source.path).toEqual([
        'steps',
        0,
        'blocks',
        0,
        'content',
        'branches',
        0,
        'condition',
      ])
      expect(predicate.diagnostics?.source.formattedPath).toBe(
        'travel-declaration > personal-details > blocks[0] (GovUKBody) > content > branches[0] > condition',
      )
    })
  })

  describe('callsiteFromPath()', () => {
    it('should return the stamp on the node at the path', () => {
      // Arrange
      const step = { code: 'personal-details' }
      Object.defineProperty(step, '__callsite', { value: { stack: 'at step-site' }, enumerable: false })
      const journey = { steps: [step] }
      Object.defineProperty(journey, '__callsite', { value: { stack: 'at journey-site' }, enumerable: false })
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.callsiteFromPath(['steps', 0])

      // Assert
      expect(result).toEqual({ stack: 'at step-site' })
    })

    it('should fall back to the nearest stamped ancestor when the path targets an unstamped primitive', () => {
      // Arrange
      const step = { code: 'personal-details', title: 'Personal details' }
      Object.defineProperty(step, '__callsite', { value: { stack: 'at step-site' }, enumerable: false })
      const journey = { steps: [step] }
      Object.defineProperty(journey, '__callsite', { value: { stack: 'at journey-site' }, enumerable: false })
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.callsiteFromPath(['steps', 0, 'title'])

      // Assert
      expect(result).toEqual({ stack: 'at step-site' })
    })

    it('should return undefined when nothing is stamped', () => {
      // Arrange
      const journey = { steps: [{ code: 'personal-details' }] }
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.callsiteFromPath(['steps', 0, 'code'])

      // Assert
      expect(result).toBeUndefined()
    })

    it('should return an ancestor stamp when the path goes through a missing key', () => {
      // Arrange
      const journey = { steps: [] }
      Object.defineProperty(journey, '__callsite', { value: { stack: 'at journey-site' }, enumerable: false })
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.callsiteFromPath(['steps', 0, 'blocks', 0])

      // Assert
      expect(result).toEqual({ stack: 'at journey-site' })
    })

    it('should reject a stamp whose stack is not a string and fall back to a valid ancestor stamp', () => {
      // Arrange
      const step = { code: 'personal-details' }
      Object.defineProperty(step, '__callsite', { value: { stack: 42 }, enumerable: false })
      const journey = { steps: [step] }
      Object.defineProperty(journey, '__callsite', { value: { stack: 'at journey-site' }, enumerable: false })
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.callsiteFromPath(['steps', 0])

      // Assert
      expect(result).toEqual({ stack: 'at journey-site' })
    })

    it('should return undefined when the only stamp is not an object', () => {
      // Arrange
      const journey = { steps: [{ code: 'personal-details' }] }
      Object.defineProperty(journey, '__callsite', { value: 'at journey-site', enumerable: false })
      const locator = new DSLSourceLocator(journey)

      // Act
      const result = locator.callsiteFromPath(['steps', 0])

      // Assert
      expect(result).toBeUndefined()
    })
  })
})
