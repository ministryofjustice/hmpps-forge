import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import { runInNewContext } from 'node:vm'
import nunjucks from 'nunjucks'
import BrowserPrecompiledLoader from './BrowserPrecompiledLoader'

describe('BrowserPrecompiledLoader', () => {
  let templates: Record<string, object>
  let environment: nunjucks.Environment

  beforeEach(() => {
    templates = {}
    environment = new nunjucks.Environment(new BrowserPrecompiledLoader(templates))

    Object.entries({
      'app/page.njk':
        '{% extends "./layouts/base.njk" %}{% block body %}{% include "./parts/greeting.njk" %}{% endblock %}',
      'app/layouts/base.njk': '<main>{% block body %}{% endblock %}</main>',
      'app/parts/greeting.njk': '{% from "../macros/text.njk" import greet %}{{ greet(name) }}',
      'app/macros/text.njk': '{% macro greet(name) %}Hello {{ name }}{% endmacro %}',
      'app/missing.njk': '{% include "./absent.njk" %}',
      'app/input.njk': '{% from "govuk/components/input/macro.njk" import govukInput %}{{ govukInput(params) }}',
    }).forEach(([name, source]) => {
      runInNewContext(nunjucks.precompileString(source, { name }), { window: { nunjucksPrecompiled: templates } })
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('resolve()', () => {
    it('should render relative imports when the automatically added loader is removed', () => {
      // Arrange
      vi.stubGlobal('window', { nunjucksPrecompiled: templates })

      const loader = new BrowserPrecompiledLoader(templates)
      const browserEnvironment: nunjucks.Environment & { loaders?: nunjucks.Loader[] } = new nunjucks.Environment(
        loader,
      )

      expect(browserEnvironment.loaders).toHaveLength(2)

      // Act
      browserEnvironment.loaders = [loader]

      const html = browserEnvironment.render('app/page.njk', { name: 'Ada' })

      // Assert
      expect(browserEnvironment.loaders).toEqual([loader])
      expect(html).toBe('<main>Hello Ada</main>')
    })

    it('should render nested templates when includes, imports and inheritance use relative names', () => {
      // Arrange
      const context = { name: 'Ada <Lovelace>' }

      // Act
      const html = environment.render('app/page.njk', context)

      // Assert
      expect(html).toBe('<main>Hello Ada &lt;Lovelace&gt;</main>')
    })

    it('should render GOV.UK components when their templates import sibling components and shared macros', () => {
      // Arrange
      const require = createRequire(import.meta.url)
      const govukDirectory = dirname(require.resolve('govuk-frontend/package.json'))
      const compiled = nunjucks.precompile(`${govukDirectory}/dist`, { include: ['\\.njk$'] })
      const params = {
        id: 'name',
        name: 'name',
        value: 'Ada <Lovelace>',
        label: { text: 'Your name' },
        hint: { text: 'As on your passport' },
        errorMessage: { text: 'Enter your name' },
      }

      runInNewContext(compiled, { window: { nunjucksPrecompiled: templates } })

      // Act
      const html = environment.render('app/input.njk', { params })

      // Assert
      expect(html).toContain('govuk-input--error')
      expect(html).toContain('Your name')
      expect(html).toContain('As on your passport')
      expect(html).toContain('Enter your name')
      expect(html).toContain('value="Ada &lt;Lovelace&gt;"')
      expect(html).toContain('aria-describedby="name-hint name-error"')
    })

    it('should reuse templates with fresh context when rendering again', () => {
      // Arrange
      const template = environment.getTemplate('app/page.njk')

      environment.render('app/page.njk', { name: 'Ada' })

      // Act
      const html = environment.render('app/page.njk', { name: 'Grace' })

      // Assert
      expect(html).toBe('<main>Hello Grace</main>')
      expect(environment.getTemplate('app/page.njk')).toBe(template)
    })

    it('should report the resolved name when an included template is missing', () => {
      // Arrange
      const name = 'app/missing.njk'

      // Act
      const render = () => environment.render(name)

      // Assert
      expect(render).toThrow('template not found: app/absent.njk')
    })

    it('should use the next loader when the first registry has no matching template', () => {
      // Arrange
      const fallbackEnvironment = new nunjucks.Environment([
        new BrowserPrecompiledLoader({}),
        new BrowserPrecompiledLoader(templates),
      ])

      // Act
      const html = fallbackEnvironment.render('app/page.njk', { name: 'Ada' })

      // Assert
      expect(html).toBe('<main>Hello Ada</main>')
    })
  })
})
