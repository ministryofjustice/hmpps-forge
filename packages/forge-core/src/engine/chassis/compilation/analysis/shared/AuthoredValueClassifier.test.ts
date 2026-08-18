import { ExpressionType, IteratorType, PredicateType } from '../../../../../authoring/types/enums'
import { ASTNodeType } from '../../../contracts/ast/enums'
import { AuthoredValueKind, toRawOperand } from '../../../contracts/models/authoredValue.type'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import AuthoredValueClassifier from './AuthoredValueClassifier'

describe('AuthoredValueClassifier', () => {
  let classifier: AuthoredValueClassifier

  beforeEach(() => {
    ASTTestFactory.resetIds()
    classifier = new AuthoredValueClassifier()
  })

  describe('classify()', () => {
    it('should classify primitives and deeply static containers as static', () => {
      // Arrange
      const value = { label: 'Static', tags: ['one', 'two'], nested: { count: 3 } }

      // Act
      const classified = classifier.classify(value)

      // Assert
      expect(classified).toEqual({ kind: AuthoredValueKind.STATIC, value })
    })

    it('should classify reference nodes as expression leaves', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['data', 'name'])

      // Act
      const classified = classifier.classify(reference)

      // Assert
      expect(classified).toEqual({ kind: AuthoredValueKind.EXPRESSION, node: reference })
    })

    it('should classify conditional nodes with classified branches', () => {
      // Arrange
      const predicate = ASTTestFactory.predicate(PredicateType.TEST)
      const conditional = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.CONDITIONAL,
        id: ASTTestFactory.getId(),
        properties: { predicate, thenValue: 'yes', elseValue: { deep: ASTTestFactory.reference(['data', 'no']) } },
      }

      // Act
      const classified = classifier.classify(conditional)

      // Assert
      expect(classified.kind).toBe(AuthoredValueKind.CONDITIONAL)

      if (classified.kind === AuthoredValueKind.CONDITIONAL) {
        expect(classified.predicate.kind).toBe(AuthoredValueKind.EXPRESSION)
        expect(classified.thenValue).toEqual({ kind: AuthoredValueKind.STATIC, value: 'yes' })
        expect(classified.elseValue.kind).toBe(AuthoredValueKind.RECORD)
      }
    })

    it('should classify match nodes with branch predicates and otherwise', () => {
      // Arrange
      const match = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.MATCH,
        id: ASTTestFactory.getId(),
        properties: {
          branches: [{ predicate: ASTTestFactory.predicate(PredicateType.TEST), value: 'first' }],
          otherwise: 'fallback',
        },
      }

      // Act
      const classified = classifier.classify(match)

      // Assert
      expect(classified.kind).toBe(AuthoredValueKind.MATCH)

      if (classified.kind === AuthoredValueKind.MATCH) {
        expect(classified.branches).toHaveLength(1)
        expect(classified.branches[0].value).toEqual({ kind: AuthoredValueKind.STATIC, value: 'first' })
        expect(classified.otherwise).toEqual({ kind: AuthoredValueKind.STATIC, value: 'fallback' })
      }
    })

    it('should classify MAP iterations with input and yield template', () => {
      // Arrange
      const input = ASTTestFactory.reference(['data', 'members'])
      const iterate = {
        type: ASTNodeType.EXPRESSION,
        expressionType: ExpressionType.ITERATE,
        id: ASTTestFactory.getId(),
        properties: { input, iterator: { type: IteratorType.MAP, yieldTemplate: 'item' } },
      }

      // Act
      const classified = classifier.classify(iterate)

      // Assert
      expect(classified.kind).toBe(AuthoredValueKind.ITERATION)

      if (classified.kind === AuthoredValueKind.ITERATION) {
        expect(classified.iterator).toBe(IteratorType.MAP)
        expect(classified.input).toEqual({ kind: AuthoredValueKind.EXPRESSION, node: input })
        expect(classified.yieldTemplate).toEqual({ kind: AuthoredValueKind.STATIC, value: 'item' })
        expect(classified.predicate).toBeUndefined()
      }
    })

    it('should classify containers with expression children as record and list arms', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['answers', 'name'])

      // Act
      const classified = classifier.classify({ items: ['static', reference] })

      // Assert
      expect(classified.kind).toBe(AuthoredValueKind.RECORD)

      if (classified.kind === AuthoredValueKind.RECORD) {
        const items = classified.entries[0].value

        expect(items.kind).toBe(AuthoredValueKind.LIST)

        if (items.kind === AuthoredValueKind.LIST) {
          expect(items.items[0]).toEqual({ kind: AuthoredValueKind.STATIC, value: 'static' })
          expect(items.items[1]).toEqual({ kind: AuthoredValueKind.EXPRESSION, node: reference })
        }
      }
    })

    it('should classify block-shaped objects as block values with classified entries', () => {
      // Arrange
      const block = {
        type: ASTNodeType.BLOCK,
        variant: 'text-input',
        blockType: 'field',
        properties: { code: 'name', hint: ASTTestFactory.reference(['data', 'hint']) },
      }

      // Act
      const classified = classifier.classify(block)

      // Assert
      expect(classified.kind).toBe(AuthoredValueKind.BLOCK)

      if (classified.kind === AuthoredValueKind.BLOCK) {
        expect(classified.variant).toBe('text-input')
        expect(classified.entries.map(entry => entry.key)).toEqual(['code', 'hint'])
        expect(classified.entries[1].value.kind).toBe(AuthoredValueKind.EXPRESSION)
      }
    })
  })

  describe('toRawOperand()', () => {
    it('should reconstruct the authored raw value from classified arms', () => {
      // Arrange
      const reference = ASTTestFactory.reference(['data', 'name'])
      const value = { label: 'Static', dynamic: reference, list: [1, reference] }

      // Act
      const raw = toRawOperand(new AuthoredValueClassifier().classify(value))

      // Assert
      expect(raw).toEqual(value)
    })
  })
})
