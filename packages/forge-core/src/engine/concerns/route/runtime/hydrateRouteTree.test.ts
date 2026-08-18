import { AstNodeId } from '../../../chassis/contracts/ast/engine.type'
import type { ResolvedRouteMetadata } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import { StoredRouteTreeNode } from '../contracts/routeTree.type'
import { hydrateRouteTree } from './hydrateRouteTree'

function createStoredStep(path: string, id: AstNodeId = 'compile_ast:100'): StoredRouteTreeNode {
  return {
    segment: getLastSegment(path),
    templatePath: path,
    route: {
      kind: 'step',
      nodeId: id,
    },
    children: [],
  }
}

function createStoredJourney(
  path: string,
  children: StoredRouteTreeNode[],
  id: AstNodeId = 'compile_ast:200',
): StoredRouteTreeNode {
  return {
    segment: getLastSegment(path),
    templatePath: path,
    route: {
      kind: 'journey',
      nodeId: id,
    },
    children,
  }
}

function getLastSegment(path: string): string {
  return path.split('/').filter(Boolean).at(-1) ?? ''
}

describe('hydrateRouteTree', () => {
  describe('hydrateRouteTree()', () => {
    it('should resolve param placeholders in route tree paths', () => {
      // Arrange
      const routeTree = [
        createStoredJourney('/user/:userId', [
          createStoredStep('/user/:userId/profile', 'compile_ast:101'),
          createStoredStep('/user/:userId/settings', 'compile_ast:102'),
        ]),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/user/:userId/profile', { userId: 'abc-123' }, {})

      // Assert
      expect(result[0].path).toBe('/user/abc-123')
      expect(result[0].children[0].path).toBe('/user/abc-123/profile')
      expect(result[0].children[1].path).toBe('/user/abc-123/settings')
    })

    it('should preserve active state when resolving param placeholders', () => {
      // Arrange
      const routeTree = [
        createStoredJourney('/user/:userId', [
          createStoredStep('/user/:userId/profile', 'compile_ast:101'),
          createStoredStep('/user/:userId/settings', 'compile_ast:102'),
        ]),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/user/:userId/profile', { userId: 'abc-123' }, {})

      // Assert
      expect(result[0].active).toBe(true)
      expect(result[0].children[0].active).toBe(true)
      expect(result[0].children[1].active).toBe(false)
    })

    it('should leave unmatched param placeholders unchanged', () => {
      // Arrange
      const routeTree = [
        createStoredJourney('/user/:userId', [createStoredStep('/user/:userId/item/:itemId', 'compile_ast:101')]),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/user/:userId/item/:itemId', { userId: 'abc-123' }, {})

      // Assert
      expect(result[0].children[0].path).toBe('/user/abc-123/item/:itemId')
    })

    it('should merge resolved route metadata onto each node and its route by node id', () => {
      // Arrange
      const routeTree = [createStoredJourney('/journey', [createStoredStep('/journey/step', 'compile_ast:101')])]
      const routeMetadata: ResolvedRouteMetadata = {
        'compile_ast:101': { title: 'Step', metadata: { hiddenFromNav: true } },
      }

      // Act
      const result = hydrateRouteTree(routeTree, '/journey/step', {}, routeMetadata)
      const stepNode = result[0].children[0]

      // Assert
      expect(stepNode.metadata).toEqual({ hiddenFromNav: true })
      expect(stepNode.route).toEqual({
        kind: 'step',
        nodeId: 'compile_ast:101',
        title: 'Step',
        description: undefined,
        metadata: { hiddenFromNav: true },
      })
      expect(result[0].metadata).toBeUndefined()
      expect(result[0].route?.title).toBeUndefined()
    })

    it('should build route tree with active state and metadata resolved from the map', () => {
      // Arrange
      const routeTree = [
        createStoredJourney(
          '/journey',
          [
            createStoredStep('/journey/step-1', 'compile_ast:101'),
            createStoredJourney(
              '/journey/child',
              [createStoredStep('/journey/child/step', 'compile_ast:102')],
              'compile_ast:103',
            ),
          ],
          'compile_ast:104',
        ),
      ]
      const routeMetadata: ResolvedRouteMetadata = {
        'compile_ast:104': { title: 'Journey', description: 'Journey Description' },
        'compile_ast:101': { title: 'Step 1' },
        'compile_ast:103': { title: 'Child Journey' },
        'compile_ast:102': { title: 'Child Step' },
      }

      // Act
      const result = hydrateRouteTree(routeTree, '/journey/child/step', {}, routeMetadata)

      // Assert
      expect(result).toEqual([
        {
          segment: 'journey',
          path: '/journey',
          templatePath: '/journey',
          active: true,
          metadata: undefined,
          route: {
            kind: 'journey',
            nodeId: 'compile_ast:104',
            title: 'Journey',
            description: 'Journey Description',
            metadata: undefined,
          },
          children: [
            {
              segment: 'step-1',
              path: '/journey/step-1',
              templatePath: '/journey/step-1',
              active: false,
              metadata: undefined,
              route: {
                kind: 'step',
                nodeId: 'compile_ast:101',
                title: 'Step 1',
                description: undefined,
                metadata: undefined,
              },
              children: [],
            },
            {
              segment: 'child',
              path: '/journey/child',
              templatePath: '/journey/child',
              active: true,
              metadata: undefined,
              route: {
                kind: 'journey',
                nodeId: 'compile_ast:103',
                title: 'Child Journey',
                description: undefined,
                metadata: undefined,
              },
              children: [
                {
                  segment: 'step',
                  path: '/journey/child/step',
                  templatePath: '/journey/child/step',
                  active: true,
                  metadata: undefined,
                  route: {
                    kind: 'step',
                    nodeId: 'compile_ast:102',
                    title: 'Child Step',
                    description: undefined,
                    metadata: undefined,
                  },
                  children: [],
                },
              ],
            },
          ],
        },
      ])
    })
  })
})
