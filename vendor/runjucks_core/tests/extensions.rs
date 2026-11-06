//! Custom tag extensions ([`Environment::register_extension`]) — parity with Nunjucks `addExtension`
//! (declarative tags + `process` callback; not Nunjucks’ JS `parse()` API).

use runjucks_core::Environment;
use runjucks_core::loader::map_loader;
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;

fn echo_handler() -> runjucks_core::extension::CustomExtensionHandler {
    Arc::new(|_ctx, args, body| {
        Ok(format!(
            "[{}]{}",
            args.trim(),
            body.as_deref().unwrap_or("")
        ))
    })
}

#[test]
fn simple_extension_tag_renders_output() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension("myext", vec![("echo".into(), None)], echo_handler())
        .unwrap();
    let out = env
        .render_string("{% echo hello %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "[hello]");
}

#[test]
fn extension_tag_passes_raw_args_string() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "e",
        vec![("echo".into(), None)],
        Arc::new(|_ctx, args, _body| Ok(format!("|{args}|"))),
    )
    .unwrap();
    let out = env
        .render_string("{% echo  a  b  c  %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "|a  b  c|");
}

#[test]
fn extension_receives_flattened_context() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "e",
        vec![("ctxdump".into(), None)],
        Arc::new(|ctx, _args, _body| {
            let x = ctx.get("x").and_then(|v| v.as_i64()).unwrap_or(-1);
            Ok(format!("x={x}"))
        }),
    )
    .unwrap();
    let out = env
        .render_string("{% ctxdump %}".into(), json!({ "x": 42 }))
        .unwrap();
    assert_eq!(out, "x=42");
}

#[test]
fn extension_context_cache_does_not_cross_include_scopes() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "e",
        vec![("ctxx".into(), None)],
        Arc::new(|ctx, _args, _body| {
            let x = ctx.get("x").and_then(|v| v.as_str()).unwrap_or("missing");
            Ok(x.to_string())
        }),
    )
    .unwrap();
    let mut templates = HashMap::new();
    templates.insert(
        "main.njk".to_string(),
        "{% set x = 'A' %}{% include 'inc.njk' %}{% set x = 'B' %}{% include 'inc.njk' %}".into(),
    );
    templates.insert("inc.njk".to_string(), "{% ctxx %}".into());
    env.loader = Some(map_loader(templates));
    let out = env.render_template("main.njk", json!({})).unwrap();
    assert_eq!(out, "AB");
}

#[test]
fn block_extension_receives_rendered_body() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "wrap",
        vec![("wrap".into(), Some("endwrap".into()))],
        Arc::new(|_ctx, args, body| {
            Ok(format!(
                "<{}>{}</{}>",
                args.trim(),
                body.unwrap_or_default(),
                args.trim()
            ))
        }),
    )
    .unwrap();
    let out = env
        .render_string(
            "{% wrap box %}{{ name }}{% endwrap %}".into(),
            json!({ "name": "n" }),
        )
        .unwrap();
    assert_eq!(out, "<box>n</box>");
}

#[test]
fn block_body_interpolates_nested_extension() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension("a", vec![("a".into(), None)], echo_handler())
        .unwrap();
    env.register_extension(
        "w",
        vec![("wrap".into(), Some("endwrap".into()))],
        Arc::new(|_ctx, _args, body| Ok(format!("[{}]", body.unwrap_or_default()))),
    )
    .unwrap();
    let out = env
        .render_string("{% wrap %}{% a inner %}{% endwrap %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "[[inner]]");
}

#[test]
fn multiple_opening_tags_same_extension() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "m",
        vec![("one".into(), None), ("two".into(), None)],
        Arc::new(|_ctx, args, _body| Ok(args.to_string())),
    )
    .unwrap();
    let out = env
        .render_string("{% one A %}{% two B %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "AB");
}

#[test]
fn register_extension_replaces_prior_tags_for_same_name() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "e",
        vec![("echo".into(), None)],
        Arc::new(|_, _, _| Ok("first".into())),
    )
    .unwrap();
    env.register_extension(
        "e",
        vec![("echo".into(), None)],
        Arc::new(|_, _, _| Ok("second".into())),
    )
    .unwrap();
    let out = env.render_string("{% echo %}".into(), json!({})).unwrap();
    assert_eq!(out, "second");
}

#[test]
fn empty_tag_list_errors() {
    let mut env = Environment::default();
    let err = env
        .register_extension("e", vec![], echo_handler())
        .unwrap_err();
    assert!(err.to_string().contains("at least one tag"), "{}", err);
}

#[test]
fn duplicate_tag_in_single_registration_errors() {
    let mut env = Environment::default();
    let err = env
        .register_extension(
            "e",
            vec![("echo".into(), None), ("echo".into(), None)],
            echo_handler(),
        )
        .unwrap_err();
    assert!(
        err.to_string().contains("duplicate extension tag"),
        "{}",
        err
    );
}

#[test]
fn reserved_builtin_tag_name_errors() {
    let mut env = Environment::default();
    let err = env
        .register_extension("e", vec![("if".into(), None)], echo_handler())
        .unwrap_err();
    assert!(err.to_string().contains("built-in tag"), "{}", err);
}

#[test]
fn reserved_end_tag_name_errors() {
    let mut env = Environment::default();
    let err = env
        .register_extension(
            "w",
            vec![("wrap".into(), Some("if".into()))],
            echo_handler(),
        )
        .unwrap_err();
    assert!(err.to_string().contains("built-in tag"), "{}", err);
}

#[test]
fn conflicting_tag_between_two_extensions_errors() {
    let mut env = Environment::default();
    env.register_extension("a", vec![("echo".into(), None)], echo_handler())
        .unwrap();
    let err = env
        .register_extension("b", vec![("echo".into(), None)], echo_handler())
        .unwrap_err();
    assert!(err.to_string().contains("already registered"), "{}", err);
}

#[test]
fn orphan_end_tag_errors() {
    let mut env = Environment::default();
    env.register_extension(
        "w",
        vec![("wrap".into(), Some("endwrap".into()))],
        echo_handler(),
    )
    .unwrap();
    let err = env
        .render_string("{% endwrap %}".into(), json!({}))
        .unwrap_err();
    assert!(
        err.to_string().contains("without matching opening"),
        "{}",
        err
    );
}

#[test]
fn validate_lex_parse_accepts_registered_extension() {
    let mut env = Environment::default();
    env.register_extension("e", vec![("echo".into(), None)], echo_handler())
        .unwrap();
    env.validate_lex_parse("{% echo x %}").unwrap();
}

#[test]
fn validate_lex_parse_rejects_unknown_tag_when_not_registered() {
    let env = Environment::default();
    let err = env.validate_lex_parse("{% not_registered %}").unwrap_err();
    assert!(
        err.to_string().contains("unsupported tag keyword"),
        "{}",
        err
    );
}

#[test]
fn extension_output_is_autoescaped_when_enabled() {
    let mut env = Environment::default();
    env.autoescape = true;
    env.register_extension(
        "e",
        vec![("unsafe".into(), None)],
        Arc::new(|_, _, _| Ok("<b>x</b>".into())),
    )
    .unwrap();
    let out = env.render_string("{% unsafe %}".into(), json!({})).unwrap();
    assert_eq!(out, "&lt;b&gt;x&lt;/b&gt;");
}

#[test]
fn extension_inside_if_branch() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension(
        "e",
        vec![("mark".into(), None)],
        Arc::new(|_, args, _| Ok(format!("[{args}]"))),
    )
    .unwrap();
    let out = env
        .render_string("{% if true %}{% mark ok %}{% endif %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "[ok]");
}

#[test]
fn has_extension_and_remove_extension() {
    let mut env = Environment::default();
    assert!(!env.has_extension("myext"));
    env.register_extension("myext", vec![("echo".into(), None)], echo_handler())
        .unwrap();
    assert!(env.has_extension("myext"));
    assert!(env.remove_extension("myext"));
    assert!(!env.has_extension("myext"));
    assert!(!env.remove_extension("myext"));
}
