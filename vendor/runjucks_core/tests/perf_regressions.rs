//! Guardrails for P1 perf work: `Node::Text` (`Arc<str>`), `CtxStack` (`ahash` maps + `Arc<Value>`
//! per binding), unary `resolve_variable_ref` fast paths, literal filter shortcuts, dotted
//! attribute chains (`foo.bar.baz`), and member/index chains on plain variables without cloning the
//! whole container when possible.
//! Documented in `runjucks/ai_docs/RUNJUCKS_PERF.md` (changelog + P0 regression list).

use runjucks_core::value::value_to_string;
use runjucks_core::Environment;
use serde_json::{json, Value};
use std::sync::Arc;

#[test]
fn literal_string_upper_lower_unicode_matches_expectation() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{{ 'café' | upper }}".into(), json!({}))
            .unwrap(),
        "CAFÉ"
    );
    assert_eq!(
        env.render_string("{{ 'CAFÉ' | lower }}".into(), json!({}))
            .unwrap(),
        "café"
    );
}

#[test]
fn literal_upper_fast_path_skipped_when_custom_filter_registered() {
    let mut env = Environment::default();
    env.add_filter(
        "upper",
        Arc::new(|input, _args| Ok(Value::String(format!("custom:{}", value_to_string(input))))),
    );
    let out = env
        .render_string("{{ 'hello' | upper }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "custom:hello");
}

#[test]
fn chained_filters_on_literal_still_apply_in_order() {
    let env = Environment::default();
    let out = env
        .render_string("{{ 'aBc' | upper | lower }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "abc");
}

#[test]
fn chained_upper_lower_on_variable_matches_sequential_filters() {
    let env = Environment::default();
    let ctx = json!({ "s": "aBc" });
    assert_eq!(
        env.render_string("{{ s | upper | lower }}".into(), ctx.clone())
            .unwrap(),
        "abc"
    );
}

#[test]
fn variable_upper_then_length_counts_uppercased_string() {
    let env = Environment::default();
    let ctx = json!({ "s": "aBc" });
    assert_eq!(
        env.render_string("{{ s | upper | length }}".into(), ctx)
            .unwrap(),
        "3"
    );
}

#[test]
fn fused_filter_chain_trim_upper_variable() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{{ s | trim | upper }}".into(), json!({ "s": "  hello  " }),)
            .unwrap(),
        "HELLO"
    );
    assert_eq!(
        env.render_string("{{ s | upper | trim }}".into(), json!({ "s": "  hello  " }),)
            .unwrap(),
        "HELLO"
    );
}

#[test]
fn fused_filter_chain_trim_capitalize_variable() {
    let env = Environment::default();
    assert_eq!(
        env.render_string(
            "{{ s | trim | capitalize }}".into(),
            json!({ "s": "  hELLO  " }),
        )
        .unwrap(),
        "Hello"
    );
}

#[test]
fn capitalize_fusion_skipped_when_custom_capitalize_registered() {
    let mut env = Environment::default();
    env.add_filter(
        "capitalize",
        Arc::new(|input, _args| Ok(Value::String(format!("custom:{}", value_to_string(input))))),
    );
    let out = env
        .render_string("{{ 'ab' | capitalize }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "custom:ab");
}

#[test]
fn single_filter_capitalize_fast_path_literal_and_variable() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{{ 'heLLo' | capitalize }}".into(), json!({}))
            .unwrap(),
        "Hello"
    );
    assert_eq!(
        env.render_string("{{ s | capitalize }}".into(), json!({ "s": "heLLo" }))
            .unwrap(),
        "Hello"
    );
}

#[test]
fn fused_compare_single_step_avoids_redundant_clone_smoke() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{{ a == b }}".into(), json!({ "a": 1, "b": 1 }))
            .unwrap(),
        "true"
    );
    assert_eq!(
        env.render_string("{{ a == b }}".into(), json!({ "a": 1, "b": 2 }))
            .unwrap(),
        "false"
    );
}

#[test]
fn trim_fusion_skipped_when_custom_trim_registered() {
    let mut env = Environment::default();
    env.add_filter(
        "trim",
        Arc::new(|input, _args| Ok(Value::String(format!("custom:{}", value_to_string(input))))),
    );
    let out = env
        .render_string("{{ 'x' | trim }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "custom:x");
}

#[test]
fn is_divisibleby_borrows_variable_lhs_with_arg() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{{ v is divisibleby(2) }}".into(), json!({ "v": 8 }))
            .unwrap(),
        "true"
    );
    assert_eq!(
        env.render_string("{{ v is divisibleby(3) }}".into(), json!({ "v": 8 }))
            .unwrap(),
        "false"
    );
}

#[test]
fn get_attr_on_plain_variable_reads_one_field() {
    let env = Environment::default();
    let ctx = json!({ "user": { "name": "Ada", "noise": "ignore" } });
    let out = env.render_string("{{ user.name }}".into(), ctx).unwrap();
    assert_eq!(out, "Ada");
}

#[test]
fn nested_three_level_getattr_chain_reads_leaf() {
    let env = Environment::default();
    let ctx = json!({ "u": { "a": { "b": { "c": "leaf" } } } });
    let out = env.render_string("{{ u.a.b.c }}".into(), ctx).unwrap();
    assert_eq!(out, "leaf");
}

#[test]
fn get_item_literal_index_and_key_on_variable_base() {
    let env = Environment::default();
    let ctx = json!({
        "arr": [10, 20],
        "obj": { "k": "v" }
    });
    assert_eq!(
        env.render_string("{{ arr[1] }}".into(), ctx.clone())
            .unwrap(),
        "20"
    );
    assert_eq!(
        env.render_string("{{ obj['k'] }}".into(), ctx).unwrap(),
        "v"
    );
}

#[test]
fn slice_on_variable_base_matches_expectation() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ arr[0:2] | join(',') }}".into(),
            json!({ "arr": [1, 2, 3] }),
        )
        .unwrap();
    assert_eq!(out, "1,2");
}

#[test]
fn literal_length_builtin_on_string_and_array() {
    let env = Environment::default();
    assert_eq!(
        env.render_string("{{ 'hello' | length }}".into(), json!({}))
            .unwrap(),
        "5"
    );
    assert_eq!(
        env.render_string("{{ [1,2,3] | length }}".into(), json!({}))
            .unwrap(),
        "3"
    );
}

#[test]
fn is_test_empty_args_uses_variable_lhs() {
    let env = Environment::default();
    let ctx = json!({ "v": Value::Null });
    assert_eq!(
        env.render_string("{{ v is none }}".into(), ctx.clone())
            .unwrap(),
        "true"
    );
    assert_eq!(
        env.render_string("{{ missing is defined }}".into(), ctx)
            .unwrap(),
        "false"
    );
}

#[test]
fn variable_builtin_upper_lower_length_matches_expectation() {
    let env = Environment::default();
    let ctx = json!({
        "s": "Hello",
        "arr": [1, 2, 3],
        "obj": { "a": 1, "b": 2 }
    });
    assert_eq!(
        env.render_string("{{ s | upper }}".into(), ctx.clone())
            .unwrap(),
        "HELLO"
    );
    assert_eq!(
        env.render_string("{{ s | lower }}".into(), ctx.clone())
            .unwrap(),
        "hello"
    );
    assert_eq!(
        env.render_string("{{ s | length }}".into(), ctx.clone())
            .unwrap(),
        "5"
    );
    assert_eq!(
        env.render_string("{{ arr | length }}".into(), ctx.clone())
            .unwrap(),
        "3"
    );
    assert_eq!(
        env.render_string("{{ obj | length }}".into(), ctx).unwrap(),
        "2"
    );
}

#[test]
fn literal_length_fast_path_skipped_when_custom_filter_registered() {
    let mut env = Environment::default();
    env.add_filter(
        "length",
        Arc::new(|input, _args| Ok(Value::String(format!("custom:{}", value_to_string(input))))),
    );
    let out = env
        .render_string("{{ 'hi' | length }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "custom:hi");
}

#[test]
fn unary_not_on_missing_variable_is_true() {
    let env = Environment::default();
    let out = env
        .render_string("{{ not missing }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "true");
}

#[test]
fn unary_plus_on_string_variable_passthrough() {
    let env = Environment::default();
    let out = env
        .render_string("{{ +x }}".into(), json!({ "x": "plain" }))
        .unwrap();
    assert_eq!(out, "plain");
}

#[test]
fn unary_neg_on_string_errors() {
    let env = Environment::default();
    let err = env
        .render_string("{{ -x }}".into(), json!({ "x": "nope" }))
        .unwrap_err();
    assert!(
        err.to_string().contains("unary '-' expects"),
        "unexpected error: {err}"
    );
}

#[test]
fn nested_for_loop_objects_independent_per_inner_iteration() {
    let env = Environment::default();
    let tpl = concat!(
        "{% for a in outer %}",
        "{% for b in a %}",
        "{{ loop.index }}/{{ loop.index0 }}/{{ loop.length }}|",
        "{% endfor %}",
        "{% endfor %}",
    );
    let out = env
        .render_string(tpl.into(), json!({ "outer": [["x", "y"], ["z"]] }))
        .unwrap();
    assert_eq!(out, "1/0/2|2/1/2|1/0/1|");
}

#[test]
fn plain_text_preserves_unicode_and_empty_adjacent_segments() {
    let env = Environment::default();
    let out = env.render_string("日本語🙂".into(), json!({})).unwrap();
    assert_eq!(out, "日本語🙂");
    assert_eq!(env.render_string("".into(), json!({})).unwrap(), "");
}

#[test]
fn set_in_for_updates_existing_outer_binding() {
    // Nunjucks: `{% set %}` targets the innermost frame that already has the name; outer `x` is
    // updated from inside the loop, so the final `{{ x }}` sees the last assignment.
    let env = Environment::default();
    let tpl = concat!(
        "{% set x = 1 %}",
        "{{ x }}",
        "{% for i in [1] %}",
        "{% set x = 2 %}",
        "{{ x }}",
        "{% endfor %}",
        "{{ x }}",
    );
    let out = env.render_string(tpl.into(), json!({})).unwrap();
    assert_eq!(out, "122");
}
