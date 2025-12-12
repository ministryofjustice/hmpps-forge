/**
 * Sets up component test utilities for jest
 *
 * Adds custom matchers for HTML content checking.
 * Call in top-level describe block.
 */
export function setupComponentTest() {
  beforeAll(() => {
    expect.extend({
      toContainText(received: string, expected: string) {
        const encodedExpected = encodeHtmlEntities(expected)
        const pass = received.includes(expected) || received.includes(encodedExpected)

        return {
          pass,
          message: () =>
            pass
              ? `Expected HTML not to contain text "${expected}"`
              : `Expected HTML to contain text "${expected}" (or encoded: "${encodedExpected}")`,
        }
      },
    })
  })
}

function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
