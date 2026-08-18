import { BlockType, PredicateType } from '../../../../authoring/types/enums'
import type { ASTNode, NodeId } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateFieldCodeUniqueness } from './validateFieldCodeUniqueness'

const createContext = (nodes: readonly ASTNode[], edges: ReadonlyArray<[NodeId, NodeId]>): ASTValidationContext => {
  const byId = new Map<NodeId, ASTNode>(nodes.map(node => [node.id, node]))

  edges.forEach(([childId, parentId]) => {
    const child = byId.get(childId)
    const parent = byId.get(parentId)

    if (child !== undefined && parent !== undefined) {
      Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
    }
  })

  const nodeIndex = new ASTNodeIndex()
  nodes.forEach(node => nodeIndex.register(node.id, node))

  return {
    nodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

const errorMessages = (errors: readonly Error[]): string[] =>
  errors.map(error => (error as ForgeReferenceScopeError).message)

const dependentWhen = (): unknown => ({ type: 'predicate', predicateType: PredicateType.TEST })

const fieldBlock = (code: string, props: Record<string, unknown> = {}): ASTNode => {
  const builder = ASTTestFactory.block('text', BlockType.FIELD).withProperty('code', code)

  Object.entries(props).forEach(([key, value]) => {
    builder.withProperty(key, value)
  })

  return builder.build()
}

describe('validateFieldCodeUniqueness', () => {
  describe('validateFieldCodeUniqueness()', () => {
    beforeEach(() => {
      ASTTestFactory.resetIds()
    })

    it('should return no errors when field codes on a step are unique', () => {
      // Arrange
      const first = fieldBlock('first_name')
      const second = fieldBlock('last_name')
      const step = ASTTestFactory.step().withProperty('blocks', [first, second]).build()
      const context = createContext(
        [first, second, step],
        [
          [first.id, step.id],
          [second.id, step.id],
        ],
      )

      // Act
      const errors = validateFieldCodeUniqueness(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return no errors when every same-code copy declares dependentWhen', () => {
      // Arrange
      const first = fieldBlock('employed', { dependentWhen: dependentWhen() })
      const second = fieldBlock('employed', { dependentWhen: dependentWhen() })
      const step = ASTTestFactory.step().withProperty('blocks', [first, second]).build()
      const context = createContext(
        [first, second, step],
        [
          [first.id, step.id],
          [second.id, step.id],
        ],
      )

      // Act
      const errors = validateFieldCodeUniqueness(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should return an error for each same-code copy missing dependentWhen', () => {
      // Arrange
      const first = fieldBlock('employed', { dependentWhen: dependentWhen() })
      const second = fieldBlock('employed')
      const third = fieldBlock('employed')
      const step = ASTTestFactory.step().withProperty('blocks', [first, second, third]).build()
      const context = createContext(
        [first, second, third, step],
        [
          [first.id, step.id],
          [second.id, step.id],
          [third.id, step.id],
        ],
      )

      // Act
      const errors = validateFieldCodeUniqueness(context)

      // Assert
      expect(errorMessages(errors)).toEqual([
        "Field code 'employed' is shared by multiple blocks on the same step, so every one of them must declare dependentWhen to mark which variant is active",
        "Field code 'employed' is shared by multiple blocks on the same step, so every one of them must declare dependentWhen to mark which variant is active",
      ])
    })

    it('should return no errors when the same code appears on different steps', () => {
      // Arrange
      const first = fieldBlock('employed')
      const second = fieldBlock('employed')
      const stepOne = ASTTestFactory.step().withProperty('blocks', [first]).build()
      const stepTwo = ASTTestFactory.step().withProperty('blocks', [second]).build()
      const context = createContext(
        [first, second, stepOne, stepTwo],
        [
          [first.id, stepOne.id],
          [second.id, stepTwo.id],
        ],
      )

      // Act
      const errors = validateFieldCodeUniqueness(context)

      // Assert
      expect(errors).toHaveLength(0)
    })

    it('should group nested field blocks by their owning step', () => {
      // Arrange
      const nested = fieldBlock('employed')
      const wrapper = ASTTestFactory.block('radio', BlockType.FIELD)
        .withProperty('code', 'employment_status')
        .withProperty('items', [{ value: 'a', block: nested }])
        .build()
      const sibling = fieldBlock('employed')
      const step = ASTTestFactory.step().withProperty('blocks', [wrapper, sibling]).build()
      const context = createContext(
        [nested, wrapper, sibling, step],
        [
          [wrapper.id, step.id],
          [nested.id, wrapper.id],
          [sibling.id, step.id],
        ],
      )

      // Act
      const errors = validateFieldCodeUniqueness(context)

      // Assert
      expect(errors).toHaveLength(2)
    })

    it('should ignore field blocks whose code is not a literal string', () => {
      // Arrange
      const first = fieldBlock('employed')
      const second = ASTTestFactory.block('text', BlockType.FIELD)
        .withProperty('code', { type: 'expression' })
        .build()
      const step = ASTTestFactory.step().withProperty('blocks', [first, second]).build()
      const context = createContext(
        [first, second, step],
        [
          [first.id, step.id],
          [second.id, step.id],
        ],
      )

      // Act
      const errors = validateFieldCodeUniqueness(context)

      // Assert
      expect(errors).toHaveLength(0)
    })
  })
})
