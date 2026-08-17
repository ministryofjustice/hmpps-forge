import { BlankLineNode, BlockNode, CodeNode, CodeNodeKind, CommentNode, LineNode, TryCatchNode } from './codeNode.type'
import SourceRenderer, { GeneratedCodeStyle, compilePositionMarker } from './SourceRenderer'

const line = (text: string): LineNode => ({ kind: CodeNodeKind.LINE, text })
const blank: BlankLineNode = { kind: CodeNodeKind.BLANK_LINE }
const comment = (text: string): CommentNode => ({ kind: CodeNodeKind.COMMENT, text })
const block = (open: string | undefined, close: string | undefined, body: CodeNode[]): BlockNode => ({
  kind: CodeNodeKind.BLOCK,
  open,
  close,
  body,
})
const tryCatch = (tryBody: CodeNode[], errorName: string, catchBody: CodeNode[]): TryCatchNode => ({
  kind: CodeNodeKind.TRY_CATCH,
  tryBody,
  errorName,
  catchBody,
})

const MARKER = compilePositionMarker({ file: '/app/journeys/steps.ts', line: 12, column: 5 })

describe('SourceRenderer', () => {
  describe('render()', () => {
    it('should indent nested blocks by depth when rendering readable source', () => {
      // Arrange
      const renderer = new SourceRenderer()
      const nodes = [block('if (condition) {', '}', [line('first();'), block('{', '}', [line('second();')])])]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['if (condition) {', '  first();', '  {', '    second();', '  }', '}'].join('\n'))
    })

    it('should indent the body of an open-less block when rendering an indentation region', () => {
      // Arrange
      const renderer = new SourceRenderer()
      const nodes = [line('for (;;) {'), block(undefined, undefined, [line('body();')]), line('}')]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['for (;;) {', '  body();', '}'].join('\n'))
    })

    it('should cuddle the catch join line when rendering a try-catch node', () => {
      // Arrange
      const renderer = new SourceRenderer()
      const nodes = [tryCatch([line('risky();')], 'error', [line('throw wrap(error);')])]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['try {', '  risky();', '} catch (error) {', '  throw wrap(error);', '}'].join('\n'))
    })

    it('should strip markers and record segments at indent-aware columns', () => {
      // Arrange
      const renderer = new SourceRenderer()
      const nodes = [block('{', '}', [line(`value = ${MARKER}evaluate();`)])]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['{', '  value = evaluate();', '}'].join('\n'))
      expect(rendered.segmentsByLine[1]).toEqual([
        { generatedColumn: '  value = '.length, position: { file: '/app/journeys/steps.ts', line: 12, column: 5 } },
      ])
    })

    it('should nudge adjacent markers right so chain frames keep distinct columns', () => {
      // Arrange
      const renderer = new SourceRenderer()
      const helperMarker = compilePositionMarker({ file: '/app/helpers.ts', line: 3, column: 1 })
      const nodes = [line(`${helperMarker}${MARKER}evaluate();`)]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe('evaluate();')
      expect(rendered.segmentsByLine[0].map(segment => segment.generatedColumn)).toEqual([0, 1])
    })

    it('should strip an unparseable marker without recording a segment', () => {
      // Arrange
      const renderer = new SourceRenderer()
      const nodes = [line('value = /*@forge-pos:{"broken"}*/evaluate();')]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe('value = evaluate();')
      expect(rendered.segmentsByLine[0]).toEqual([])
    })

    it('should keep markers in the output when preserveMarkers is set', () => {
      // Arrange
      const renderer = new SourceRenderer({ preserveMarkers: true })
      const nodes = [block('{', '}', [line(`value = ${MARKER}evaluate();`)])]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['{', `  value = ${MARKER}evaluate();`, '}'].join('\n'))
      expect(rendered.segmentsByLine.every(segments => segments.length === 0)).toBe(true)
    })

    it('should keep blank lines and comments when rendering readable source', () => {
      // Arrange
      const renderer = new SourceRenderer({ style: GeneratedCodeStyle.READABLE })
      const nodes = [comment('// --- compileBlock ---'), blank, line('run();')]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['// --- compileBlock ---', '', 'run();'].join('\n'))
    })

    it('should drop blanks, comments, and indentation when rendering compact source', () => {
      // Arrange
      const renderer = new SourceRenderer({ style: GeneratedCodeStyle.COMPACT })
      const nodes = [
        comment('// --- compileBlock ---'),
        blank,
        block('if (condition) {', '}', [line(`value = ${MARKER}evaluate();`)]),
      ]

      // Act
      const rendered = renderer.render(nodes)

      // Assert
      expect(rendered.source).toBe(['if (condition) {', 'value = evaluate();', '}'].join('\n'))
      expect(rendered.segmentsByLine[1]).toEqual([
        { generatedColumn: 'value = '.length, position: { file: '/app/journeys/steps.ts', line: 12, column: 5 } },
      ])
    })
  })

  describe('compilePositionMarker()', () => {
    it('should emit no marker when the file path contains a comment terminator', () => {
      // Act
      const marker = compilePositionMarker({ file: '/tmp/evil*/path.ts', line: 1, column: 1 })

      // Assert
      expect(marker).toBe('')
    })
  })
})
