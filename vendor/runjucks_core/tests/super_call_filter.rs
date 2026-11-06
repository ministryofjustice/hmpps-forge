//! `{{ super() }}`, `{% call %}` / `caller()`, `{% filter %}`.

use runjucks_core::lexer::tokenize;
use runjucks_core::loader::map_loader;
use runjucks_core::parser::parse;
use runjucks_core::Environment;
use serde_json::json;
use std::collections::HashMap;

fn env_map(templates: HashMap<String, String>) -> Environment {
    let mut env = Environment::default();
    env.loader = Some(map_loader(templates));
    env
}

#[test]
fn super_two_level_prefix_order() {
    let mut m = HashMap::new();
    m.insert("base.html".into(), r#"{% block b %}P{% endblock %}"#.into());
    m.insert(
        "child.html".into(),
        r#"{% extends "base.html" %}{% block b %}C{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_map(m);
    let out = env.render_template("child.html", json!({})).unwrap();
    assert_eq!(out, "CP");
}

#[test]
fn super_three_level() {
    let mut m = HashMap::new();
    m.insert("g.html".into(), r#"{% block b %}G{% endblock %}"#.into());
    m.insert(
        "p.html".into(),
        r#"{% extends "g.html" %}{% block b %}P{{ super() }}{% endblock %}"#.into(),
    );
    m.insert(
        "c.html".into(),
        r#"{% extends "p.html" %}{% block b %}C{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_map(m);
    let out = env.render_template("c.html", json!({})).unwrap();
    assert_eq!(out, "CPG");
}

#[test]
fn super_child_only_super() {
    let mut m = HashMap::new();
    m.insert("base.html".into(), r#"{% block b %}P{% endblock %}"#.into());
    m.insert(
        "child.html".into(),
        r#"{% extends "base.html" %}{% block b %}{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_map(m);
    let out = env.render_template("child.html", json!({})).unwrap();
    assert_eq!(out, "P");
}

#[test]
fn super_output_is_not_autoescaped() {
    let mut m = HashMap::new();
    m.insert(
        "base3.njk".into(),
        r#"{% block block1 %}<b>Foo</b>{% endblock %}"#.into(),
    );
    m.insert(
        "child.njk".into(),
        r#"{% extends "base3.njk" %}{% block block1 %}{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_map(m);
    let out = env.render_template("child.njk", json!({})).unwrap();
    assert_eq!(out, "<b>Foo</b>");
}

#[test]
fn super_outside_block_errors() {
    let env = Environment::default();
    let err = env
        .render_string(
            r#"{% block b %}x{% endblock %}{{ super() }}"#.into(),
            json!({}),
        )
        .unwrap_err();
    assert!(err.to_string().contains("super()"));
}

#[test]
fn super_twice_repeats_parent_layer() {
    let mut m = HashMap::new();
    m.insert("base.html".into(), r#"{% block b %}P{% endblock %}"#.into());
    m.insert(
        "child.html".into(),
        r#"{% extends "base.html" %}{% block b %}{{ super() }}{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_map(m);
    let out = env.render_template("child.html", json!({})).unwrap();
    assert_eq!(out, "PP");
}

#[test]
fn super_errors_when_no_parent_block_in_chain() {
    let mut m = HashMap::new();
    m.insert(
        "base.html".into(),
        r#"{% block b %}X{{ super() }}{% endblock %}"#.into(),
    );
    m.insert("child.html".into(), r#"{% extends "base.html" %}"#.into());
    let env = env_map(m);
    let err = env.render_template("child.html", json!({})).unwrap_err();
    assert!(err.to_string().to_lowercase().contains("super"));
}

#[test]
fn filter_upper_block() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{% filter upper %}a{% endfilter %}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "A");
}

#[test]
fn filter_replace_with_args() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% filter replace("foo", "bar") %}foofoo{% endfilter %}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "barbar");
}

#[test]
fn filter_nested_in_if() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% if true %}{% filter upper %}x{% endfilter %}{% endif %}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "X");
}

#[test]
fn filter_empty_body() {
    let env = Environment::default();
    let out = env
        .render_string(r#"{% filter upper %}{% endfilter %}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "");
}

#[test]
fn call_wrap_with_caller() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro wrap() %}<div>{{ caller() }}</div>{% endmacro %}{% call wrap() %}hi{% endcall %}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "<div>hi</div>");
}

#[test]
fn caller_output_is_not_autoescaped() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro wrap() %}<div>{{ caller() }}</div>{% endmacro %}{% call wrap() %}<b>x</b>{% endcall %}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "<div><b>x</b></div>");
}

#[test]
fn call_caller_invoked_twice() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro w() %}{{ caller() }}|{{ caller() }}{% endmacro %}{% call w() %}z{% endcall %}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "z|z");
}

/// Matches Nunjucks `compiler.js` caller-args test: `{% call(item) list([...]) %}` with no space before `(`.
#[test]
fn call_caller_passes_args_to_body() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro list(items) %}<ul>{% for i in items %}<li>{{ caller(i) }}</li>{% endfor %}</ul>{% endmacro %}{% call(item) list(["a","b"]) %}{{ item }}{% endcall %}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "<ul><li>a</li><li>b</li></ul>");
}

#[test]
fn call_caller_no_args_when_no_signature_errors() {
    let env = Environment::default();
    let err = env
        .render_string(
            r#"{% macro wrap() %}<div>{{ caller(1) }}</div>{% endmacro %}{% call wrap() %}in{% endcall %}"#
                .into(),
            json!({}),
        )
        .unwrap_err();
    assert!(err.to_string().contains("caller()"));
}

#[test]
fn call_namespaced_macro() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% macro wrap() %}<b>{{ caller() }}</b>{% endmacro %}"#.into(),
    );
    let mut env = Environment::default();
    env.loader = Some(map_loader(m));
    let out = env
        .render_string(
            r#"{% import "lib.html" as L %}{% call L.wrap() %}in{% endcall %}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "<b>in</b>");
}

#[test]
fn caller_outside_call_errors() {
    let env = Environment::default();
    let err = env
        .render_string(
            r#"{% macro m() %}{{ caller() }}{% endmacro %}{{ m() }}"#.into(),
            json!({}),
        )
        .unwrap_err();
    assert!(err.to_string().contains("caller()"));
}

#[test]
fn composition_extends_super_filter_call() {
    let mut m = HashMap::new();
    m.insert(
        "base.html".into(),
        r#"{% block main %}base{% endblock %}"#.into(),
    );
    m.insert(
        "child.html".into(),
        r#"{% extends "base.html" %}
{% block main %}{% filter upper %}c{% endfilter %}{{ super() }}{% endblock %}"#
            .into(),
    );
    let env = env_map(m);
    let out = env.render_template("child.html", json!({})).unwrap();
    assert_eq!(out, "Cbase");
}

#[test]
fn macro_output_is_not_autoescaped_twice() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro foo(x, y) %}{{ x }} and {{ y }}{% endmacro %}{{ foo("<>&", "<>") }}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "&lt;&gt;&amp; and &lt;&gt;");
}

#[test]
fn macro_safe_filter_preserves_safe_output() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro foo(x, y) %}{{ x|safe }} and {{ y }}{% endmacro %}{{ foo("<>&", "<>") }}"#
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "<>& and &lt;&gt;");
}

#[test]
fn parse_orphan_endfilter_errors() {
    let t = tokenize("{% endfilter %}").unwrap();
    let err = parse(&t).unwrap_err();
    assert!(err.to_string().contains("endfilter"));
}

#[test]
fn parse_orphan_endcall_errors() {
    let t = tokenize("{% endcall %}").unwrap();
    let err = parse(&t).unwrap_err();
    assert!(err.to_string().contains("endcall"));
}
