import { ComponentCallType, StructureType } from '@ministryofjustice/hmpps-forge/core/authoring'
import type { RenderedBlock } from '@ministryofjustice/hmpps-forge/core/components'

import {
  normaliseGovukErrorMessage,
  normaliseGovukFieldset,
  normaliseGovukTextHtmlContent,
  normaliseGovukTextParam,
  renderGovukBlocksToHtml,
} from './govukParamNormalisers'

const renderedBlock = (html: string): RenderedBlock => ({
  block: {
    _forge: ComponentCallType.BASIC,
    variant: 'html',
  },
  html,
})

describe('normaliseGovukTextParam', () => {
  it('should convert string to text param when value is provided', () => {
    // Arrange
    const value = 'Help text'

    // Act
    const result = normaliseGovukTextParam(value)

    // Assert
    expect(result).toEqual({ text: 'Help text' })
  })

  it('should pass object through when value is already a GOV.UK param object', () => {
    // Arrange
    const value = {
      text: 'Help text',
      classes: 'custom-class',
    }

    // Act
    const result = normaliseGovukTextParam(value)

    // Assert
    expect(result).toBe(value)
  })

  it('should return undefined when value is missing', () => {
    // Arrange
    const value = undefined

    // Act
    const result = normaliseGovukTextParam(value)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when string value is empty', () => {
    // Arrange
    const value = ''

    // Act
    const result = normaliseGovukTextParam(value)

    // Assert
    expect(result).toBeUndefined()
  })
})

describe('normaliseGovukFieldset', () => {
  it('should create fieldset legend when fieldset is missing', () => {
    // Arrange
    const fieldset = undefined
    const legendText = 'Choose an option'

    // Act
    const result = normaliseGovukFieldset(fieldset, legendText)

    // Assert
    expect(result).toEqual({
      legend: {
        text: 'Choose an option',
      },
    })
  })

  it('should pass fieldset through when fieldset is provided', () => {
    // Arrange
    const fieldset = {
      legend: {
        text: 'Custom legend',
      },
      classes: 'custom-fieldset',
    }

    // Act
    const result = normaliseGovukFieldset(fieldset, 'Fallback legend')

    // Assert
    expect(result).toBe(fieldset)
  })

  it('should return undefined when fieldset and legend text are missing', () => {
    // Arrange
    const fieldset = undefined
    const legendText = undefined

    // Act
    const result = normaliseGovukFieldset(fieldset, legendText)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when legend text is empty', () => {
    // Arrange
    const fieldset = undefined
    const legendText = ''

    // Act
    const result = normaliseGovukFieldset(fieldset, legendText)

    // Assert
    expect(result).toBeUndefined()
  })
})

describe('renderGovukBlocksToHtml', () => {
  it('should return undefined when blocks are missing', () => {
    // Arrange
    const blocks = undefined

    // Act
    const result = renderGovukBlocksToHtml(blocks)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when blocks are empty', () => {
    // Arrange
    const blocks: RenderedBlock[] = []

    // Act
    const result = renderGovukBlocksToHtml(blocks)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should render a single block as html', () => {
    // Arrange
    const block = renderedBlock('<p>Content</p>')

    // Act
    const result = renderGovukBlocksToHtml(block)

    // Assert
    expect(result).toBe('<p>Content</p>')
  })

  it('should render multiple blocks as joined html', () => {
    // Arrange
    const blocks = [renderedBlock('<p>Line one</p>'), renderedBlock('<p>Line two</p>')]

    // Act
    const result = renderGovukBlocksToHtml(blocks)

    // Assert
    expect(result).toBe('<p>Line one</p><p>Line two</p>')
  })
})

describe('normaliseGovukTextHtmlContent', () => {
  it('should suppress text when html is present', () => {
    // Arrange
    const content = {
      text: 'Ignored',
      html: '<p>HTML</p>',
    }

    // Act
    const result = normaliseGovukTextHtmlContent(content)

    // Assert
    expect(result).toEqual({ text: undefined, html: '<p>HTML</p>' })
  })

  it('should use blocks before html and text when blocks are present', () => {
    // Arrange
    const content = {
      text: 'Ignored',
      html: '<p>HTML ignored</p>',
      blocks: [renderedBlock('<p>Block</p>')],
    }

    // Act
    const result = normaliseGovukTextHtmlContent(content)

    // Assert
    expect(result).toEqual({ text: undefined, html: '<p>Block</p>' })
  })
})

describe('normaliseGovukErrorMessage', () => {
  it('should convert first error to text param when errors are provided', () => {
    // Arrange
    const errors = [{ message: 'Enter a value' }, { message: 'Second error' }]

    // Act
    const result = normaliseGovukErrorMessage(errors)

    // Assert
    expect(result).toEqual({ text: 'Enter a value' })
  })

  it('should return undefined when errors are missing', () => {
    // Arrange
    const errors = undefined

    // Act
    const result = normaliseGovukErrorMessage(errors)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when errors are empty', () => {
    // Arrange
    const errors: { message: string }[] = []

    // Act
    const result = normaliseGovukErrorMessage(errors)

    // Assert
    expect(result).toBeUndefined()
  })

  it('should return undefined when first error message is empty', () => {
    // Arrange
    const errors = [{ message: '' }]

    // Act
    const result = normaliseGovukErrorMessage(errors)

    // Assert
    expect(result).toBeUndefined()
  })
})
