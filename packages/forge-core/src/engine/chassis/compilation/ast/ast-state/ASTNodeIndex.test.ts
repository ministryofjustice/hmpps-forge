import { ASTTestFactory } from '../testing-helpers/ASTTestFactory'
import {
  ComponentCallType,
  ExpressionType,
  PolicyType,
  PredicateType,
  StructureType,
} from '../../../../../authoring/types/enums'
import { ASTNodeFamily } from '../../../contracts/ast/enums'
import ASTNodeIndex from './ASTNodeIndex'

describe('ASTNodeIndex', () => {
  let registry: ASTNodeIndex

  beforeEach(() => {
    registry = new ASTNodeIndex()
  })

  describe('register()', () => {
    it('should register a node retrievable by kind', () => {
      // Arrange
      const node = ASTTestFactory.block('TextField', ComponentCallType.FIELD).withId('compile_ast:1').build()

      // Act
      registry.register('compile_ast:1', node)

      // Assert
      expect(registry.findByKind(ComponentCallType.FIELD)).toEqual([node])
    })

    it('should throw when registering duplicate ID', () => {
      // Arrange
      const node1 = ASTTestFactory.block('TextField', ComponentCallType.FIELD).build()
      const node2 = ASTTestFactory.block('TextField', ComponentCallType.FIELD).build()
      registry.register('compile_ast:1', node1)

      // Act
      const registerDuplicate = () => registry.register('compile_ast:1', node2)

      // Assert
      expect(registerDuplicate).toThrow('Node with ID "compile_ast:1" is already registered')
    })
  })

  describe('findByKind()', () => {
    it('should find nodes by immediate family', () => {
      // Arrange
      const block1 = ASTTestFactory.block('TextField', ComponentCallType.FIELD).build()
      const block2 = ASTTestFactory.block('RadioInput', ComponentCallType.FIELD).build()
      const step = ASTTestFactory.step().build()
      const journey = ASTTestFactory.journey().build()
      const expr = ASTTestFactory.expression(ExpressionType.REFERENCE).build()

      registry.register('compile_ast:1', block1)
      registry.register('compile_ast:2', block2)
      registry.register('compile_ast:3', step)
      registry.register('compile_ast:4', journey)
      registry.register('compile_ast:5', expr)

      // Act
      const blocks = registry.findByFamily(ASTNodeFamily.COMPONENT_CALL)
      const steps = registry.findByKind(StructureType.STEP)
      const expressions = registry.findByFamily(ASTNodeFamily.EXPRESSION)

      // Assert
      expect(blocks).toEqual([block1, block2])
      expect(steps).toEqual([step])
      expect(expressions).toEqual([expr])
    })

    it('should return empty array when no nodes of type exist', () => {
      // Arrange
      const block = ASTTestFactory.block('TextField', ComponentCallType.FIELD).build()
      registry.register('compile_ast:1', block)

      // Act
      const journeys = registry.findByKind(StructureType.JOURNEY)

      // Assert
      expect(journeys).toEqual([])
    })

    it('should find expression nodes by sub-type', () => {
      // Arrange
      const refExpr = ASTTestFactory.expression(ExpressionType.REFERENCE).build()
      const condExpr = ASTTestFactory.expression(ExpressionType.CONDITIONAL).build()
      const pipeExpr = ASTTestFactory.expression(ExpressionType.PIPELINE).build()

      registry.register('compile_ast:1', refExpr)
      registry.register('compile_ast:2', condExpr)
      registry.register('compile_ast:3', pipeExpr)

      // Act
      const refNodes = registry.findByKind(ExpressionType.REFERENCE)
      const condNodes = registry.findByKind(ExpressionType.CONDITIONAL)

      // Assert
      expect(refNodes).toEqual([refExpr])
      expect(condNodes).toEqual([condExpr])
    })

    it('should find predicate nodes by sub-type', () => {
      // Arrange
      const andPredicate = ASTTestFactory.predicate(PredicateType.AND)
      const orPredicate = ASTTestFactory.predicate(PredicateType.OR)

      registry.register(andPredicate.id, andPredicate)
      registry.register(orPredicate.id, orPredicate)

      // Act
      const andNodes = registry.findByKind(PredicateType.AND)
      const orNodes = registry.findByKind(PredicateType.OR)

      // Assert
      expect(andNodes).toEqual([andPredicate])
      expect(orNodes).toEqual([orPredicate])
    })

    it('should find block nodes by block type', () => {
      // Arrange
      const fieldBlock = ASTTestFactory.block('TextField', ComponentCallType.FIELD).build()
      const basicBlock = ASTTestFactory.block('Html', ComponentCallType.BASIC).build()

      registry.register('compile_ast:1', fieldBlock)
      registry.register('compile_ast:2', basicBlock)

      // Act
      const fieldBlocks = registry.findByKind(ComponentCallType.FIELD)
      const basicBlocks = registry.findByKind(ComponentCallType.BASIC)

      // Assert
      expect(fieldBlocks).toEqual([fieldBlock])
      expect(basicBlocks).toEqual([basicBlock])
    })

    it('should find outcome nodes by sub-type', () => {
      // Arrange
      const redirectOutcome = ASTTestFactory.redirectOutcome({ goto: '/next' })
      const throwErrorOutcome = ASTTestFactory.throwErrorOutcome({ status: 404, message: 'Not found' })

      registry.register(redirectOutcome.id, redirectOutcome)
      registry.register(throwErrorOutcome.id, throwErrorOutcome)

      // Act
      const redirectNodes = registry.findByKind(PolicyType.OUTCOME_REDIRECT)
      const throwErrorNodes = registry.findByKind(PolicyType.OUTCOME_THROW_ERROR)

      // Assert
      expect(redirectNodes).toEqual([redirectOutcome])
      expect(throwErrorNodes).toEqual([throwErrorOutcome])
    })
  })
})
