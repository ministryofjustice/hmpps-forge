import { describe, expect, it, vi } from 'vitest'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'
import FunctionRegistry from '../../../chassis/registries/FunctionRegistry'
import ComponentRegistry from '../../../chassis/registries/ComponentRegistry'
import { REQUEST_ROUTE_TREE_WORK_HANDLER } from './RequestRouteTreeWorkHandler'
import type { CompiledRouteMetadataFunction } from '../../../chassis/contracts/compiled/compiledFunctions.type'
import type RequestState from '../../../chassis/runtime/pipeline/RequestState'
import type { RequestRouteTreeWorkProps } from '../../../chassis/contracts/runtime/RequestPipelineWork.type'
import type { StoredRouteTree } from '../contracts/routeTree.type'
import type { WorkContextContract } from '../../../chassis/contracts/work/work.type'
import { createTestRequestState } from '../../../chassis/runtime/pipeline/testing-helpers/requestStateTestHelpers'

const STORED_TREE: StoredRouteTree = [
  {
    segment: 'user',
    templatePath: '/user/:userId',
    route: { kind: 'journey', nodeId: 'compile_ast:200' },
    children: [
      {
        segment: 'profile',
        templatePath: '/user/:userId/profile',
        route: { kind: 'step', nodeId: 'compile_ast:100' },
        children: [],
      },
    ],
  },
]

function createContext(
  compiled: CompiledRouteMetadataFunction,
  routeTree: StoredRouteTree,
): WorkContextContract<RequestState, RequestRouteTreeWorkProps> {
  const request: RequestState = createTestRequestState(
    {
      request: {
        url: '/user/abc-123/profile',
        path: '/user/abc-123/profile',
        method: 'GET',
        location: {
          origin: 'https://example.test',
          href: 'https://example.test/user/abc-123/profile',
          pathname: '/user/abc-123/profile',
          basePath: '',
        },
        headers: {},
        cookies: {},
        state: {},
        params: { userId: 'abc-123' },
        query: {},
        post: {},
        session: {},
      },
      domain: { data: {}, answers: {} },
      evaluation: {},
    },
    {
      responseBindings: NO_OP_RESPONSE_BINDINGS,
      functionRegistry: new FunctionRegistry(),
      componentRegistry: new ComponentRegistry(),
    },
  )

  return {
    state: request,
    props: {
      compiled,
      path: '/user/abc-123/profile',
      routeTree,
      currentRouteTemplatePath: '/user/:userId/profile',
    },
    withWork: () => createContext(compiled, routeTree),
  }
}

describe('REQUEST_ROUTE_TREE_WORK_HANDLER', () => {
  describe('complete()', () => {
    it('should evaluate route metadata, hydrate the topology, and stash the tree on the request', async () => {
      // Arrange
      const compiled: CompiledRouteMetadataFunction = vi.fn(() => ({
        'compile_ast:200': { title: 'User' },
        'compile_ast:100': { title: 'Profile', metadata: { nav: true } },
      }))
      const ctx = createContext(compiled, STORED_TREE)

      // Act
      const result = await REQUEST_ROUTE_TREE_WORK_HANDLER.complete?.(ctx, [])

      // Assert
      expect(compiled).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ action: 'continue' })

      const tree = ctx.state.routeTree ?? []
      const journey = tree[0]
      const step = journey.children[0]

      expect(journey.path).toBe('/user/abc-123')
      expect(journey.route?.title).toBe('User')
      expect(journey.active).toBe(true)
      expect(step.path).toBe('/user/abc-123/profile')
      expect(step.route?.title).toBe('Profile')
      expect(step.route?.metadata).toEqual({ nav: true })
      expect(step.metadata).toEqual({ nav: true })
      expect(step.active).toBe(true)
    })
  })

  describe('begin()', () => {
    it('should not spawn child work', () => {
      // Arrange
      const compiled: CompiledRouteMetadataFunction = vi.fn(() => ({}))
      const ctx = createContext(compiled, STORED_TREE)

      // Act
      const result = REQUEST_ROUTE_TREE_WORK_HANDLER.begin(ctx)

      // Assert
      expect(result).toEqual({ groups: [] })
    })
  })
})
