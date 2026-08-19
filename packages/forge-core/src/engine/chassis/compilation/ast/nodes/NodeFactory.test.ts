import {
  ConditionCombinatorType,
  ExpressionType,
  FunctionType,
  HookType,
  IteratorType,
  OutcomeType,
  PredicateType,
  StructureType,
} from '../../../../../authoring/types/enums'
import { ExpressionBuilder } from '../../../../../authoring/builders/ExpressionBuilder'
import { finaliseBuilders } from '../../../../../authoring/builders/utils/finaliseBuilders'
import type { ConditionFunctionExpr, ReferenceExpr } from '../../../../../authoring/types/expressions.type'
import { NodeIDGenerator } from '../ast-state/NodeIDGenerator'
import ForgeInvalidNodeError from '../../../../errors/ForgeInvalidNodeError'
import ForgeUnknownNodeTypeError from '../../../../errors/ForgeUnknownNodeTypeError'
import { NodeFactory, creatorsByType } from './NodeFactory'

describe('NodeFactory', () => {
  // Every enum whose values appear in a `type` discriminant. BlockType is
  // absent by design: it discriminates the `blockType` field, never `type`.
  const discriminantEnums: Record<string, string>[] = [
    StructureType,
    ExpressionType,
    PredicateType,
    ConditionCombinatorType,
    IteratorType,
    HookType,
    OutcomeType,
    FunctionType,
  ]

  // Dead enum member: nothing in the authoring surface produces a NEXT
  // expression and no creator ever existed for it.
  const excludedDiscriminants: string[] = [ExpressionType.NEXT]

  describe('creatorsByType', () => {
    it('should have a row for every discriminant enum value', () => {
      // Arrange
      const discriminantValues = discriminantEnums
        .flatMap(discriminantEnum => Object.values(discriminantEnum))
        .filter(value => !excludedDiscriminants.includes(value))

      // Act
      const missingRows = discriminantValues.filter(value => !creatorsByType.has(value))

      // Assert
      expect(missingRows).toEqual([])
    })

    it('should have no rows outside the discriminant enum values', () => {
      // Arrange
      const discriminantValues = new Set(discriminantEnums.flatMap(discriminantEnum => Object.values(discriminantEnum)))

      // Act
      const unknownRows = [...creatorsByType.keys()].filter(key => !discriminantValues.has(key))

      // Assert
      expect(unknownRows).toEqual([])
    })
  })

  describe('createNode()', () => {
    let nodeFactory: NodeFactory

    beforeEach(() => {
      nodeFactory = new NodeFactory(new NodeIDGenerator())
    })

    it('should throw a placement error when a condition combinator appears outside a match expression', () => {
      // Arrange
      const strayCombinators = Object.values(ConditionCombinatorType).map(type => ({ type, operands: [] }))

      // Act & Assert
      strayCombinators.forEach(combinator => {
        expect(() => nodeFactory.createNode(combinator)).toThrow(ForgeInvalidNodeError)
        expect(() => nodeFactory.createNode(combinator)).toThrow(
          'Condition combinators can only appear inside a match expression branch condition',
        )
      })
    })

    it('should throw a placement error when an iterator config appears outside an Iterate expression', () => {
      // Arrange
      const strayIteratorConfigs = Object.values(IteratorType).map(type => ({ type }))

      // Act & Assert
      strayIteratorConfigs.forEach(iteratorConfig => {
        expect(() => nodeFactory.createNode(iteratorConfig)).toThrow(ForgeInvalidNodeError)
        expect(() => nodeFactory.createNode(iteratorConfig)).toThrow(
          'Iterator configurations can only appear inside the iterator of an Iterate expression',
        )
      })
    })

    it('should throw a placement error when a stray combinator is nested inside an otherwise-valid node', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        variant: 'test-block',
        someProperty: { type: ConditionCombinatorType.AND, operands: [] },
      }

      // Act & Assert
      expect(() => nodeFactory.createNode(json)).toThrow(
        'Condition combinators can only appear inside a match expression branch condition',
      )
    })

    it('should throw a placement error when a stray iterator config is nested inside an otherwise-valid node', () => {
      // Arrange
      const json = {
        type: StructureType.BLOCK,
        variant: 'test-block',
        someProperty: { type: IteratorType.MAP },
      }

      // Act & Assert
      expect(() => nodeFactory.createNode(json)).toThrow(
        'Iterator configurations can only appear inside the iterator of an Iterate expression',
      )
    })

    it('should throw ForgeUnknownNodeTypeError when the type string is unrecognised', () => {
      // Arrange
      const json = { type: 'NoSuchType.Bogus' }

      // Act & Assert
      expect(() => nodeFactory.createNode(json)).toThrow(ForgeUnknownNodeTypeError)
    })

    it('should throw ForgeUnknownNodeTypeError when the object has no type', () => {
      // Arrange
      const json = { foo: 'bar' }

      // Act & Assert
      expect(() => nodeFactory.createNode(json)).toThrow(ForgeUnknownNodeTypeError)
    })

    it('should preserve the exact match invocation line through finalisation and node creation', () => {
      // Arrange
      const reference = { type: ExpressionType.REFERENCE, path: ['answers', 'email'] } satisfies ReferenceExpr
      const condition = {
        type: FunctionType.CONDITION,
        name: 'IsRequired',
        arguments: [],
      } satisfies ConditionFunctionExpr
      const precedingStack = new Error().stack
      const predicate = ExpressionBuilder.from(reference).match(condition)
      const precedingLine = Number(precedingStack?.match(/NodeFactory\.test\.ts:(\d+):/)?.[1])

      // Act
      const result = nodeFactory.createNode(finaliseBuilders(predicate))

      // Assert
      expect(precedingLine).not.toBeNaN()
      expect(result.diagnostics?.callsite?.stack).toContain(`NodeFactory.test.ts:${precedingLine + 1}:`)
    })

    it('should exclude the inline-only types from the valid-types list', () => {
      // Arrange
      const inlineOnlyTypes: string[] = [...Object.values(ConditionCombinatorType), ...Object.values(IteratorType)]

      // Act
      let validTypes: string[] = []
      try {
        nodeFactory.createNode({ type: 'NoSuchType.Bogus' })
      } catch (error) {
        validTypes = (error as ForgeUnknownNodeTypeError).validTypes ?? []
      }

      // Assert
      expect(validTypes).toContain(StructureType.JOURNEY)
      expect(validTypes.filter(type => inlineOnlyTypes.includes(type))).toEqual([])
    })
  })

})
