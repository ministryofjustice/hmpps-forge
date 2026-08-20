import { expect } from 'vitest'
import type { Matcher, MatcherResult, MatcherState } from 'vitest'

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
const toContainText: Matcher = function toContainTextMatcher(
  this: MatcherState,
  received: string,
  expected: string,
): MatcherResult {
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

/**
 * Check if an AST tree contains a specific number of nodes
 */
const toHaveNodeCount: Matcher = function toHaveNodeCountMatcher(
  this: MatcherState,
  received: any,
  expected: number,
): MatcherResult {
  let count = 0

  const countNodes = (node: any): void => {
    if (!node || typeof node !== 'object') return

    if ('type' in node && 'id' in node) {
      count += 1
    }

    if (node.properties && typeof node.properties === 'object') {
      for (const value of Object.values(node.properties)) {
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            value.forEach(countNodes)
          } else {
            countNodes(value)
          }
        }
      }
    }
  }

  countNodes(received)

  const pass = count === expected

  const message = pass
    ? () => `Expected AST not to have ${expected} nodes, but it did`
    : () => `Expected AST to have ${expected} nodes, but found ${count}`

  return { pass, message }
}

/**
 * Check if an AST tree has a specific depth
 */
const toHaveDepth: Matcher = function toHaveDepthMatcher(
  this: MatcherState,
  received: any,
  expected: number,
): MatcherResult {
  const getDepth = (node: any, currentDepth: number = 0): number => {
    if (!node || typeof node !== 'object') return currentDepth

    let maxDepth = currentDepth

    if (node.properties && typeof node.properties === 'object') {
      for (const value of Object.values(node.properties)) {
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            const arrayMax = value.reduce((max, item) => {
              if (item && typeof item === 'object' && 'type' in item) {
                return Math.max(max, getDepth(item, currentDepth + 1))
              }

              return max
            }, currentDepth)

            maxDepth = Math.max(maxDepth, arrayMax)
          } else if (value !== null && 'type' in value) {
            maxDepth = Math.max(maxDepth, getDepth(value, currentDepth + 1))
          }
        }
      }
    }

    return maxDepth
  }

  const depth = getDepth(received)
  const pass = depth === expected

  const message = pass
    ? () => `Expected AST not to have depth ${expected}, but it did`
    : () => `Expected AST to have depth ${expected}, but found ${depth}`

  return { pass, message }
}

/**
 * Check if an AST tree contains a node with a specific ID
 */
const toContainNodeWithId: Matcher = function toContainNodeWithIdMatcher(
  this: MatcherState,
  received: any,
  expectedId: number,
): MatcherResult {
  const findNode = (node: any): boolean => {
    if (!node || typeof node !== 'object') return false

    if (node.id === expectedId) return true

    if (node.properties && typeof node.properties === 'object') {
      for (const value of Object.values(node.properties)) {
        if (typeof value === 'object') {
          if (Array.isArray(value)) {
            if (value.some(findNode)) return true
          } else if (findNode(value)) return true
        }
      }
    }

    return false
  }

  const pass = findNode(received)

  const message = pass
    ? () => `Expected AST not to contain node with ID ${expectedId}, but it did`
    : () => `Expected AST to contain node with ID ${expectedId}, but it didn't`

  return { pass, message }
}

/**
 * Check if an AST node has a specific type
 */
const toHaveNodeType: Matcher = function toHaveNodeTypeMatcher(
  this: MatcherState,
  received: any,
  expectedType: string,
): MatcherResult {
  const hasType = received?.type === expectedType

  const message = hasType
    ? () => `Expected node not to have type "${expectedType}", but it did`
    : () => `Expected node to have type "${expectedType}", but found "${received?.type || 'undefined'}"`

  return { pass: hasType, message }
}

/**
 * Check if an AST node has valid structure
 */
const toHaveValidStructure: Matcher = function toHaveValidStructureMatcher(
  this: MatcherState,
  received: any,
): MatcherResult {
  const errors: string[] = []

  const validateNode = (node: any, path: string = 'root'): void => {
    if (!node || typeof node !== 'object') {
      errors.push(`${path}: Not an object`)
      return
    }

    if (!('type' in node)) {
      errors.push(`${path}: Missing 'type' property`)
    }

    if (!('id' in node)) {
      errors.push(`${path}: Missing 'id' property`)
    } else if (typeof node.id !== 'number') {
      errors.push(`${path}: ID should be a number, got ${typeof node.id}`)
    }

    if (!('properties' in node)) {
      errors.push(`${path}: Missing 'properties' property`)
    } else if (!(node.properties && typeof node.properties === 'object')) {
      errors.push(`${path}: Properties should be an object`)
    }

    if (node.properties && typeof node.properties === 'object') {
      for (const [key, value] of Object.entries(node.properties)) {
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              if (item && typeof item === 'object' && 'type' in item) {
                validateNode(item, `${path}.${key}[${index}]`)
              }
            })
          } else if ('type' in value) {
            validateNode(value, `${path}.${key}`)
          }
        }
      }
    }
  }

  validateNode(received)

  const pass = errors.length === 0

  const message = pass
    ? () => 'Expected AST to have invalid structure, but it was valid'
    : () => `Expected AST to have valid structure, but found errors:\n${errors.join('\n')}`

  return { pass, message }
}

function registerTestingMatchers(): void {
  expect.extend({
    toContainText,
    toHaveNodeCount,
    toHaveDepth,
    toContainNodeWithId,
    toHaveNodeType,
    toHaveValidStructure,
  })
}

registerTestingMatchers()
