//! `{% import %}` / `{% from %}` macro loading (Nunjucks-style).

use runjucks_core::lexer::tokenize;
use runjucks_core::lexer::Tags;
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

fn custom_angle_tags() -> Tags {
    Tags {
        block_start: "<%".into(),
        block_end: "%>".into(),
        variable_start: "<$".into(),
        variable_end: "$>".into(),
        comment_start: "<#".into(),
        comment_end: "#>".into(),
    }
}

#[test]
fn import_as_namespace_calls_macro() {
    let mut m = HashMap::new();
    m.insert(
        "macros.html".into(),
        r#"{% macro greet(who) %}Hi {{ who }}{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import "macros.html" as m %}{{ m.greet("Ada") }}"#.into(),
    );
    let env = env_with_map(m);
    let out = env.render_template("main.html", json!({})).unwrap();
    assert_eq!(out, "Hi Ada");
}

#[test]
fn import_without_context_modifier_parses_and_renders() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% macro x() %}X{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib without context %}{{ lib.x() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "X");
}

#[test]
fn from_import_named_macro() {
    let mut m = HashMap::new();
    m.insert(
        "macros.html".into(),
        r#"{% macro a() %}A{% endmacro %}{% macro b() %}B{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% from "macros.html" import a %}{{ a() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "A");
}

#[test]
fn from_import_rename() {
    let mut m = HashMap::new();
    m.insert(
        "macros.html".into(),
        r#"{% macro inner() %}ok{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% from "macros.html" import inner as outer %}{{ outer() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "ok");
}

#[test]
fn from_import_comma_list() {
    let mut m = HashMap::new();
    m.insert(
        "macros.html".into(),
        r#"{% macro p() %}P{% endmacro %}{% macro q() %}Q{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% from "macros.html" import p, q %}{{ p() }}{{ q() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "PQ");
}

#[test]
fn from_import_missing_macro_errors() {
    let mut m = HashMap::new();
    m.insert(
        "macros.html".into(),
        r#"{% macro only() %}x{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% from "macros.html" import only, missing %}"#.into(),
    );
    let env = env_with_map(m);
    let msg = env
        .render_template("main.html", json!({}))
        .unwrap_err()
        .to_string();
    assert!(
        msg.contains("cannot import") && msg.contains("missing"),
        "{msg}"
    );
}

#[test]
fn import_cycle_errors() {
    let mut m = HashMap::new();
    m.insert("a.html".into(), r#"{% import "b.html" as b %}"#.into());
    m.insert("b.html".into(), r#"{% import "a.html" as a %}"#.into());
    let env = env_with_map(m);
    let msg = env
        .render_template("a.html", json!({}))
        .unwrap_err()
        .to_string();
    assert!(msg.contains("circular"), "{msg}");
}

#[test]
fn import_cycle_errors_with_custom_tags() {
    let mut m = HashMap::new();
    m.insert("a.html".into(), r#"<% import "b.html" as b %>"#.into());
    m.insert("b.html".into(), r#"<% import "a.html" as a %>"#.into());
    let mut env = env_with_map(m);
    env.tags = Some(custom_angle_tags());
    let msg = env
        .render_template("a.html", json!({}))
        .unwrap_err()
        .to_string();
    assert!(msg.contains("circular"), "{msg}");
}

#[test]
fn import_requires_loader_at_render() {
    let env = Environment::default();
    let err = env
        .render_string(r#"{% import "x.html" as m %}"#.into(), json!({}))
        .unwrap_err();
    assert!(err.to_string().contains("import"));
}

#[test]
fn parse_import_without_running() {
    let tokens = tokenize(r#"{% import "m.html" as lib %}"#).unwrap();
    let root = parse(&tokens).unwrap();
    assert!(format!("{root:?}").contains("Import"));
}

#[test]
fn empty_imported_macros_namespace_call_errors() {
    let mut m = HashMap::new();
    m.insert("empty.html".into(), "".into());
    m.insert(
        "main.html".into(),
        r#"{% import "empty.html" as e %}{{ e.nope() }}"#.into(),
    );
    let env = env_with_map(m);
    let msg = env
        .render_template("main.html", json!({}))
        .unwrap_err()
        .to_string();
    assert!(msg.contains("macro") || msg.contains("only"), "{msg}");
}

#[test]
fn dynamic_import_template_name_from_context() {
    let mut m = HashMap::new();
    m.insert(
        "macros.html".into(),
        r#"{% macro id() %}ok{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import name as m %}{{ m.id() }}"#.into(),
    );
    let env = env_with_map(m);
    let out = env
        .render_template("main.html", json!({ "name": "macros.html" }))
        .unwrap();
    assert_eq!(out, "ok");
}

#[test]
fn from_rejects_leading_underscore_name() {
    let tokens = tokenize(r#"{% from "x.html" import _hidden %}"#).unwrap();
    let err = parse(&tokens).unwrap_err();
    assert!(err.to_string().contains("underscore"));
}

#[test]
fn import_exports_top_level_set() {
    let mut m = HashMap::new();
    m.insert("lib.html".into(), r#"{% set exported = 42 %}"#.into());
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib %}{{ lib.exported }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "42");
}

#[test]
fn import_exports_multi_target_top_level_set() {
    let mut m = HashMap::new();
    m.insert("lib.html".into(), r#"{% set a, b = "ok" %}"#.into());
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib %}{{ lib.a }}-{{ lib.b }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(
        env.render_template("main.html", json!({})).unwrap(),
        "ok-ok"
    );
}

#[test]
fn import_exports_block_set_endset() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% set cap %}a{{ 1 }}b{% endset %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib %}[{{ lib.cap }}]"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(
        env.render_template("main.html", json!({})).unwrap(),
        "[a1b]"
    );
}

#[test]
fn import_chained_top_level_sets_see_prior_export() {
    let mut m = HashMap::new();
    m.insert(
        "lib.njk".into(),
        r#"{% set first = 1 %}{% set second = first %}"#.into(),
    );
    m.insert(
        "main.njk".into(),
        r#"{% import "lib.njk" as lib %}{{ lib.second }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.njk", json!({})).unwrap(), "1");
}

#[test]
fn from_import_multi_target_and_block_exports() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        concat!(r#"{% set x, y = 7 %}"#, r#"{% set blk %}Z{% endset %}"#,).into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% from "lib.html" import x, y, blk %}{{ x }}{{ y }}{{ blk }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "77Z");
}

#[test]
fn import_with_context_macro_sees_parent_binding() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% set x = ctxval %}{% macro m() %}{{ x }}{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib with context %}{{ lib.m() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(
        env.render_template("main.html", json!({ "ctxval": 42 }))
            .unwrap(),
        "42"
    );
}

#[test]
fn import_without_context_macro_does_not_see_parent_binding() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% set x = ctxval %}{% macro m() %}{{ x }}{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib %}{{ lib.m() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(
        env.render_template("main.html", json!({ "ctxval": 42 }))
            .unwrap(),
        ""
    );
}

#[test]
fn from_import_top_level_set_and_macro() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% set v = 99 %}{% macro m() %}M{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% from "lib.html" import v, m %}{{ v }}{{ m() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(env.render_template("main.html", json!({})).unwrap(), "99M");
}

#[test]
fn import_with_context_modifier_parses_like_without_for_macros_only() {
    let mut m = HashMap::new();
    m.insert(
        "lib.html".into(),
        r#"{% macro x() %}X{% endmacro %}"#.into(),
    );
    m.insert(
        "main.html".into(),
        r#"{% import "lib.html" as lib with context %}{{ lib.x() }}"#.into(),
    );
    let env = env_with_map(m);
    assert_eq!(
        env.render_template("main.html", json!({ "foo": 1 }))
            .unwrap(),
        "X"
    );
}
