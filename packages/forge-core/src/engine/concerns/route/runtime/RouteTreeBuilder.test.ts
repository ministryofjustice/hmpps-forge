import { CompileAstNodeId, NodeId } from '../../../chassis/contracts/ast/ast.type'
import type { JourneyRouteDescriptor, StepRouteDescriptor } from '../contracts/routeDescriptors.type'
import ForgeDuplicateRouteError from '../../../errors/ForgeDuplicateRouteError'
import { createRouteTreeIndex, RouteTreeBuildResult, RouteTreeIndex } from '../contracts/routeTree.type'
import RouteTreeBuilder from './RouteTreeBuilder'

interface BuildFixture {
  index: RouteTreeIndex
  result: RouteTreeBuildResult
}

describe('RouteTreeBuilder', () => {
  function createJourneyDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyIds: readonly NodeId[],
  ): JourneyRouteDescriptor {
    return {
      nodeId: id,
      path,
      ancestorJourneyIds,
    }
  }

  function createStepDescriptor(
    id: CompileAstNodeId,
    path: string,
    ancestorJourneyIds: readonly NodeId[],
  ): StepRouteDescriptor {
    return {
      nodeId: id,
      path,
      ancestorJourneyIds,
    }
  }

  function buildRouteTree(
    journeys: JourneyRouteDescriptor[],
    steps: StepRouteDescriptor[],
    basePath = '',
  ): BuildFixture {
    const index = createRouteTreeIndex()
    const builder = new RouteTreeBuilder(index)
    const result = builder.build({
      basePath,
      journeyRouteIndex: new Map(journeys.map(j => [j.nodeId, j])),
      stepRouteIndex: new Map(steps.map(s => [s.nodeId, s])),
    })

    return { index, result }
  }

  it('should include the base path as route segment nodes', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:1', '/journey', ['compile_ast:1'])
    const step = createStepDescriptor('compile_ast:2', '/start', ['compile_ast:1'])

    // Act
    const { index } = buildRouteTree([journey], [step], '/forms')

    // Assert
    expect(index.roots).toMatchObject([
      {
        segment: 'forms',
        templatePath: '/forms',
        children: [
          {
            segment: 'journey',
            templatePath: '/forms/journey',
            route: { kind: 'journey', nodeId: journey.nodeId },
            children: [{ segment: 'start', templatePath: '/forms/journey/start' }],
          },
        ],
      },
    ])
  })

  it('should merge shared route segments for sibling routes', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:3', '/apply', ['compile_ast:3'])
    const nameStep = createStepDescriptor('compile_ast:4', '/personal/name', ['compile_ast:3'])
    const dateOfBirthStep = createStepDescriptor('compile_ast:5', '/personal/date-of-birth', ['compile_ast:3'])

    // Act
    const { index } = buildRouteTree([journey], [nameStep, dateOfBirthStep])

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
    const guideJourney = createJourneyDescriptor('compile_ast:6', '/guide', ['compile_ast:6'])
    const sectionJourney = createJourneyDescriptor('compile_ast:7', '/building-journeys', [
      'compile_ast:6',
      'compile_ast:7',
    ])
    const overviewStep = createStepDescriptor('compile_ast:8', '/overview', ['compile_ast:6', 'compile_ast:7'])

    // Act
    const { index, result } = buildRouteTree([guideJourney, sectionJourney], [overviewStep])

    // Assert
    expect(result.journeyContexts.map(context => context.templatePath)).toEqual(['/guide', '/guide/building-journeys'])
    expect(index.roots).toMatchObject([
      {
        segment: 'guide',
        route: { kind: 'journey', nodeId: guideJourney.nodeId },
        children: [
          {
            segment: 'building-journeys',
            route: { kind: 'journey', nodeId: sectionJourney.nodeId },
            children: [{ segment: 'overview', route: { kind: 'step', nodeId: overviewStep.nodeId } }],
          },
        ],
      },
    ])
  })

  it('should preserve parameterised path segments in template paths', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:9', '/users/:userId', ['compile_ast:9'])
    const step = createStepDescriptor('compile_ast:10', '/items/:itemId', ['compile_ast:9'])

    // Act
    const { index, result } = buildRouteTree([journey], [step])

    // Assert
    expect(index.nodesByTemplatePath.has('/users/:userId/items/:itemId')).toBe(true)
    expect(result.stepContexts[0].routeTemplatePath).toBe('/users/:userId/items/:itemId')
  })

  it('should allow a concrete route node to have children', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:11', '/guide', ['compile_ast:11'])
    const searchStep = createStepDescriptor('compile_ast:12', '/search', ['compile_ast:11'])
    const resultsStep = createStepDescriptor('compile_ast:13', '/search/results', ['compile_ast:11'])

    // Act
    const { index } = buildRouteTree([journey], [searchStep, resultsStep])
    const searchNode = index.nodesByTemplatePath.get('/guide/search')

    // Assert
    expect(searchNode).toMatchObject({
      segment: 'search',
      route: { kind: 'step', nodeId: searchStep.nodeId },
      children: [{ segment: 'results', route: { kind: 'step', nodeId: resultsStep.nodeId } }],
    })
  })

  it('should throw ForgeDuplicateRouteError when two concrete routes use the same template path', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:14', '/journey', ['compile_ast:14'])
    const firstStep = createStepDescriptor('compile_ast:15', '/duplicate', ['compile_ast:14'])
    const secondStep = createStepDescriptor('compile_ast:16', '/duplicate', ['compile_ast:14'])

    // Act
    const act = () => buildRouteTree([journey], [firstStep, secondStep])

    // Assert
    expect(act).toThrow(ForgeDuplicateRouteError)
  })

  it('should allow a step to occupy the same path as its parent journey', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:20', '/', ['compile_ast:20'])
    const step = createStepDescriptor('compile_ast:21', '/', ['compile_ast:20'])

    // Act
    const { index } = buildRouteTree([journey], [step])

    // Assert
    expect(index.roots).toMatchObject([
      {
        segment: '',
        templatePath: '/',
        route: { kind: 'step', nodeId: step.nodeId },
      },
    ])
    expect(index.journeyNodesById.get(journey.nodeId)).toBe(index.stepNodesById.get(step.nodeId))
  })

  it('should expose contexts that replace registered route counting', () => {
    // Arrange
    const journey = createJourneyDescriptor('compile_ast:17', '/journey', ['compile_ast:17'])
    const firstStep = createStepDescriptor('compile_ast:18', '/first', ['compile_ast:17'])
    const secondStep = createStepDescriptor('compile_ast:19', '/second', ['compile_ast:17'])

    // Act
    const { result } = buildRouteTree([journey], [firstStep, secondStep])
    const routeCount = result.stepContexts.length * 2 + result.catalogsByBasePath.size

    // Assert
    expect(routeCount).toBe(5)
  })
})
