use runjucks_core::Environment;
use serde_json::json;

#[test]
fn double_braces_substitute_top_level_identifier() {
    let env = Environment::default();
    let out = env
        .render_string("{{ x }}".to_string(), json!({ "x": "y" }))
        .unwrap();
    assert_eq!(out, "y");
}

#[test]
fn double_braces_allow_whitespace_inside_delimiters() {
    let env = Environment::default();
    let out = env
        .render_string("{{  name  }}".to_string(), json!({ "name": "Ada" }))
        .unwrap();
    assert_eq!(out, "Ada");
}

#[test]
fn interpolation_between_literal_text() {
    let env = Environment::default();
    let out = env
        .render_string("Hello, {{ name }}!".to_string(), json!({ "name": "world" }))
        .unwrap();
    assert_eq!(out, "Hello, world!");
}

#[test]
fn multiple_interpolations_in_one_template() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ a }} and {{ b }}".to_string(),
            json!({ "a": "first", "b": "second" }),
        )
        .unwrap();
    assert_eq!(out, "first and second");
}

#[test]
fn missing_variable_renders_empty_string() {
    let env = Environment::default();
    let out = env
        .render_string("{{ nowhere }}".to_string(), json!({}))
        .unwrap();
    assert_eq!(out, "");
}

#[test]
fn autoescape_applies_to_interpolated_strings_by_default() {
    let env = Environment::default();
    assert!(env.autoescape);
    let out = env
        .render_string("{{ x }}".to_string(), json!({ "x": "<b>hi</b>" }))
        .unwrap();
    assert_eq!(out, "&lt;b&gt;hi&lt;/b&gt;");
}
