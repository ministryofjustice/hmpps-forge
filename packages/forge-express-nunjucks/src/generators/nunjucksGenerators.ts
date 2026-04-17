import nunjucks from 'nunjucks'
import {
  createFunctionsRegistry,
  defineGeneratorFunctions,
  GeneratorFunctionExpr,
} from '@ministryofjustice/hmpps-forge/core/authoring'

/**
 * Throws if the template uses any forbidden tags. Wired into the generator's
 * `validate` hook so errors surface at journey-definition time, before any
 * request is served.
 *
 * Tags that reach outside the template (loader-driven) or define reusable
 * fragments are rejected. NunjucksGenerators.String is meant for inline
 * display composition, not for second-class authoring. Anything more
 * structural belongs in a custom generator or component.
 */
export const assertTemplateIsAllowed = (template: string): void => {
  const FORBIDDEN_TAGS = ['import', 'from', 'include', 'extends', 'macro'] as const
  const FORBIDDEN_TAG_PATTERN = new RegExp(String.raw`\{%-?\s*(${FORBIDDEN_TAGS.join('|')})\b`)
  const match = FORBIDDEN_TAG_PATTERN.exec(template)

  if (!match) {
    return
  }

  throw new Error(
    `NunjucksGenerators.String templates cannot use {% ${match[1]} %}. ` +
      `Allowed constructs are {% if %}, {% for %}, {% set %}, filters, and ` +
      `variable interpolation. For reusable composition, extract a custom generator or component.`,
  )
}

// Shared environment used by the String generator. The user's application-
// level nunjucks env is intentionally not reused - these templates must always
// render with autoescape on, regardless of whatever the app has configured for
// page rendering.
const safeEnvironment = new nunjucks.Environment(null, {
  autoescape: true,
  throwOnUndefined: false,
})

/**
 * env.renderString() recompiles the source on every call, which is wasteful
 * when authors declare a template at journey-definition time and render it
 * per-request. Compile once per source string and reuse the Template instance
 * across renders.
 */
const templateCache = new Map<string, nunjucks.Template>()

/**
 * Shape for the Nunjucks-backed generator.
 */
export interface NunjucksGeneratorShape {
  /**
   * Render a Nunjucks template to a ConditionalString expression.
   *
   * Values interpolated via `{{ name }}` are HTML-escaped automatically. Use
   * `{{ name | safe }}` when the value is trusted HTML. Forge evaluates
   * expressions inside `data` before the template runs, so the template sees
   * resolved primitives only.
   *
   * Templates are intentionally restricted to inline display composition:
   * `{% import %}`, `{% from %}`, `{% include %}`, `{% extends %}`, and
   * `{% macro %}` are rejected at author-call time. If you need reusable
   * composition logic, extract a custom generator or component instead.
   *
   * @param props.template - Nunjucks template source.
   * @param props.data - Values available to the template (defaults to an empty object).
   */
  String: (props: { template: string; data?: Record<string, unknown> }) => GeneratorFunctionExpr
}

/**
 * Authoring-facing namespace for the Nunjucks generators this package provides.
 */
export const { generators: NunjucksGenerators, implementations: nunjucksGeneratorImplementations } =
  defineGeneratorFunctions<NunjucksGeneratorShape>({
    String: {
      validate: props => assertTemplateIsAllowed(props.template),
      factory: () => props => {
        let compiled = templateCache.get(props.template)

        if (!compiled) {
          assertTemplateIsAllowed(props.template)
          compiled = new nunjucks.Template(props.template, safeEnvironment, undefined, true)
          templateCache.set(props.template, compiled)
        }

        return compiled.render(props.data ?? {})
      },
    },
  })

/**
 * Pre-built registry entry ready to pass to `forge.registerGlobalFunctions()`.
 *
 * @example
 * forge.registerGlobalFunctions(nunjucksFunctions)
 */
export const nunjucksFunctions = createFunctionsRegistry(nunjucksGeneratorImplementations)
