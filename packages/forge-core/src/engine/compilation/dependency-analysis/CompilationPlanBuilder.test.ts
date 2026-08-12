import type { ASTNode } from '../../contracts/ast/engine.type'
import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import CompilationPlanBuilder from './CompilationPlanBuilder'

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('CompilationPlanBuilder', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('buildPlan()', () => {
    it('should wire step, journey, reachability, navigation, and field-inventory plan entries together', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const firstStepNode = ASTTestFactory.step().withPath('/first').withCode('first').build()
      const secondStepNode = ASTTestFactory.step().withPath('/second').withCode('second').build()

      setParent(firstStepNode, journeyNode)
      setParent(secondStepNode, journeyNode)
      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(firstStepNode.id, firstStepNode)
      nodeRegistry.register(secondStepNode.id, secondStepNode)

      const builder = new CompilationPlanBuilder(nodeRegistry)

      // Act
      const result = builder.buildPlan(
        new Map([
          [firstStepNode.id, firstStepNode],
          [secondStepNode.id, secondStepNode],
        ]),
        new Map([[journeyNode.id, journeyNode]]),
      )

      // Assert
      const reachabilityInputs = result.reachabilityInputs.get(journeyNode.id)

      expect(result.stepInputs.get(firstStepNode.id)?.core.runtimePlan.path).toBe('first')
      expect(reachabilityInputs?.reachabilityId).toBe(journeyNode.id)
      expect(reachabilityInputs?.reachabilityPlan.stateTable).toBe(reachabilityInputs?.stateTable)
      expect(result.journeyInputs.get(journeyNode.id)?.answerCleardown.fieldInventorySources).toEqual([
        {
          stepId: firstStepNode.id,
          fieldBlocks: [],
          iterateNodes: [],
          cleardownFieldCodes: [],
        },
        {
          stepId: secondStepNode.id,
          fieldBlocks: [],
          iterateNodes: [],
          cleardownFieldCodes: [],
        },
      ])
    })

    it('should collect route metadata for a container journey that has no direct steps', () => {
      // Arrange
      const nodeRegistry = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').withCode('first').build()
      const containerJourneyNode = ASTTestFactory.journey()
        .withProperty('path', '/demos')
        .withMetadata({ hiddenFromNav: true })
        .build()

      setParent(stepNode, journeyNode)
      setParent(containerJourneyNode, journeyNode)
      nodeRegistry.register(journeyNode.id, journeyNode)
      nodeRegistry.register(stepNode.id, stepNode)
      nodeRegistry.register(containerJourneyNode.id, containerJourneyNode)

      const builder = new CompilationPlanBuilder(nodeRegistry)

      // Act
      const result = builder.buildPlan(
        new Map([[stepNode.id, stepNode]]),
        new Map([
          [journeyNode.id, journeyNode],
          [containerJourneyNode.id, containerJourneyNode],
        ]),
      )

      // Assert
      expect(result.routeMetadataInputs.get(containerJourneyNode.id)?.metadata).toEqual({ hiddenFromNav: true })
    })
  })
})
