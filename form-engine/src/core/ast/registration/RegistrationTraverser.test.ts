import { ASTNodeType } from '@form-engine/core/types/enums'
import { ASTTestFactory } from '@form-engine/test-utils/ASTTestFactory'
import { BlockType, ExpressionType } from '@form-engine/form/types/enums'
import InvalidNodeError from '@form-engine/errors/InvalidNodeError'
import { ASTNode } from '@form-engine/core/types/engine.type'
import RegistrationTraverser from './RegistrationTraverser'
import NodeRegistry from './NodeRegistry'

describe('RegistrationTraverser', () => {
  let mockRegistry: jest.Mocked<NodeRegistry>
  let traverser: RegistrationTraverser

  beforeEach(() => {
    ASTTestFactory.resetIds()

    mockRegistry = {
      register: jest.fn(),
    } as unknown as jest.Mocked<NodeRegistry>

    traverser = new RegistrationTraverser(mockRegistry)
  })

  describe('register', () => {
    it('should register journey node with empty path', () => {
      // Arrange
      const journey = ASTTestFactory.journey().build()

      // Act
      traverser.register(journey)

      // Assert
      expect(mockRegistry.register).toHaveBeenCalledWith(journey.id, journey, [])
    })

    it('should register all nodes in nested structure with correct paths', () => {
      // Arrange
      const expr = ASTTestFactory
        .expression(ExpressionType.REFERENCE)
        .withId('compile_ast:5')
        .withPath(['answers', 'test'])
        .build()

      const journey = ASTTestFactory
        .journey()
        .withStep(step =>
          step
            .withId('compile_ast:2')
            .withBlock('TextInput', BlockType.FIELD, block =>
              block
                .withId('compile_ast:3')
                .withCode('firstName')
                .withLabel('First Name'),
            )
            .withBlock('TextInput', BlockType.FIELD, block =>
              block
                .withId('compile_ast:4')
                .withCode('testField')
                .withLabel('Test Field')
                .withProperty('defaultValue', expr),
            ),
        )
        .build()

      // Act
      traverser.register(journey)

      // Assert
      expect(mockRegistry.register).toHaveBeenCalledWith(journey.id, journey, [])
      expect(mockRegistry.register).toHaveBeenCalledWith(
        'compile_ast:2',
        expect.objectContaining({ id: 'compile_ast:2' }),
        ['steps', 0],
      )
      expect(mockRegistry.register).toHaveBeenCalledWith(
        'compile_ast:3',
        expect.objectContaining({ id: 'compile_ast:3' }),
        ['steps', 0, 'blocks', 0],
      )
      expect(mockRegistry.register).toHaveBeenCalledWith(
        'compile_ast:4',
        expect.objectContaining({ id: 'compile_ast:4' }),
        ['steps', 0, 'blocks', 1],
      )
      expect(mockRegistry.register).toHaveBeenCalledWith('compile_ast:5', expr, [
        'steps',
        0,
        'blocks',
        1,
        'defaultValue',
      ])
      expect(mockRegistry.register).toHaveBeenCalledTimes(5)
    })
  })

  describe('error handling', () => {
    it('should throw InvalidNodeError when any node lacks ID', () => {
      // Arrange - Root node without ID
      const rootWithoutId = {
        type: ASTNodeType.STEP,
        id: undefined as any,
        properties: {},
      } as ASTNode

      // Act & Assert - Root node
      try {
        traverser.register(rootWithoutId)

        fail('Expected InvalidNodeError for root node')
      } catch (error) {
        expect(error).toBeInstanceOf(InvalidNodeError)
        expect(error.message).toMatch(/Node is missing ID/)

        if (error instanceof InvalidNodeError) {
          expect(error.node).toBe(rootWithoutId)
        }
      }

      // Arrange - Nested node without ID
      const exprWithoutId = {
        type: ASTNodeType.EXPRESSION,
        id: undefined as any,
        expressionType: ExpressionType.REFERENCE,
        properties: { path: ['answers', 'test'] },
      } as ASTNode

      const block = ASTTestFactory
        .block('TextInput', BlockType.FIELD)
        .withId('compile_ast:2')
        .withProperty('defaultValue', exprWithoutId)
        .build()

      const step = ASTTestFactory
        .step()
        .withId('compile_ast:1')
        .withProperty('blocks', [block])
        .build()

      // Act & Assert - Nested node with path in error message
      expect(() => traverser.register(step)).toThrow(InvalidNodeError)
      expect(() => traverser.register(step)).toThrow(/blocks\.0\.defaultValue/)
    })
  })
})
