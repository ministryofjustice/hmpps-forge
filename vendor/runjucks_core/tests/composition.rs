//! Template composition: `include`, `extends` / `block`, macros.

use runjucks_core::ast::{Expr, Node};
use runjucks_core::lexer::tokenize;
use runjucks_core::loader::map_loader;
use runjucks_core::parser::parse;
use runjucks_core::Environment;
use serde_json::json;
use std::collections::HashMap;

fn env_with_map(templates: HashMap<String, String>) -> Environment {
    let mut env = Environment::default();
    env.loader = Some(map_loader(templates));
    env
}

#[test]
fn include_renders_subtemplate() {
    let mut m = HashMap::new();
    m.insert("part.html".into(), "Hello {{ name }}".into());
    m.insert("main.html".into(), r#"{% include "part.html" %}!"#.into());
    let env = env_with_map(m);
    let out = env
        .render_template("main.html", json!({ "name": "Ada" }))
        .unwrap();
    assert_eq!(out, "Hello Ada!");
}

#[test]
fn include_without_context_sees_only_globals() {
    let mut m = HashMap::new();
    m.insert("inner.html".into(), r#"{{ x | default("inner") }}"#.into());
    m.insert(
        "main.html".into(),
        r#"{% set x = "outer" %}{% include "inner.html" without context %}"#.into(),
    );
    let env = env_with_map(m);
    let out = env.render_template("main.html", json!({})).unwrap();
    assert_eq!(out, "inner");
}

#[test]
fn include_with_context_matches_default_include_scope() {
    let mut m = HashMap::new();
    m.insert("inner.html".into(), r#"{{ x | default("inner") }}"#.into());
    m.insert(
        "main.html".into(),
        r#"{% set x = "outer" %}{% include "inner.html" with context %}"#.into(),
    );
    let env = env_with_map(m);
    let out = env.render_template("main.html", json!({})).unwrap();
    assert_eq!(out, "outer");
}

#[test]
fn include_with_context_does_not_leak_set_to_parent_scope() {
    let mut m = HashMap::new();
    m.insert(
        "a.njk".into(),
        r#"{% set v = "inner" %}{% include "b.njk" %}"#.into(),
    );
    m.insert("b.njk".into(), "{{ v }}".into());
    m.insert(
        "main.njk".into(),
        r#"{% set v = "root" %}{% include "a.njk" %}|{{ v }}"#.into(),
    );
    let env = env_with_map(m);
    let out = env.render_template("main.njk", json!({})).unwrap();
    assert_eq!(out, "inner|root");
}

#[test]
fn include_cycle_errors() {
    let mut m = HashMap::new();
    m.insert("a.html".into(), r#"{% include "b.html" %}"#.into());
    m.insert("b.html".into(), r#"{% include "a.html" %}"#.into());
    let env = env_with_map(m);
    let err = env.render_template("a.html", json!({})).unwrap_err();
    assert!(err.to_string().contains("circular"));
}

#[test]
fn extends_block_override() {
    let mut m = HashMap::new();
    m.insert(
        "base.html".into(),
        r#"<!doctype><title>{% block title %}T{% endblock %}</title><body>{% block body %}{% endblock %}</body>"#
            .into(),
    );
    m.insert(
        "child.html".into(),
        r#"{% extends "base.html" %}{% block title %}Hi{% endblock %}{% block body %}B{% endblock %}"#
            .into(),
    );
    let env = env_with_map(m);
    let out = env.render_template("child.html", json!({})).unwrap();
    assert_eq!(out, "<!doctype><title>Hi</title><body>B</body>");
}

#[test]
fn extends_dynamic_parent_from_context() {
    let mut m = HashMap::new();
    m.insert(
        "base.html".into(),
        r#"{% block body %}BASE{% endblock %}"#.into(),
    );
    m.insert(
        "child.html".into(),
        r#"{% extends layout %}{% block body %}CHILD{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_with_map(m);
    let out = env
        .render_template("child.html", json!({ "layout": "base.html" }))
        .unwrap();
    assert_eq!(out, "CHILDBASE");
}

#[test]
fn extends_dynamic_concat_template_name() {
    let mut m = HashMap::new();
    m.insert("main.html".into(), r#"{% block x %}M{% endblock %}"#.into());
    m.insert(
        "child.html".into(),
        r#"{% extends prefix ~ ".html" %}{% block x %}C{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_with_map(m);
    let out = env
        .render_template("child.html", json!({ "prefix": "main" }))
        .unwrap();
    assert_eq!(out, "CM");
}

#[test]
fn extends_dynamic_parent_cycle_errors_at_render_time() {
    let mut m = HashMap::new();
    m.insert(
        "a.html".into(),
        r#"{% extends parent %}{% block body %}A{{ super() }}{% endblock %}"#.into(),
    );
    m.insert(
        "b.html".into(),
        r#"{% extends "a.html" %}{% block body %}B{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_with_map(m);
    let err = env
        .render_template("a.html", json!({ "parent": "b.html" }))
        .unwrap_err();
    assert!(err.to_string().contains("circular"));
}

#[test]
fn extends_literal_only_cycle_errors_before_render() {
    let mut m = HashMap::new();
    m.insert(
        "a.html".into(),
        r#"{% extends "b.html" %}{% block x %}A{% endblock %}"#.into(),
    );
    m.insert(
        "b.html".into(),
        r#"{% extends "a.html" %}{% block x %}B{% endblock %}"#.into(),
    );
    let env = env_with_map(m);
    let err = env.render_template("a.html", json!({})).unwrap_err();
    assert!(err.to_string().contains("circular"));
}

#[test]
fn extends_three_level_second_extends_still_literal() {
    let mut m = HashMap::new();
    m.insert("g.html".into(), r#"{% block b %}G{% endblock %}"#.into());
    m.insert(
        "p.html".into(),
        r#"{% extends "g.html" %}{% block b %}P{{ super() }}{% endblock %}"#.into(),
    );
    m.insert(
        "c.html".into(),
        r#"{% extends parent %}{% block b %}C{{ super() }}{% endblock %}"#.into(),
    );
    let env = env_with_map(m);
    let out = env
        .render_template("c.html", json!({ "parent": "p.html" }))
        .unwrap();
    assert_eq!(out, "CPG");
}

#[test]
fn parse_extends_stores_expression_not_only_string_literal() {
    let t = tokenize(r#"{% extends layout %}"#).unwrap();
    let root = parse(&t).unwrap();
    let Node::Root(ch) = root else {
        panic!("expected root");
    };
    let Node::Extends { parent } = &ch[0] else {
        panic!("expected extends");
    };
    assert!(matches!(parent, Expr::Variable(name) if name == "layout"));
}

#[test]
fn macro_call_in_output() {
    let env = Environment::default();
    let out = env
        .render_string(
            r#"{% macro greet(n) %}Hello {{ n }}{% endmacro %}{{ greet("x") }}"#.into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "Hello x");
}

#[test]
fn render_string_with_loader_include() {
    let mut env = Environment::default();
    let mut m = HashMap::new();
    m.insert("x.html".into(), "ok".into());
    env.loader = Some(map_loader(m));
    let out = env
        .render_string(r#"{% include "x.html" %}!"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "ok!");
}

#[test]
fn no_loader_include_errors() {
    let env = Environment::default();
    let err = env
        .render_string(r#"{% include "x.html" %}"#.into(), json!({}))
        .unwrap_err();
    assert!(err.to_string().contains("include"));
}
