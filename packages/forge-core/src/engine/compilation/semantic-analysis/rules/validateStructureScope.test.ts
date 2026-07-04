import { BlockType } from '../../../../authoring/types/enums'
import ASTNodeIndex from '../../ast/ast-state/ASTNodeIndex'
import ASTNodeTree from '../../ast/ast-state/ASTNodeTree'
import { ASTTestFactory } from '../../ast/testing-helpers/ASTTestFactory'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import ComponentRegistry from '../../../registries/ComponentRegistry'
import ForgeConfigurationReferenceScopeError from '../../../errors/ForgeConfigurationReferenceScopeError'
import type { ASTValidationContext } from './types'
import { validateStructureScope } from './validateStructureScope'

function createContext(nodeIndex: ASTNodeIndex, nodeTree: ASTNodeTree): ASTValidationContext {
  return {
    nodeIndex,
    nodeTree,
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
    const nodeTree = new ASTNodeTree()
    const stepNode = ASTTestFactory.step().withCode('step').build()
    const journeyNode = ASTTestFactory.journey().withProperty('steps', [stepNode]).build()

    nodeIndex.register(journeyNode.id, journeyNode)
    nodeIndex.register(stepNode.id, stepNode)
    nodeTree.addNode(journeyNode.id)
    nodeTree.addNode(stepNode.id, journeyNode.id)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex, nodeTree))

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should return no errors when a journey has no parent', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const nodeTree = new ASTNodeTree()
    const journeyNode = ASTTestFactory.journey().build()

    nodeIndex.register(journeyNode.id, journeyNode)
    nodeTree.addNode(journeyNode.id)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex, nodeTree))

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should return no errors when a nested journey is in the parent children array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const nodeTree = new ASTNodeTree()
    const childJourneyNode = ASTTestFactory.journey().build()
    const parentJourneyNode = ASTTestFactory.journey().withProperty('children', [childJourneyNode]).build()

    nodeIndex.register(parentJourneyNode.id, parentJourneyNode)
    nodeIndex.register(childJourneyNode.id, childJourneyNode)
    nodeTree.addNode(parentJourneyNode.id)
    nodeTree.addNode(childJourneyNode.id, parentJourneyNode.id)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex, nodeTree))

    // Assert
    expect(errors).toHaveLength(0)
  })

  it('should reject a step whose parent is a block', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const nodeTree = new ASTNodeTree()
    const blockNode = ASTTestFactory.block('text', BlockType.BASIC).build()
    const stepNode = ASTTestFactory.step().withCode('step').build()

    nodeIndex.register(blockNode.id, blockNode)
    nodeIndex.register(stepNode.id, stepNode)
    nodeTree.addNode(blockNode.id)
    nodeTree.addNode(stepNode.id, blockNode.id)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex, nodeTree)) as ForgeConfigurationReferenceScopeError[]

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('step_outside_journey_steps')
  })

  it('should reject a step parented to a journey but absent from its steps array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const nodeTree = new ASTNodeTree()
    const strayStepNode = ASTTestFactory.step().withCode('stray').build()
    const journeyNode = ASTTestFactory.journey().withProperty('steps', []).build()

    nodeIndex.register(journeyNode.id, journeyNode)
    nodeIndex.register(strayStepNode.id, strayStepNode)
    nodeTree.addNode(journeyNode.id)
    nodeTree.addNode(strayStepNode.id, journeyNode.id)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex, nodeTree)) as ForgeConfigurationReferenceScopeError[]

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('step_outside_journey_steps')
  })

  it('should reject a journey parented to a journey but absent from its children array', () => {
    // Arrange
    const nodeIndex = new ASTNodeIndex()
    const nodeTree = new ASTNodeTree()
    const strayJourneyNode = ASTTestFactory.journey().build()
    const parentJourneyNode = ASTTestFactory.journey().withProperty('children', []).build()

    nodeIndex.register(parentJourneyNode.id, parentJourneyNode)
    nodeIndex.register(strayJourneyNode.id, strayJourneyNode)
    nodeTree.addNode(parentJourneyNode.id)
    nodeTree.addNode(strayJourneyNode.id, parentJourneyNode.id)

    // Act
    const errors = validateStructureScope(createContext(nodeIndex, nodeTree)) as ForgeConfigurationReferenceScopeError[]

    // Assert
    expect(errors).toHaveLength(1)
    expect(errors[0].code).toBe('journey_outside_journey_children')
  })
})
