//! Globals (`range`, `cycler`, `joiner`), context shadowing, and `is callable`.

use runjucks_core::globals::RJ_CALLABLE;
use runjucks_core::{CustomGlobalFn, Environment};
use serde_json::json;
use std::sync::Arc;

#[test]
fn range_one_two_three_args() {
    let env = Environment::default();
    let out = env
        .render_string("{{ range(3)|join('-') }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "0-1-2");
    let out = env
        .render_string("{{ range(2,5)|join('') }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "234");
    let out = env
        .render_string("{{ range(3,0,-1)|join('') }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "321");
}

#[test]
fn context_shadows_global_range_lookup() {
    let env = Environment::default();
    let out = env
        .render_string("{{ range }}".into(), json!({ "range": "shadow" }))
        .unwrap();
    assert_eq!(out, "shadow");
}

#[test]
fn cycler_wraps_and_joiner_alternates() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% set c = cycler(1,2,3) %}{{ c.next() }}{{ c.next() }}{{ c.next() }}{{ c.next() }}"
                .into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "1231");
    let out = env
        .render_string(
            "{% set j = joiner(' | ') %}{{ j() }}x{{ j() }}y{{ j() }}z".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "x | y | z");
}

#[test]
fn cycler_handle_object_is_not_callable() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% set c = cycler('x') %}{{ c is callable }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "false");
}

#[test]
fn add_global_chains() {
    let mut env = Environment::default();
    env.add_global("a", json!(1)).add_global("b", json!(2));
    let out = env
        .render_string("{{ a }} {{ b }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "1 2");
}

#[test]
fn user_global_callable_marker_is_callable() {
    let mut env = Environment::default();
    let mut m = serde_json::Map::new();
    m.insert(RJ_CALLABLE.to_string(), json!(true));
    env.add_global("cb", json!(m));
    let out = env
        .render_string("{{ cb is callable }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "true");
}

#[test]
fn plain_string_is_not_callable() {
    let env = Environment::default();
    let out = env
        .render_string("{{ s is callable }}".into(), json!({ "s": "hi" }))
        .unwrap();
    assert_eq!(out, "false");
}

#[test]
fn add_global_callable_invoked_from_template() {
    let mut env = Environment::default();
    let sum: CustomGlobalFn = Arc::new(|args, kwargs| {
        assert!(kwargs.is_empty());
        let a = args.first().and_then(|v| v.as_i64()).unwrap_or(0);
        let b = args.get(1).and_then(|v| v.as_i64()).unwrap_or(0);
        Ok(json!(a + b))
    });
    env.add_global_callable("sum", sum);
    let out = env
        .render_string("{{ sum(40, 2) }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "42");
    let out = env
        .render_string("{{ sum is callable }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "true");
    let out = env.render_string("{{ sum }}".into(), json!({})).unwrap();
    assert_eq!(out, "");
}

#[test]
fn add_global_callable_receives_keyword_args() {
    let mut env = Environment::default();
    let f: CustomGlobalFn = Arc::new(|args, kwargs| {
        let mut acc: i64 = args.iter().filter_map(|v| v.as_i64()).sum();
        for (_, v) in kwargs {
            acc += v.as_i64().unwrap_or(0);
        }
        Ok(json!(acc))
    });
    env.add_global_callable("g", f);
    let out = env
        .render_string("{{ g(1, 2, y=100) }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "103");
}

#[test]
fn add_global_json_clears_callable() {
    let mut env = Environment::default();
    env.add_global_callable("dup", Arc::new(|_, _| Ok(json!("should not appear"))));
    env.add_global("dup", json!(7));
    let out = env.render_string("{{ dup }}".into(), json!({})).unwrap();
    assert_eq!(out, "7");
}
