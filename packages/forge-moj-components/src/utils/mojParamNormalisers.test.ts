import { ComponentCallType } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import { normaliseMojTextHtmlContent } from './mojParamNormalisers'

const renderedBlock = (html: string): RenderedBlock => ({
  block: {
    _forge: ComponentCallType.BASIC,
    variant: 'html',
  },
  html,
})

describe('normaliseMojTextHtmlContent', () => {
  it('should preserve text when html is present without blocks', () => {
    // Arrange
    const content = {
      text: 'Text remains',
      html: '<p>HTML</p>',
    }

    // Act
    const result = normaliseMojTextHtmlContent(content)

    // Assert
    expect(result).toEqual({ text: 'Text remains', html: '<p>HTML</p>' })
  })

  it('should suppress text and use blocks before html when blocks are present', () => {
    // Arrange
    const content = {
      text: 'Ignored',
      html: '<p>HTML ignored</p>',
      blocks: [renderedBlock('<p>Block</p>')],
    }

    // Act
    const result = normaliseMojTextHtmlContent(content)

    // Assert
    expect(result).toEqual({ text: undefined, html: '<p>Block</p>' })
  })

  it('should return undefined html when blocks are empty and html is missing', () => {
    // Arrange
    const content = {
      text: 'Text remains',
      blocks: [],
    }

    // Act
    const result = normaliseMojTextHtmlContent(content)

    // Assert
    expect(result).toEqual({ text: 'Text remains', html: undefined })
  })
})
