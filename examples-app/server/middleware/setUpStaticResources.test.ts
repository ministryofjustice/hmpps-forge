import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import setUpStaticResources from './setUpStaticResources'

describe('setUpStaticResources', () => {
  let app: express.Express

  beforeEach(() => {
    app = express()
    app.use(setUpStaticResources())
  })

  it('should serve TypeScript as text when requesting an example', async () => {
    // Arrange
    const url = '/assets/playground/branching/visit-type.ts'

    // Act
    const response = await request(app).get(url)

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/plain')
    expect(response.text).toContain('export const visitTypeStep')
  })

  it.each(['journey.test.ts', 'missing.ts'])(
    'should return not found when the file is not public: %s',
    async file => {
      // Arrange
      const url = `/assets/playground/branching/${file}`

      // Act
      const response = await request(app).get(url)

      // Assert
      expect(response.status).toBe(404)
    },
  )
})
