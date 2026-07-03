import type { Request, Response } from 'express'
import type { ForgeRoute } from '@ministryofjustice/hmpps-forge/core/framework'
import ExpressSnapshotFactory from './ExpressSnapshotFactory'
import type { RequestWithState } from './types'

const route: ForgeRoute = {
  nodeId: 'journey::step-one',
  kind: 'step',
  templatePath: '/journey/:code/step-one',
  basePath: '/journey/:code',
  methods: ['GET', 'POST'],
}

function createRequest(): Request {
  return {
    method: 'POST',
    originalUrl: '/journey/abc/step-one?ref=123',
    protocol: 'https',
    hostname: 'example.test',
    params: { code: 'abc' },
    query: { ref: '123' },
    body: { answer: 'yes' },
    headers: { accept: 'text/html' },
    cookies: { session: 'cookie-value' },
    session: { answers: {} },
    app: { locals: { settings: {}, appName: 'Forge' } },
    state: { userId: 42 },
  } as unknown as RequestWithState
}

function createResponse(): Response {
  return {
    locals: { banner: 'local' },
  } as unknown as Response
}

describe('ExpressSnapshotFactory', () => {
  describe('create()', () => {
    it('should create a request snapshot from an Express request', () => {
      // Arrange
      const req = createRequest()
      const res = createResponse()
      // Act
      const snapshot = ExpressSnapshotFactory.create(route, req, res)

      // Assert
      expect(snapshot).toMatchObject({
        nodeId: 'journey::step-one',
        method: 'POST',
        location: {
          origin: 'https://example.test',
          href: 'https://example.test/journey/abc/step-one?ref=123',
          pathname: '/journey/abc/step-one',
          basePath: '/journey/abc',
        },
        params: { code: 'abc' },
        query: { ref: '123' },
        post: { answer: 'yes' },
        headers: { accept: 'text/html' },
        cookies: { session: 'cookie-value' },
        state: { appName: 'Forge', banner: 'local', userId: 42 },
        session: { answers: {} },
      })
    })
  })
})
