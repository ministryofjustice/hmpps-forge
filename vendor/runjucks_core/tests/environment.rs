use runjucks_core::value::value_to_string;
use runjucks_core::Environment;
use serde_json::{json, Value};
use std::sync::Arc;

#[test]
fn plain_text_round_trip() {
    let out = Environment::default()
        .render_string("hello".to_string(), json!({}))
        .unwrap();
    assert_eq!(out, "hello");
}

#[test]
fn render_string_empty_template() {
    let env = Environment::default();
    assert_eq!(env.render_string(String::new(), json!({})).unwrap(), "");
}

#[test]
fn render_string_multiline_plain_text() {
    let env = Environment::default();
    let tpl = "line1\n\nline3".to_string();
    assert_eq!(env.render_string(tpl.clone(), json!({})).unwrap(), tpl);
}

#[test]
fn render_string_comment_only_produces_empty_output() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{# only #}".to_string(), json!({}))
            .unwrap(),
        ""
    );
}

#[test]
fn render_string_strips_comments() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("a {# x #} b".to_string(), json!({}))
            .unwrap(),
        "a  b"
    );
}

#[test]
fn default_environment_renders_plain_text() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("Hello, world.".to_string(), json!({}))
            .unwrap(),
        "Hello, world."
    );
}

#[test]
fn render_string_accepts_nested_context() {
    let env = Environment::default();
    let ctx = json!({ "outer": { "inner": 7 } });
    let out = env.render_string("static".to_string(), ctx).unwrap();
    assert_eq!(out, "static");
}

#[test]
fn custom_filter_overrides_builtin_upper() {
    let mut env = Environment::default();
    env.add_filter(
        "upper",
        Arc::new(|input, _args| Ok(Value::String(format!("x{}", value_to_string(input))))),
    );
    let out = env
        .render_string("{{ x | upper }}".into(), json!({ "x": "a" }))
        .unwrap();
    assert_eq!(out, "xa");
}

#[test]
fn custom_filter_with_extra_args() {
    let mut env = Environment::default();
    env.add_filter(
        "twice",
        Arc::new(|input, args| {
            let sep = args.first().map(value_to_string).unwrap_or_default();
            let s = value_to_string(input);
            Ok(Value::String(format!("{s}{sep}{s}")))
        }),
    );
    let out = env
        .render_string(r#"{{ "a" | twice("-") }}"#.into(), json!({}))
        .unwrap();
    assert_eq!(out, "a-a");
}

#[test]
fn unknown_is_test_yields_error() {
    let env = Environment::default();
    let err = env
        .render_string("{{ 1 is not_a_builtin_test }}".into(), json!({}))
        .unwrap_err();
    assert!(
        err.to_string().contains("unknown test"),
        "expected unknown test error, got {}",
        err
    );
}

#[test]
fn throw_on_undefined_errors_for_missing_name() {
    let mut env = Environment::default();
    env.throw_on_undefined = true;
    let err = env
        .render_string("{{ missing }}".into(), json!({}))
        .unwrap_err();
    assert!(
        err.to_string().contains("undefined variable"),
        "expected undefined variable error, got {}",
        err
    );
}

#[test]
fn throw_on_undefined_allows_globals() {
    let mut env = Environment::default();
    env.throw_on_undefined = true;
    env.add_global("g", json!(7));
    let out = env.render_string("{{ g }}".into(), json!({})).unwrap();
    assert_eq!(out, "7");
}

#[test]
fn add_test_registers_is_expression() {
    let mut env = Environment::default();
    env.add_test(
        "positive",
        Arc::new(|value, _| {
            let n = value
                .as_f64()
                .or_else(|| value.as_i64().map(|i| i as f64))
                .ok_or_else(|| {
                    runjucks_core::RunjucksError::new("`positive` test expects a number")
                })?;
            Ok(n > 0.0)
        }),
    );
    let out = env
        .render_string(
            "{{ 3 is positive }} — {{ -1 is positive }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "true — false");
}
