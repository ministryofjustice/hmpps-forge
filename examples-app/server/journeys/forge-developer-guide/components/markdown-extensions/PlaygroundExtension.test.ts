import { beforeEach, describe, expect, it } from 'vitest'
import { PlaygroundExtension } from './PlaygroundExtension'
import type { ExtensionChunk } from './MarkdownExtension'

describe('PlaygroundExtension', () => {
  let extension: PlaygroundExtension
  let chunk: ExtensionChunk

  beforeEach(() => {
    extension = new PlaygroundExtension()
    chunk = {
      kind: 'extension',
      containerName: 'playground',
      attrs: {
        title: 'Branching',
        base: '/assets/playground/branching/',
        entry: 'journey.ts',
        start: '/branching/overview',
      },
      body: 'journey.ts\nsteps/question.ts',
      children: [],
    }
  })

  it('should preserve file order when rendering configuration', () => {
    // Arrange
    const files = ['journey.ts', 'steps/question.ts']

    // Act
    const html = extension.renderContainer(chunk)

    // Assert
    expect(html).toContain('<script type="application/json" data-playground>')
    expect(html).toContain(JSON.stringify(files))
  })

  it('should escape script delimiters when the title contains HTML', () => {
    // Arrange
    chunk.attrs.title = '</script><script>alert(1)</script>'

    // Act
    const html = extension.renderContainer(chunk)

    // Assert
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    expect(html).toContain('\\u003c/script>')
  })

  it.each([
    '',
    'journey.ts\njourney.ts',
    '../journey.ts',
    'steps/question.ts',
    'journey.ts\nsecret.test.ts',
  ])('should show an error when the file list is invalid: %s', body => {
    // Arrange
    chunk.body = body

    // Act
    const html = extension.renderContainer(chunk)

    // Assert
    expect(html).toContain('role="alert"')
    expect(html).not.toContain('<script')
  })
})
