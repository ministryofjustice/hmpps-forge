import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { Router } from 'express'

export default function playgroundRouter(): Router {
  const router = Router()

  router.get('/preview', async (_req, res) => {
    const nonce = randomBytes(18).toString('base64')
    const [script, styles, regularFont, boldFont] = await Promise.all([
      readFile(path.join(process.cwd(), 'dist/assets/playground/preview.js'), 'utf8'),
      readFile(path.join(process.cwd(), 'dist/assets/css/index.css'), 'utf8'),
      readFile(
        path.join(
          process.cwd(),
          'node_modules/govuk-frontend/dist/govuk/assets/fonts/light-94a07e06a1-v2.woff2',
        ),
        'base64',
      ),
      readFile(
        path.join(
          process.cwd(),
          'node_modules/govuk-frontend/dist/govuk/assets/fonts/bold-b542beb274-v2.woff2',
        ),
        'base64',
      ),
    ])

    // Remove the guide's external font faces before adding sandbox-safe data URLs.
    const previewStyles = styles.replace(
      /@font-face\s*\{[^{}]*font-family:\s*["']GDS Transport["'][^{}]*\}/gi,
      '',
    )
    const embeddedFonts = [
      { weight: 400, source: regularFont },
      { weight: 700, source: boldFont },
    ]
      .map(
        ({ weight, source }) =>
          `@font-face { font-family: "GDS Transport"; font-style: normal; font-weight: ${weight}; font-display: swap; src: url("data:font/woff2;base64,${source}") format("woff2"); }`,
      )
      .join('\n')

    // The response sandbox also applies when someone opens this URL directly.
    res.setHeader(
      'Content-Security-Policy',
      [
        'sandbox allow-scripts allow-forms',
        "default-src 'none'",
        `script-src 'nonce-${nonce}' 'unsafe-eval'`,
        "style-src 'unsafe-inline'",
        'font-src data:',
        "connect-src 'none'",
        "form-action 'none'",
        "base-uri 'none'",
        "frame-ancestors 'self'",
      ].join('; '),
    )
    res.setHeader('Cache-Control', 'no-store')
    res
      .type('html')
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Journey preview</title><style>${previewStyles.replace(/<\/style/gi, '<\\/style')}${embeddedFonts} body.govuk-body { margin: 30px 30px 40px; } * { font-family: "GDS Transport", "Helvetica Neue", Arial, sans-serif; } .govuk-fieldset__heading { font-size: 27px; font-weight: 700; line-height: 1.1; margin-bottom: 20px; } body.govuk-body .govuk-radios__label, body.govuk-body .govuk-button { font-family: "GDS Transport", "Helvetica Neue", Arial, sans-serif; } .govuk-button { width: auto; background-color: #00703c; box-shadow: 0 2px 0 #002d18; }</style></head><body class="govuk-body"><main></main><script nonce="${nonce}">${script.replace(/<\/script/gi, '<\\/script')}</script></body></html>`,
      )
  })

  return router
}
