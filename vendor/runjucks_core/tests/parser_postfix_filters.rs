//! Postfix access, aggregates, and filter pipelines (`parse_expr` / full template).

use runjucks_core::ast::{Expr, Node};
use runjucks_core::environment::Environment;
use runjucks_core::lexer::tokenize;
use runjucks_core::parser::{parse, parse_expr};
use serde_json::json;

#[test]
fn dot_access_parses() {
    let e = parse_expr("user.name").unwrap();
    assert!(matches!(
        e,
        Expr::GetAttr {
            ref base,
            ref attr
        } if **base == Expr::Variable("user".into()) && attr == "name"
    ));
}

#[test]
fn bracket_subscript_parses() {
    let e = parse_expr("items[0]").unwrap();
    assert!(matches!(
        e,
        Expr::GetItem {
            ref base,
            ..
        } if **base == Expr::Variable("items".into())
    ));
}

#[test]
fn chained_dot_and_index() {
    let e = parse_expr("a.b[1].c").unwrap();
    assert!(matches!(e, Expr::GetAttr { .. }));
}

#[test]
fn empty_list_literal() {
    let e = parse_expr("[]").unwrap();
    assert_eq!(e, Expr::List(vec![]));
}

#[test]
fn list_literal_two_elements() {
    let e = parse_expr("[1, 2]").unwrap();
    assert!(matches!(e, Expr::List(ref v) if v.len() == 2));
}

#[test]
fn dict_literal() {
    let e = parse_expr("{\"a\": 1}").unwrap();
    assert!(matches!(e, Expr::Dict(_)));
}

#[test]
fn filter_upper_no_args() {
    let e = parse_expr("\"ab\" | upper").unwrap();
    assert!(matches!(
        e,
        Expr::Filter {
            ref name,
            ref args,
            ..
        } if name == "upper" && args.is_empty()
    ));
}

#[test]
fn filter_join_with_arg() {
    let e = parse_expr("[\"a\", \"b\"] | join(\",\")").unwrap();
    assert!(matches!(e, Expr::Filter { ref name, .. } if name == "join"));
}

#[test]
fn filter_chain_right_associative_nesting() {
    let e = parse_expr("1 | abs | upper").unwrap();
    assert!(matches!(e, Expr::Filter { ref name, .. } if name == "upper"));
}

#[test]
fn neg_three_filter_abs_template() {
    let env = Environment::default();
    let out = env.render_string("{{ -3|abs }}".into(), json!({})).unwrap();
    assert_eq!(out, "3");
}

#[test]
fn dot_lookup_render() {
    let env = Environment::default();
    let out = env
        .render_string("{{ u.n }}".into(), json!({"u": {"n": "ok"}}))
        .unwrap();
    assert_eq!(out, "ok");
}

#[test]
fn index_array_render() {
    let env = Environment::default();
    let out = env
        .render_string("{{ items[1] }}".into(), json!({"items": [10, 20]}))
        .unwrap();
    assert_eq!(out, "20");
}

#[test]
fn equalto_is_test() {
    let env = Environment::default();
    let out = env
        .render_string("{{ 1 is equalto(2) }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "false");
}

#[test]
fn sameas_distinct_empty_objects() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ obj1 is sameas(obj2) }}".into(),
            json!({"obj1": {}, "obj2": {}}),
        )
        .unwrap();
    assert_eq!(out, "false");
}

#[test]
fn if_else_endif_render() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% if x %}yes{% else %}no{% endif %}".into(),
            json!({"x": true}),
        )
        .unwrap();
    assert_eq!(out, "yes");
}

#[test]
fn for_loop_render() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% for i in nums %}{{ i }}{% endfor %}".into(),
            json!({"nums": [1, 2, 3]}),
        )
        .unwrap();
    assert_eq!(out, "123");
}

#[test]
fn set_tag_updates_context() {
    let env = Environment::default();
    let out = env
        .render_string("{% set x = 2 %}{{ x }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "2");
}

#[test]
fn elif_chain() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{% if false %}a{% elif true %}b{% else %}c{% endif %}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "b");
}

#[test]
fn parse_nested_if_in_template() {
    let tokens = tokenize("{% if a %}{% if b %}x{% endif %}{% endif %}").unwrap();
    let ast = parse(&tokens).unwrap();
    assert!(matches!(ast, Node::Root(ref n) if n.len() == 1));
}

#[test]
fn filter_replace_roundtrip() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ \"foofoo\" | replace(\"foo\", \"bar\") }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "barbar");
}

#[test]
fn unary_not_then_filter() {
    let e = parse_expr("not true | upper").unwrap();
    assert!(matches!(e, Expr::Filter { .. }));
}

#[test]
fn list_in_membership_render() {
    let env = Environment::default();
    let out = env
        .render_string("{{ 1 in [1, 2] }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "true");
}

#[test]
fn default_filter_null() {
    let env = Environment::default();
    let out = env
        .render_string("{{ missing | default(\"z\") }}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "z");
}
