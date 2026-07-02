import { describe, expect, it, vi } from 'vitest'
import { NO_OP_RESPONSE_BINDINGS } from '../../../../framework/types/responseBindings.type'
import FunctionRegistry from '../../../registries/FunctionRegistry'
import WorkTaskFactory from '../work/WorkTaskFactory'
import { REQUEST_RESOLVE_WORK_HANDLER } from './RequestResolveWorkHandler'
import type { CompiledResolveContext } from '../../../contracts/compiled/compiledContexts.type'
import type { CompiledResolveFunction } from '../../../contracts/compiled/compiledFunctions.type'
import type { RequestExecutionContext } from '../../../contracts/runtime/RequestExecutionContext.type'
import type { RequestResolveWorkProps } from '../../../contracts/runtime/RequestPipelineWork.type'
import type { StepValidationFailure } from '../../../contracts/runtime/evaluationState.type'
import type { WorkContextContract } from '../../../contracts/runtime/work.type'

function createRequestContext(
  failure: StepValidationFailure,
): WorkContextContract<RequestExecutionContext, RequestResolveWorkProps> {
  const compiled: CompiledResolveFunction = vi.fn(
    (_ctx: CompiledResolveContext): Awaited<ReturnType<CompiledResolveFunction>> =>
      WorkTaskFactory.resolveBlocks([], {}, []) as unknown as Awaited<ReturnType<CompiledResolveFunction>>,
  )
  const request: RequestExecutionContext = {
    context: {
      request: {
        url: '/step',
        path: '/step',
        method: 'POST',
        location: {
          origin: 'https://example.test',
          href: 'https://example.test/step',
          pathname: '/step',
          basePath: '',
        },
        headers: {},
        cookies: {},
        state: {},
        params: {},
        query: {},
        post: {},
        session: {},
      },
      domain: { data: {}, answers: {} },
      evaluation: {},
    },
    responseBindings: NO_OP_RESPONSE_BINDINGS,
    functionRegistry: new FunctionRegistry(),
    hasRenderer: false,
    showValidationFailures: true,
    validation: {
      isValid: false,
      fieldFailures: [failure],
      domainFailures: [],
    },
    buildStepValidation: () => undefined,
    recordStepValidation: () => {},
  }

  return {
    request,
    props: {
      compiled,
      path: '/step',
    },
    withWork: () => createRequestContext(failure),
  }
}

describe('REQUEST_RESOLVE_WORK_HANDLER', () => {
  describe('begin()', () => {
    it('should pass field failures keyed by block ID to compiled resolve', async () => {
      // Arrange
      const failure: StepValidationFailure = {
        blockId: 'compiled:template:1:0',
        blockCode: 'name',
        passed: false,
        message: 'Enter a name',
        submissionOnly: true,
        groups: ['default'],
      }
      const ctx = createRequestContext(failure)

      // Act
      await REQUEST_RESOLVE_WORK_HANDLER.begin(ctx)

      // Assert
      const compiled = ctx.props.compiled

      expect(compiled).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldFailures: {
            'compiled:template:1:0': [
              {
                blockCode: 'name',
                passed: false,
                message: 'Enter a name',
                submissionOnly: true,
                groups: ['default'],
              },
            ],
          },
        }),
      )
      expect(compiled).not.toHaveBeenCalledWith(
        expect.objectContaining({
          fieldFailures: expect.objectContaining({ name: expect.any(Array) }),
        }),
      )
    })
  })
})
