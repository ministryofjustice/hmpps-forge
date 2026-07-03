import type { RequestSnapshot } from '../../../../framework/types/snapshot.type'
import type { RequestContextPreparationWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { WorkContextContract } from '../../../contracts/runtime/work.type'
import { REQUEST_CONTEXT_PREPARATION_WORK_HANDLER } from './RequestContextPreparationWorkHandler'

describe('RequestContextPreparationWorkHandler', () => {
  describe('begin()', () => {
    it('should populate context data from compiled static data', () => {
      // Arrange
      const compiledStaticData = vi.fn(() => ({ shared: 'static', enabled: true }))
      const requestContext = {
        context: {
          domain: {
            data: { existing: 'value' },
            answers: {},
          },
          request: {},
          evaluation: {},
        },
      } as unknown as RequestExecutionContext
      const snapshot = {
        nodeId: 'journey::step',
        location: {
          origin: 'https://example.com',
          href: 'https://example.com/form/step?from=test',
          pathname: '/form/step',
          basePath: '/form',
        },
        method: 'GET',
        headers: {},
        cookies: {},
        state: {},
        params: {},
        query: { from: 'test' },
        post: {},
        session: undefined,
      } satisfies RequestSnapshot
      const workContext: WorkContextContract<RequestExecutionContext, RequestContextPreparationWorkProps> = {
        request: requestContext,
        props: {
          compiledStaticData,
          snapshot,
        },
        withWork: vi.fn(),
      }

      // Act
      const result = REQUEST_CONTEXT_PREPARATION_WORK_HANDLER.begin(workContext)

      // Assert
      expect(result).toEqual({ output: { action: 'continue' } })
      expect(compiledStaticData).toHaveBeenCalledOnce()
      expect(requestContext.context.domain.data).toEqual({
        existing: 'value',
        shared: 'static',
        enabled: true,
      })
      expect(requestContext.context.request).toMatchObject({
        url: 'https://example.com/form/step?from=test',
        path: '/form/step',
        method: 'GET',
        query: { from: 'test' },
        session: {},
      })
    })
  })
})
