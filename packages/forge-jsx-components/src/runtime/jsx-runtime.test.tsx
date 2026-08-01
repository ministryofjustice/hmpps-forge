import { Fragment, RawHtml, jsx, jsxs, raw } from './jsx-runtime'

describe('jsx-runtime', () => {
  describe('element rendering', () => {
    it('should render an element with attributes and children when written as JSX', () => {
      // Arrange & Act
      const element = <div class="card" id="main">Hello</div>

      // Assert
      expect(String(element)).toBe('<div class="card" id="main">Hello</div>')
    })

    it('should render nested elements without double-escaping when elements contain elements', () => {
      // Arrange & Act
      const element = (
        <section>
          <h2>Title</h2>
          <p>Body</p>
        </section>
      )

      // Assert
      expect(String(element)).toBe('<section><h2>Title</h2><p>Body</p></section>')
    })

    it('should render a void element without a closing tag when the tag is void', () => {
      // Arrange & Act
      const element = <input type="text" name="email" />

      // Assert
      expect(String(element)).toBe('<input type="text" name="email">')
    })

    it('should render a function component when the tag is capitalised', () => {
      // Arrange
      const Badge = (props: { text: string }) => <strong class="badge">{props.text}</strong>

      // Act
      const element = <Badge text="New" />

      // Assert
      expect(String(element)).toBe('<strong class="badge">New</strong>')
    })

    it('should render fragment children without a wrapper when using fragment syntax', () => {
      // Arrange & Act
      const element = (
        <>
          <dt>Name</dt>
          <dd>Value</dd>
        </>
      )

      // Assert
      expect(String(element)).toBe('<dt>Name</dt><dd>Value</dd>')
    })
  })

  describe('escaping', () => {
    it('should escape HTML entities in text children when the child is a string', () => {
      // Arrange
      const userInput = '<script>alert("xss")</script>'

      // Act
      const element = <p>{userInput}</p>

      // Assert
      expect(String(element)).toBe('<p>&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;</p>')
    })

    it('should escape attribute values when the value could break out of its quotes', () => {
      // Arrange
      const attackValue = '" onload="alert(1)'

      // Act
      const element = <div title={attackValue} />

      // Assert
      expect(String(element)).toBe('<div title="&quot; onload=&quot;alert(1)"></div>')
    })

    it('should escape attribute names when attributes are spread from untrusted records', () => {
      // Arrange
      const attributes: Record<string, string> = { '"><script>': 'x' }

      // Act
      const element = <div {...attributes} />

      // Assert
      expect(String(element)).toBe('<div &quot;&gt;&lt;script&gt;="x"></div>')
    })

    it('should embed content verbatim when wrapped in raw()', () => {
      // Arrange
      const renderedChildBlock = '<p class="govuk-body">Already rendered</p>'

      // Act
      const element = <div class="card__body">{raw(renderedChildBlock)}</div>

      // Assert
      expect(String(element)).toBe('<div class="card__body"><p class="govuk-body">Already rendered</p></div>')
    })
  })

  describe('attribute handling', () => {
    it('should omit attributes when their value is undefined, null or false', () => {
      // Arrange & Act
      const element = <input type="text" disabled={false} placeholder={undefined} />

      // Assert
      expect(String(element)).toBe('<input type="text">')
    })

    it('should render a bare attribute when the value is true', () => {
      // Arrange & Act
      const element = <input type="checkbox" checked={true} />

      // Assert
      expect(String(element)).toBe('<input type="checkbox" checked>')
    })

    it('should render spread attributes when props come from a record', () => {
      // Arrange
      const attributes = { 'data-module': 'card', 'aria-label': 'Main card' }

      // Act
      const element = <div {...attributes} />

      // Assert
      expect(String(element)).toBe('<div data-module="card" aria-label="Main card"></div>')
    })
  })

  describe('children handling', () => {
    it('should render nothing when a child is null, undefined or boolean', () => {
      // Arrange
      const showHint = false

      // Act
      const element = (
        <div>
          {null}
          {undefined}
          {showHint && <p>Hint</p>}
        </div>
      )

      // Assert
      expect(String(element)).toBe('<div></div>')
    })

    it('should flatten array children when children come from map()', () => {
      // Arrange
      const items = ['One', 'Two']

      // Act
      const element = (
        <ul>
          {items.map(item => (
            <li>{item}</li>
          ))}
        </ul>
      )

      // Assert
      expect(String(element)).toBe('<ul><li>One</li><li>Two</li></ul>')
    })

    it('should stringify number children when the child is a number', () => {
      // Arrange & Act
      const element = <span>{42}</span>

      // Assert
      expect(String(element)).toBe('<span>42</span>')
    })
  })

  describe('RawHtml', () => {
    it('should expose the html both as a property and via toString()', () => {
      // Arrange & Act
      const rawHtml = raw('<hr>')

      // Assert
      expect(rawHtml).toBeInstanceOf(RawHtml)
      expect(rawHtml.html).toBe('<hr>')
      expect(String(rawHtml)).toBe('<hr>')
    })

    it('should be recognised across module copies when the brand symbol matches', () => {
      // Arrange - simulate a second bundled copy of the runtime producing its own object
      const foreignRawHtml = { [Symbol.for('forge.jsx.rawHtml')]: true, html: '<hr>' }

      // Act
      const element = jsx('div', { children: foreignRawHtml as unknown as RawHtml })

      // Assert
      expect(String(element)).toBe('<div><hr></div>')
    })
  })

  describe('transform entry points', () => {
    it('should share one implementation when the transform calls jsxs for static children', () => {
      // Arrange & Act & Assert
      expect(jsxs).toBe(jsx)
    })

    it('should serialize children without a wrapper when Fragment is called directly', () => {
      // Arrange & Act
      const fragment = Fragment({ children: [raw('<hr>'), 'text'] })

      // Assert
      expect(String(fragment)).toBe('<hr>text')
    })
  })
})
