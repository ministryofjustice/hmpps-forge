//! Regression tests for the vendored Runjucks fixes that bring govuk-frontend / MOJ Frontend macros
//! to parity with Nunjucks (`vendor/runjucks_core.patch`).

use std::collections::HashMap;

use runjucks_core::Environment;
use runjucks_core::loader::map_loader;
use serde_json::json;

fn render(template: &str, ctx: serde_json::Value) -> String {
    Environment::default().render_string(template.to_string(), ctx).unwrap()
}

/// An imported macro calls macros its own template imports (govuk/header → govukLogo →
/// govukAttributes).
#[test]
fn imported_macros_see_their_modules_imports() {
    let mut env = Environment::default();
    let files: HashMap<String, String> = [
        ("attrs.njk", "{% macro attrs(a) %}[{{ a }}]{% endmacro %}"),
        ("logo.njk", "{% from \"attrs.njk\" import attrs %}{% macro logo(p) %}<{{ attrs(p.x) }}>{% endmacro %}"),
        ("header.njk", "{% from \"logo.njk\" import logo -%}{% set c %}{{ logo({x: 1}) }}{% endset %}{{ c | safe }}"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect();
    env.loader = Some(map_loader(files));
    assert_eq!(env.render_template("header.njk", json!({})).unwrap(), "<[1]>");
}

/// `Array.prototype.join` (moj/search).
#[test]
fn arrays_join() {
    assert_eq!(render("{% set a = ['x'] %}{% set a = a.concat('y') %}{{ a.join(' ') }}|{{ [1, 2].join() }}", json!({})), "x y|1,2");
}

/// `not` binds looser than `in` / `is` / comparisons (govuk/date-input error classes).
#[test]
fn not_binds_looser_than_in() {
    assert_eq!(
        render("{{ not 'a' in 'bc' }}|{{ not 'a' in 'abc' }}|{{ not x is defined }}|{{ not 1 == 2 }}|{{ not false and true }}", json!({})),
        "true|false|true|true|true"
    );
}

/// `sameas` is reference identity: an object stays the same object through a list, a loop and a
/// macro argument, while distinct objects with equal contents differ (govuk/date-input's default
/// items).
#[test]
fn sameas_follows_references() {
    let t = "{% set d = p.day | default({name: 'day'}) %}{% set m = p.month | default({name: 'month'}) %}\
             {% set items = [d, m] %}{% macro f(x) %}{{ x is sameas(d) }}/{{ x is sameas(m) }}{% endmacro %}\
             {% for i in items %}[{{ f(i) }}]{% endfor %}";
    assert_eq!(render(t, json!({ "p": { "day": { "error": true }, "month": { "error": true } } })), "[true/false][false/true]");
    assert_eq!(render(t, json!({ "p": {} })), "[true/false][false/true]");
    assert_eq!(
        render("{{ {a: 1} is sameas({a: 1}) }}|{% set o = {a: 1} %}{% set q = o %}{{ q is sameas(o) }}|{{ o is sameas(o) }}", json!({})),
        "false|true|true"
    );
}

/// Blocks nested in other blocks take part in inheritance, as Nunjucks registers every block in a
/// template: a layout can override and `super()` into GOV.UK's `govukFooter`, which sits inside
/// `footer`, and a child's nested blocks override as well.
#[test]
fn nested_blocks_inherit() {
    let mut env = Environment::default();
    let files: HashMap<String, String> = [
        ("base.njk", "{% block footer %}<f>{% block inner %}BASE{% endblock %}</f>{% endblock %}"),
        ("layout.njk", "{%- extends \"base.njk\" -%}{% block inner %}{% block widget %}W{% endblock %}{{ super() }}+L{% endblock %}"),
        ("page.njk", "{%- extends \"layout.njk\" -%}{% block widget %}P{% endblock %}"),
        ("own.njk", "{%- extends \"layout.njk\" -%}{% block footer %}{% block inner %}{{ super() }}!{% endblock %}{% endblock %}"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect();
    env.loader = Some(map_loader(files));
    assert_eq!(env.render_template("layout.njk", json!({})).unwrap(), "<f>WBASE+L</f>");
    assert_eq!(env.render_template("page.njk", json!({})).unwrap(), "<f>PBASE+L</f>");
    assert_eq!(env.render_template("own.njk", json!({})).unwrap(), "WBASE+L!");
}
