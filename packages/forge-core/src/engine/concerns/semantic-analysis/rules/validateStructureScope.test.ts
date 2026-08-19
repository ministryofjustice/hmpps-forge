import { BlockType } from '../../../../authoring/types/enums'
import type { ASTNode } from '../../../chassis/contracts/ast/engine.type'
import ASTNodeIndex from '../../../chassis/compilation/ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../../../chassis/compilation/ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import ForgeReferenceScopeError from '../../../errors/ForgeReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateStructureScope } from './validateStructureScope'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

function createContext(nodeIndex: ASTNodeIndex): ASTValidationContext {
  return {
    nodeIndex,
    functionRegistry: new FunctionRegistry(),
    componentRegistry: new ComponentRegistry(),
  }
}

describe('validateStructureScope', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  it('should return no errors when a step is in the journey steps array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const stepNode = ASTTestFactory.step().withCode('step').build()
    const journeyNode = ASTTestFactory.journey().withProperty('steps', [stepNode]).build()

    setParent(stepNode, journeyNode)
    nodeIndex.register(journeyNode.id, journeyNode)
    nodeIndex.register(stepNode.id, stepNode)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex))

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should return no errors when a journey has no parent', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const journeyNode = ASTTestFactory.journey().build()

    nodeIndex.register(journeyNode.id, journeyNode)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex))

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should return no errors when a nested journey is in the parent children array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const childJourneyNode = ASTTestFactory.journey().build()
    const parentJourneyNode = ASTTestFactory.journey().withProperty('children', [childJourneyNode]).build()

    setParent(childJourneyNode, parentJourneyNode)
    nodeIndex.register(parentJourneyNode.id, parentJourneyNode)
    nodeIndex.register(childJourneyNode.id, childJourneyNode)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex))

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should reject a step whose parent is a block', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const blockNode = ASTTestFactory.block('text', BlockType.BASIC).build()
    const stepNode = ASTTestFactory.step().withCode('step').build()

    setParent(stepNode, blockNode)
    nodeIndex.register(blockNode.id, blockNode)
    nodeIndex.register(stepNode.id, stepNode)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex)) as ForgeReferenceScopeError[]

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Steps can only be defined in a journey steps array')
  })

  it('should reject a step parented to a journey but absent from its steps array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const strayStepNode = ASTTestFactory.step().withCode('stray').build()
    const journeyNode = ASTTestFactory.journey().withProperty('steps', []).build()

    setParent(strayStepNode, journeyNode)
    nodeIndex.register(journeyNode.id, journeyNode)
    nodeIndex.register(strayStepNode.id, strayStepNode)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex)) as ForgeReferenceScopeError[]

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Steps can only be defined in a journey steps array')
  })

  it('should reject a journey parented to a journey but absent from its children array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const strayJourneyNode = ASTTestFactory.journey().build()
    const parentJourneyNode = ASTTestFactory.journey().withProperty('children', []).build()

    setParent(strayJourneyNode, parentJourneyNode)
    nodeIndex.register(parentJourneyNode.id, parentJourneyNode)
    nodeIndex.register(strayJourneyNode.id, strayJourneyNode)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex)) as ForgeReferenceScopeError[]

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0].message).toBe('Journeys can only be defined at the root or in a journey children array')
  })
})
