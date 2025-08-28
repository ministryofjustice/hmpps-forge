/**
 * Encodes text to match HTML entity encoding
 * Common replacements for HTML entities that appear in rendered content
 */
function encodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Custom matcher to check if HTML contains text (accounting for HTML entity encoding)
 */
const toContainText: jest.CustomMatcher = function toContainTextMatcher(
  this: jest.MatcherContext,
  received: string,
  expected: string,
): jest.CustomMatcherResult {
  const encodedExpected = encodeHtmlEntities(expected)
  const pass = received.includes(expected) || received.includes(encodedExpected)

  const message = pass
    ? () =>
        `Expected HTML not to contain text "${expected}" (or encoded: "${encodedExpected}"), but it did.\n\n` +
        `Received: ${this.utils.printReceived(received)}`
    : () =>
        `Expected HTML to contain text "${expected}" (or encoded: "${encodedExpected}"), but it didn't.\n\n` +
        `Received: ${this.utils.printReceived(received)}`

  return { pass, message }
}

expect.extend({
  toContainText,
})
