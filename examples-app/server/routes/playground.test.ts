import express from 'express'
import request from 'supertest'
import { statSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import playgroundRouter from './playground'

vi.mock('node:fs/promises', () => ({ readFile: vi.fn(), stat: vi.fn() }))

describe('playgroundRouter', () => {
  let app: express.Express

  beforeEach(() => {
    vi.mocked(readFile).mockReset().mockResolvedValue('')
    vi.mocked(stat)
      .mockReset()
      .mockResolvedValue(Object.assign(statSync(__filename), { mtimeMs: 123 }))
    app = express()
    app.use(playgroundRouter())
  })

  it('should isolate the preview when opened directly', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValue('/* bundled asset */')

    // Act
    const response = await request(app).get('/preview')

    // Assert
    expect(response.status).toBe(200)
    expect(response.headers['content-security-policy']).toContain(
      'sandbox allow-scripts allow-forms;',
    )
    expect(response.headers['content-security-policy']).not.toContain('allow-same-origin')
    expect(response.headers['content-security-policy']).toContain("connect-src 'none'")
    expect(response.headers['content-security-policy']).toContain("form-action 'none'")
    expect(response.headers['cache-control']).toBe('no-store')
    const nonce = response.text.match(/<script nonce="([^"]+)"/)?.[1]

    expect(nonce).toBeTruthy()
    expect(response.headers['content-security-policy']).toContain(`'nonce-${nonce}'`)
  })

  it('should version the external runtime when its build changes', async () => {
    // Arrange
    vi.mocked(stat)
      .mockResolvedValueOnce(Object.assign(statSync(__filename), { mtimeMs: 123 }))
      .mockResolvedValueOnce(Object.assign(statSync(__filename), { mtimeMs: 456 }))

    // Act
    const first = await request(app).get('/preview')
    const rebuilt = await request(app).get('/preview')

    // Assert
    expect(first.text).toContain('src="/assets/playground/preview.js?v=123"')
    expect(rebuilt.text).toContain('src="/assets/playground/preview.js?v=456"')
    expect(
      vi.mocked(readFile).mock.calls.every(([file]) => !String(file).endsWith('preview.js')),
    ).toBe(true)
  })

  it('should escape closing tags when embedding preview styles', async () => {
    // Arrange
    vi.mocked(readFile).mockResolvedValueOnce('/* </style> */')

    // Act
    const response = await request(app).get('/preview')

    // Assert
    expect(response.status).toBe(200)
    expect(response.text).toContain('<\\/style>')
    expect(response.text.match(/<\/script>/g)).toHaveLength(1)
  })
  it('should embed both font weights when serving the preview', async () => {
    // Arrange
    vi.mocked(readFile)
      .mockResolvedValueOnce(
        `
        @font-face { font-family: "GDS Transport"; font-weight: normal;
          src: url("/assets/fonts/light.woff2") format("woff2"), url("/assets/fonts/light.woff") format("woff"); }
        @font-face { font-family: "GDS Transport"; font-weight: bold;
          src: url("/assets/fonts/bold.woff2") format("woff2"), url("/assets/fonts/bold.woff") format("woff"); }
        .govuk-body { font-family: "GDS Transport"; }
      `,
      )
      .mockResolvedValueOnce('cmVndWxhcg==')
      .mockResolvedValueOnce('Ym9sZA==')

    // Act
    const response = await request(app).get('/preview')

    // Assert
    expect(response.status).toBe(200)
    expect(response.text).not.toContain('/assets/fonts/')
    expect(response.text.match(/@font-face/g)).toHaveLength(2)
    expect(response.text).toContain('.govuk-body { font-family: "GDS Transport"; }')
    expect(response.text).toContain('font-weight: 400;')
    expect(response.text).toContain('font-weight: 700;')
    expect(response.text).toContain('data:font/woff2;base64,cmVndWxhcg==')
    expect(response.text).toContain('data:font/woff2;base64,Ym9sZA==')
    expect(response.headers['content-security-policy']).toContain('font-src data:;')
    expect(response.headers['content-security-policy']).toContain("default-src 'none'")
    expect(response.headers['content-security-policy']).toContain("connect-src 'none'")
  })
})
