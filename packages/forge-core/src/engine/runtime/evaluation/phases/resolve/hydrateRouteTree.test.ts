import { AstNodeId } from '../../../../contracts/ast/engine.type'
import { StoredRouteTreeNode } from '../../../../contracts/routing/routeTree.type'
import { hydrateRouteTree } from './hydrateRouteTree'

function createStoredStep(path: string, title?: string, id: AstNodeId = 'compile_ast:100'): StoredRouteTreeNode {
  const metadata = undefined

  return {
    segment: getLastSegment(path),
    templatePath: path,
    metadata,
    route: {
      kind: 'step',
      nodeId: id,
      title,
      metadata,
    },
    children: [],
  }
}

function createStoredJourney(
  path: string,
  children: StoredRouteTreeNode[],
  overrides: Partial<{
    id: AstNodeId
    title: string
    description: string
    metadata: Record<string, unknown>
  }> = {},
): StoredRouteTreeNode {
  const id = overrides.id ?? 'compile_ast:200'

  return {
    segment: getLastSegment(path),
    templatePath: path,
    metadata: overrides.metadata,
    route: {
      kind: 'journey',
      nodeId: id,
      title: overrides.title,
      description: overrides.description,
      metadata: overrides.metadata,
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
        createStoredJourney(
          '/user/:userId',
          [
            createStoredStep('/user/:userId/profile', 'Profile'),
            createStoredStep('/user/:userId/settings', 'Settings'),
          ],
          { title: 'User' },
        ),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/user/:userId/profile', { userId: 'abc-123' })

      // Assert
      expect(result[0].path).toBe('/user/abc-123')
      expect(result[0].children[0].path).toBe('/user/abc-123/profile')
      expect(result[0].children[1].path).toBe('/user/abc-123/settings')
    })

    it('should preserve active state when resolving param placeholders', () => {
      // Arrange
      const routeTree = [
        createStoredJourney(
          '/user/:userId',
          [
            createStoredStep('/user/:userId/profile', 'Profile'),
            createStoredStep('/user/:userId/settings', 'Settings'),
          ],
          { title: 'User' },
        ),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/user/:userId/profile', { userId: 'abc-123' })

      // Assert
      expect(result[0].active).toBe(true)
      expect(result[0].children[0].active).toBe(true)
      expect(result[0].children[1].active).toBe(false)
    })

    it('should leave unmatched param placeholders unchanged', () => {
      // Arrange
      const routeTree = [
        createStoredJourney('/user/:userId', [createStoredStep('/user/:userId/item/:itemId', 'Item')], {
          title: 'User',
        }),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/user/:userId/item/:itemId', { userId: 'abc-123' })

      // Assert
      expect(result[0].children[0].path).toBe('/user/abc-123/item/:itemId')
    })

    it('should build route tree with active state from stored routes', () => {
      // Arrange
      const routeTree = [
        createStoredJourney(
          '/journey',
          [
            createStoredStep('/journey/step-1', 'Step 1', 'compile_ast:101'),
            createStoredJourney(
              '/journey/child',
              [createStoredStep('/journey/child/step', 'Child Step', 'compile_ast:102')],
              {
                id: 'compile_ast:103',
                title: 'Child Journey',
              },
            ),
          ],
          {
            id: 'compile_ast:104',
            title: 'Journey',
            description: 'Journey Description',
          },
        ),
      ]

      // Act
      const result = hydrateRouteTree(routeTree, '/journey/child/step', {})

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
