import { staticValue } from '../../contracts/models/authoredValue.type'
import type { ASTNode } from '../../contracts/ast/engine.type'
import ComponentRegistry from '../../registries/ComponentRegistry'
import FunctionRegistry from '../../registries/FunctionRegistry'
import ASTNodeIndex from '../ast/ast-state/ASTNodeIndex'
import { ASTTestFactory } from '../ast/testing-helpers/ASTTestFactory'
import CompilationModelBuilder from './CompilationModelBuilder'

function createBuilder(nodeIndex: ASTNodeIndex): CompilationModelBuilder {
  return new CompilationModelBuilder(nodeIndex, {
    componentRegistry: new ComponentRegistry(),
    functionRegistry: new FunctionRegistry(),
  })
}

function setParent(child: ASTNode, parent: ASTNode): void {
  Object.defineProperty(child, 'parent', { value: parent, enumerable: false })
}

describe('CompilationModelBuilder', () => {
  beforeEach(() => {
    ASTTestFactory.resetIds()
  })

  describe('build()', () => {
    it('should build a journey model owning its steps in state-table order', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const firstStepNode = ASTTestFactory.step().withPath('/first').withCode('first').build()
      const secondStepNode = ASTTestFactory.step().withPath('/second').withCode('second').build()

      setParent(firstStepNode, journeyNode)
      setParent(secondStepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(firstStepNode.id, firstStepNode)
      nodeIndex.register(secondStepNode.id, secondStepNode)

      const builder = createBuilder(nodeIndex)

      // Act
      const model = builder.build(
        new Map([
          [firstStepNode.id, firstStepNode],
          [secondStepNode.id, secondStepNode],
        ]),
      )

      // Assert
      const journey = model.journeys.get(journeyNode.id)

      expect(journey?.steps.get(firstStepNode.id)?.mountInfo.path).toBe('first')
      expect([...(journey?.steps.keys() ?? [])]).toEqual(
        journey?.reachability.stateTable.entries.map(entry => entry.stepId),
      )
      expect(journey?.cleardown.steps).toEqual([
        {
          stepId: firstStepNode.id,
          fields: [],
          cleardownFieldCodes: [],
        },
        {
          stepId: secondStepNode.id,
          fields: [],
          cleardownFieldCodes: [],
        },
      ])
    })

    it('should agree between reachability entries and the state table rows', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').withCode('first').build()

      setParent(stepNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)

      const builder = createBuilder(nodeIndex)

      // Act
      const model = builder.build(new Map([[stepNode.id, stepNode]]))

      // Assert
      const reachability = model.journeys.get(journeyNode.id)?.reachability

      expect(reachability?.stateTable.entries.map(entry => entry.stepId)).toEqual([stepNode.id])
      expect(reachability?.entries.map(entry => entry.stepId)).toEqual(
        reachability?.stateTable.entries.map(entry => entry.stepId),
      )
    })

    it('should model a container journey with no direct steps as an empty step map with route metadata', () => {
      // Arrange
      const nodeIndex = new ASTNodeIndex()
      const journeyNode = ASTTestFactory.journey().withProperty('path', '/journey').build()
      const stepNode = ASTTestFactory.step().withPath('/first').withCode('first').build()
      const containerJourneyNode = ASTTestFactory.journey()
        .withProperty('path', '/demos')
        .withMetadata({ hiddenFromNav: true })
        .build()

      setParent(stepNode, journeyNode)
      setParent(containerJourneyNode, journeyNode)
      nodeIndex.register(journeyNode.id, journeyNode)
      nodeIndex.register(stepNode.id, stepNode)
      nodeIndex.register(containerJourneyNode.id, containerJourneyNode)

      const builder = createBuilder(nodeIndex)

      // Act
      const model = builder.build(new Map([[stepNode.id, stepNode]]))

      // Assert
      expect(model.journeys.get(containerJourneyNode.id)?.steps.size).toBe(0)
      expect(model.routeMetadata.get(containerJourneyNode.id)?.metadata).toEqual(staticValue({ hiddenFromNav: true }))
    })
  })
})
