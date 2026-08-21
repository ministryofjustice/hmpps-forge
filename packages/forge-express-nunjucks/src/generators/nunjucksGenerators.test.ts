import { assertTemplateIsAllowed, NunjucksGenerators, nunjucksFunctions } from './nunjucksGenerators'

describe('nunjucksGenerators', () => {
  const evaluate = NunjucksGenerators.String.factory({})

  it('should export the generator entries for explicit package listings', () => {
    // Act
    const functions = nunjucksFunctions

    // Assert
    expect(functions).toEqual([NunjucksGenerators.String])
  })

  describe('String evaluator', () => {
    it('should render a plain template', () => {
      // Arrange / Act
      const result = evaluate({ template: '<p>Hello world</p>' })

      // Assert
      expect(result).toBe('<p>Hello world</p>')
    })

    it('should interpolate values from data', () => {
      // Arrange / Act
      const result = evaluate({ template: '<p>Hello {{ name }}</p>', data: { name: 'Ada' } })

      // Assert
      expect(result).toBe('<p>Hello Ada</p>')
    })

    it('should autoescape HTML in values', () => {
      // Arrange / Act
      const result = evaluate({
        template: '<p>{{ message }}</p>',
        data: { message: '<script>alert("xss")</script>' },
      })

      // Assert
      expect(result).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>')
    })

    it('should allow raw HTML via the safe filter', () => {
      // Arrange / Act
      const result = evaluate({
        template: '<p>{{ trusted | safe }}</p>',
        data: { trusted: '<strong>bold</strong>' },
      })

      // Assert
      expect(result).toBe('<p><strong>bold</strong></p>')
    })

    it('should handle if blocks', () => {
      // Arrange / Act
      const shown = evaluate({ template: '{% if flag %}yes{% endif %}', data: { flag: true } })
      const hidden = evaluate({ template: '{% if flag %}yes{% endif %}', data: { flag: false } })

      // Assert
      expect(shown).toBe('yes')
      expect(hidden).toBe('')
    })

    it('should handle for loops', () => {
      // Arrange / Act
      const result = evaluate({
        template: '{% for x in items %}{{ x }},{% endfor %}',
        data: { items: ['a', 'b', 'c'] },
      })

      // Assert
      expect(result).toBe('a,b,c,')
    })

    it('should default to empty data when omitted', () => {
      // Arrange / Act
      const result = evaluate({ template: '{{ missing }}' })

      // Assert
      expect(result).toBe('')
    })

    it('should treat undefined keys as falsy without throwing', () => {
      // Arrange / Act
      const result = evaluate({ template: '{% if x %}shown{% else %}hidden{% endif %}', data: {} })

      // Assert
      expect(result).toBe('hidden')
    })

    it('should return the same result when rendering a cached template with new data', () => {
      // Arrange: the same template string is cached after first render.
      const template = '<p>{{ value }}</p>'

      // Act: render the cached template twice with different data.
      const first = evaluate({ template, data: { value: 'one' } })
      const second = evaluate({ template, data: { value: 'two' } })

      // Assert: each render uses fresh data even though the compiled template is reused.
      expect(first).toBe('<p>one</p>')
      expect(second).toBe('<p>two</p>')
    })

    it('should render the address-composition template', () => {
      // Arrange
      const template = '{{ line1 }}<br>{% if line2 %}{{ line2 }}<br>{% endif %}{{ town }}<br>{{ postcode }}'

      // Act
      const withoutLine2 = evaluate({
        template,
        data: { line1: '10 Downing Street', line2: '', town: 'London', postcode: 'SW1A 2AA' },
      })

      const withLine2 = evaluate({
        template,
        data: { line1: '221B Baker Street', line2: 'Marylebone', town: 'London', postcode: 'NW1 6XE' },
      })

      // Assert
      expect(withoutLine2).toBe('10 Downing Street<br>London<br>SW1A 2AA')
      expect(withLine2).toBe('221B Baker Street<br>Marylebone<br>London<br>NW1 6XE')
    })
  })

  describe('assertTemplateIsAllowed()', () => {
    it.each([
      ['{% import "macros.njk" as m %}', 'import'],
      ['{% from "macros.njk" import link %}', 'from'],
      ['{% include "partial.njk" %}', 'include'],
      ['{% extends "layout.njk" %}', 'extends'],
      ['{% macro link(href, text) %}<a>{{ text }}</a>{% endmacro %}', 'macro'],
    ])('should reject %s', (template, tag) => {
      // Arrange / Act / Assert
      expect(() => assertTemplateIsAllowed(template)).toThrow(new RegExp(`\\{% ${tag} %\\}`))
    })

    it('should reject whitespace-trimmed forbidden tags', () => {
      // Arrange / Act / Assert
      expect(() => assertTemplateIsAllowed('{%-include "x.njk" -%}')).toThrow(/include/)
    })

    it('should allow templates that only use interpolation and filters', () => {
      // Arrange / Act / Assert
      expect(() => assertTemplateIsAllowed('<p>{{ name | upper }}</p>')).not.toThrow()
    })

    it('should allow {% if %}, {% for %}, and {% set %}', () => {
      // Arrange
      const template = `
        {% set full = first + ' ' + last %}
        {% if full %}<p>{{ full }}</p>{% endif %}
        {% for tag in tags %}<span>{{ tag }}</span>{% endfor %}
      `

      // Act / Assert
      expect(() => assertTemplateIsAllowed(template)).not.toThrow()
    })

    it('should not false-positive on identifiers that start with a forbidden name', () => {
      // Arrange / Act / Assert
      expect(() => assertTemplateIsAllowed('{% if importantThing %}yes{% endif %}')).not.toThrow()
      expect(() => assertTemplateIsAllowed('{% set includes = [] %}')).not.toThrow()
    })

    it('should reject at render time when a forbidden tag slips past the prepare hook', () => {
      // Act / Assert: calling the generator evaluator directly still catches it on cache miss.
      expect(() => evaluate({ template: '{% include "x.njk" %}' })).toThrow(/include/)
    })
  })

  describe('NunjucksGenerators.String()', () => {
    it('should return a generator builder for allowed templates', () => {
      // Arrange / Act
      const expr = NunjucksGenerators.String({
        template: '<p>Hello {{ name }}</p>',
        data: { name: 'Ada' },
      })

      // Assert: returns a chainable generator builder, not a string.
      expect(expr).toBeDefined()
      expect(typeof expr).toBe('object')
    })

    it('should reject forbidden tags at author-call time via the prepare hook', () => {
      // Arrange / Act / Assert
      expect(() =>
        NunjucksGenerators.String({
          template: '{% include "external.njk" %}',
        }),
      ).toThrow(/include/)
    })
  })
})
