import express from 'express'
import session from 'express-session'
import request from 'supertest'
import { Forge } from '@ministryofjustice/hmpps-forge/core'
import type { LlmSupplier } from '@ministryofjustice/hmpps-forge/llm-adapter'
import { llmDemoPackage } from '@ministryofjustice/hmpps-forge/llm-adapter/demo'

import { LlmWebchatRouter } from './LlmWebchatRouter'

describe('LlmWebchatRouter', () => {
  describe('POST /llm-webchat/messages/stream', () => {
    it('should stream acceptance before returning the adapter result', async () => {
      // Arrange
      const forge = new Forge({
        logger: {
          debug: () => {},
          info: () => {},
          warn: () => {},
          error: () => {},
        },
      }).registerPackage(llmDemoPackage)
      const supplier: LlmSupplier = {
        resolveTurn: vi.fn().mockResolvedValue({ answers: {} }),
      }
      const app = express()

      app.engine('njk', (_path, _options, callback) => callback(undefined, 'webchat'))
      app.set('view engine', 'njk')
      app.set('views', 'server/views')
      app.use(express.urlencoded({ extended: true }))
      app.use(
        session({
          secret: 'llm-webchat-test',
          resave: false,
          saveUninitialized: false,
        }),
      )
      app.use(
        new LlmWebchatRouter({
          forge,
          supplier,
          origin: 'http://localhost:3000',
          enabled: true,
        }).create(),
      )
      const browser = request.agent(app)

      await browser.get('/llm-webchat').expect(200)

      // Act
      const response = await browser
        .post('/llm-webchat/messages/stream')
        .type('form')
        .send({ message: 'I rent a flat' })
        .expect('Content-Type', /application\/x-ndjson/)
        .expect(200)
      const events = response.text
        .trim()
        .split('\n')
        .map(line => JSON.parse(line))

      // Assert
      expect(events).toEqual([
        expect.objectContaining({
          type: 'accepted',
          message: 'I rent a flat',
        }),
        expect.objectContaining({
          type: 'result',
          status: 'awaiting-input',
        }),
      ])
    })
  })
})
