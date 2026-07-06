import { z } from 'zod'
import { buildNunjucksComponent } from './buildNunjucksComponent'

describe('buildNunjucksComponent', () => {
  it('should expose the variant and a render function when options are omitted', () => {
    // Act
    const entry = buildNunjucksComponent('text-input', () => '<input type="text" />')

    // Assert
    expect(entry.variant).toBe('text-input')
    expect(typeof entry.render).toBe('function')
  })

  it('should omit the inputSchema and multiple keys when options are omitted', () => {
    // Act
    const entry = buildNunjucksComponent('text-input', () => '<input type="text" />')

    // Assert
    expect('inputSchema' in entry).toBe(false)
    expect('multiple' in entry).toBe(false)
  })

  it('should set inputSchema on the entry when provided', () => {
    // Arrange
    const inputSchema = z.string()

    // Act
    const entry = buildNunjucksComponent('text-input', () => '<input />', { inputSchema })

    // Assert
    expect(entry.inputSchema).toBe(inputSchema)
    expect('multiple' in entry).toBe(false)
  })

  it('should set multiple on the entry when provided', () => {
    // Act
    const entry = buildNunjucksComponent('checkbox', () => '<input type="checkbox" />', { multiple: true })

    // Assert
    expect(entry.multiple).toBe(true)
    expect('inputSchema' in entry).toBe(false)
  })
})
