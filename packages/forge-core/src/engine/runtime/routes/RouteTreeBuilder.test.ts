import { ASTNodeType } from '../../types/enums'
import { CompileAstNodeId, NodeId } from '../../types/ast.type'
import { JourneyASTNode, StepASTNode } from '../../types/structures.type'
import type { CompilationArtefact } from '../../types/compilationArtefacts.type'
import ASTNodeTree from '../../compilation/node-tree/ASTNodeTree'
import DuplicateRouteError from '../../errors/DuplicateRouteError'
import { createRouteTreeIndex, RouteTreeBuildResult, RouteTreeIndex } from '../types/routes.type'
import RouteTreeBuilder from './RouteTreeBuilder'

interface BuildFixture {
  index: RouteTreeIndex
  result: RouteTreeBuildResult
}

describe('RouteTreeBuilder', () => {
  function createJourneyNode(
    id: CompileAstNodeId,
    path: string,
    code: string,
    title = `Journey ${code}`,
  ): JourneyASTNode {
    return {
      id,
      type: ASTNodeType.JOURNEY,
      properties: {
        path,
        code,
        title,
      },
    }
  }

  function createStepNode(id: CompileAstNodeId, path: string, title = `Step ${path}`): StepASTNode {
    return {
      id,
      type: ASTNodeType.STEP,
      properties: {
        path,
        title,
      },
    }
  }

  function buildRouteTree(
    journeys: JourneyASTNode[],
    steps: StepASTNode[],
    chains: NodeId[][],
    basePath = '',
  ): BuildFixture {
    const index = createRouteTreeIndex()
    const builder = new RouteTreeBuilder(index)
    const nodesById = new Map<NodeId, JourneyASTNode | StepASTNode>(
      [...journeys, ...steps].map(node => [node.id, node]),
    )
    const astNodeTree = new ASTNodeTree()

    chains.forEach(chain => {
      chain.forEach((nodeId, nodeIndex) => {
        astNodeTree.addNode(nodeId, chain[nodeIndex - 1])
      })
    })

    const artefact = {
      nodeRegistry: {
        get: (nodeId: NodeId) => nodesById.get(nodeId),
      },
      astNodeTree,
    } as unknown as CompilationArtefact
    const result = builder.build({
      basePath,
      journeyIndex: new Map(journeys.map(journey => [journey.id, journey])),
      stepIndex: new Map(steps.map(step => [step.id, step])),
      artefact,
    })

    return { index, result }
  }

  it('should include the base path as route segment nodes', () => {
    // Arrange
    const journey = createJourneyNode('compile_ast:1', '/journey', 'journey')
    const step = createStepNode('compile_ast:2', '/start', 'Start')

    // Act
    const { index } = buildRouteTree([journey], [step], [[journey.id, step.id]], '/forms')

    // Assert
    expect(index.roots).toMatchObject([
      {
        segment: 'forms',
        templatePath: '/forms',
        children: [
          {
            segment: 'journey',
            templatePath: '/forms/journey',
            route: { kind: 'journey', nodeId: journey.id },
            children: [{ segment: 'start', templatePath: '/forms/journey/start' }],
          },
        ],
      },
    ])
  })

  it('should merge shared route segments for sibling routes', () => {
    // Arrange
    const journey = createJourneyNode('compile_ast:3', '/apply', 'apply')
    const nameStep = createStepNode('compile_ast:4', '/personal/name', 'Name')
    const dateOfBirthStep = createStepNode('compile_ast:5', '/personal/date-of-birth', 'Date of birth')

    // Act
    const { index } = buildRouteTree(
      [journey],
      [nameStep, dateOfBirthStep],
      [
        [journey.id, nameStep.id],
        [journey.id, dateOfBirthStep.id],
      ],
    )

    // Assert
    expect(index.roots[0].children).toMatchObject([
      {
        segment: 'personal',
        templatePath: '/apply/personal',
        children: [
          { segment: 'name', templatePath: '/apply/personal/name' },
          { segment: 'date-of-birth', templatePath: '/apply/personal/date-of-birth' },
        ],
      },
    ])
    expect(index.roots[0].children[0].route).toBeUndefined()
  })

  it('should build nested journey and step routes from compiled ancestry', () => {
    // Arrange
    const guideJourney = createJourneyNode('compile_ast:6', '/guide', 'guide')
    const sectionJourney = createJourneyNode('compile_ast:7', '/building-journeys', 'building-journeys')
    const overviewStep = createStepNode('compile_ast:8', '/overview', 'Overview')

    // Act
    const { index, result } = buildRouteTree(
      [guideJourney, sectionJourney],
      [overviewStep],
      [
        [guideJourney.id, sectionJourney.id],
        [guideJourney.id, sectionJourney.id, overviewStep.id],
      ],
    )

    // Assert
    expect(result.journeyContexts.map(context => context.templatePath)).toEqual(['/guide', '/guide/building-journeys'])
    expect(index.roots).toMatchObject([
      {
        segment: 'guide',
        route: { kind: 'journey', nodeId: guideJourney.id },
        children: [
          {
            segment: 'building-journeys',
            route: { kind: 'journey', nodeId: sectionJourney.id },
            children: [{ segment: 'overview', route: { kind: 'step', nodeId: overviewStep.id } }],
          },
        ],
      },
    ])
  })

  it('should preserve parameterised path segments in template paths', () => {
    // Arrange
    const journey = createJourneyNode('compile_ast:9', '/users/:userId', 'user')
    const step = createStepNode('compile_ast:10', '/items/:itemId', 'Item')

    // Act
    const { index, result } = buildRouteTree([journey], [step], [[journey.id, step.id]])

    // Assert
    expect(index.nodesByTemplatePath.has('/users/:userId/items/:itemId')).toBe(true)
    expect(result.stepContexts[0].routeTemplatePath).toBe('/users/:userId/items/:itemId')
  })

  it('should allow a concrete route node to have children', () => {
    // Arrange
    const journey = createJourneyNode('compile_ast:11', '/guide', 'guide')
    const searchStep = createStepNode('compile_ast:12', '/search', 'Search')
    const resultsStep = createStepNode('compile_ast:13', '/search/results', 'Results')

    // Act
    const { index } = buildRouteTree(
      [journey],
      [searchStep, resultsStep],
      [
        [journey.id, searchStep.id],
        [journey.id, resultsStep.id],
      ],
    )
    const searchNode = index.nodesByTemplatePath.get('/guide/search')

    // Assert
    expect(searchNode).toMatchObject({
      segment: 'search',
      route: { kind: 'step', nodeId: searchStep.id },
      children: [{ segment: 'results', route: { kind: 'step', nodeId: resultsStep.id } }],
    })
  })

  it('should throw DuplicateRouteError when two concrete routes use the same template path', () => {
    // Arrange
    const journey = createJourneyNode('compile_ast:14', '/journey', 'journey')
    const firstStep = createStepNode('compile_ast:15', '/duplicate')
    const secondStep = createStepNode('compile_ast:16', '/duplicate')

    // Act
    const act = () =>
      buildRouteTree(
        [journey],
        [firstStep, secondStep],
        [
          [journey.id, firstStep.id],
          [journey.id, secondStep.id],
        ],
      )

    // Assert
    expect(act).toThrow(DuplicateRouteError)
  })

  it('should expose contexts that replace registered route counting', () => {
    // Arrange
    const journey = createJourneyNode('compile_ast:17', '/journey', 'journey')
    const firstStep = createStepNode('compile_ast:18', '/first')
    const secondStep = createStepNode('compile_ast:19', '/second')

    // Act
    const { result } = buildRouteTree(
      [journey],
      [firstStep, secondStep],
      [
        [journey.id, firstStep.id],
        [journey.id, secondStep.id],
      ],
    )
    const routeCount = result.stepContexts.length * 2 + result.catalogsByBasePath.size

    // Assert
    expect(routeCount).toBe(5)
  })
})
