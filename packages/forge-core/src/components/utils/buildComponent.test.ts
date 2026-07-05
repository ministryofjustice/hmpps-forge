import { z } from 'zod'
import { buildComponent } from './buildComponent'

describe('buildComponent', () => {
  it('should expose the variant and render function when options are omitted', () => {
    // Arrange
    const render = () => '<input type="text" />'

    // Act
    const entry = buildComponent('text-input', render)

    // Assert
    expect(entry.variant).toBe('text-input')
    expect(entry.render).toBe(render)
  })

  it('should omit the inputSchema and multiple keys when options are omitted', () => {
    // Arrange
    const render = () => '<input type="text" />'

    // Act
    const entry = buildComponent('text-input', render)

    // Assert
    expect('inputSchema' in entry).toBe(false)
    expect('multiple' in entry).toBe(false)
  })

  it('should set inputSchema on the entry when provided', () => {
    // Arrange
    const inputSchema = z.string()

    // Act
    const entry = buildComponent('text-input', () => '<input />', { inputSchema })

    // Assert
    expect(entry.inputSchema).toBe(inputSchema)
    expect('multiple' in entry).toBe(false)
  })

  it('should set multiple on the entry when provided', () => {
    // Arrange
    const render = () => '<input type="checkbox" />'

    // Act
    const entry = buildComponent('checkbox', render, { multiple: true })

    // Assert
    expect(entry.multiple).toBe(true)
    expect('inputSchema' in entry).toBe(false)
  })
})
