//! Parser coverage for `switch`, multi-`for`, multi-`set`, block `set` / `endset`, and expression `include`.

use runjucks_core::ast::{Expr, ForVars, Node};
use runjucks_core::lexer::tokenize;
use runjucks_core::parser::parse;

fn assert_parse_ok(template: &str) {
    let tokens = tokenize(template).unwrap();
    parse(&tokens).unwrap();
}

#[test]
fn parse_switch_case_default_endswitch() {
    let tpl = r#"{% switch x %}{% case "a" %}A{% case "b" %}B{% default %}Z{% endswitch %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    assert_eq!(nodes.len(), 1);
    let Node::Switch {
        expr,
        cases,
        default_body,
    } = &nodes[0]
    else {
        panic!("expected switch");
    };
    assert!(matches!(expr, Expr::Variable(_)));
    assert_eq!(cases.len(), 2);
    assert!(default_body.is_some());
}

#[test]
fn parse_for_comma_vars_no_space() {
    let tpl = r#"{% for k,v in o %}{{ k }}{% endfor %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::For { vars, .. } = &nodes[0] else {
        panic!("expected for");
    };
    assert_eq!(vars, &ForVars::Multi(vec!["k".into(), "v".into()]));
}

#[test]
fn parse_for_three_tuple_unpack() {
    let tpl = r#"{% for a, b, c in rows %}{% endfor %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::For { vars, .. } = &nodes[0] else {
        panic!("expected for");
    };
    assert_eq!(
        vars,
        &ForVars::Multi(vec!["a".into(), "b".into(), "c".into()])
    );
}

#[test]
fn parse_set_multi_target() {
    let tpl = r#"{% set x, y = "foo" %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::Set {
        targets,
        value,
        body,
    } = &nodes[0]
    else {
        panic!("expected set");
    };
    assert_eq!(targets, &vec!["x".to_string(), "y".to_string()]);
    assert!(value.is_some());
    assert!(body.is_none());
}

#[test]
fn parse_set_block_endset() {
    let tpl = r#"{% set cap %}hi{% endset %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::Set {
        targets,
        value,
        body,
    } = &nodes[0]
    else {
        panic!("expected set");
    };
    assert_eq!(targets, &vec!["cap".to_string()]);
    assert!(value.is_none());
    assert!(body.is_some());
}

#[test]
fn parse_include_without_context() {
    let tpl = r#"{% include "x.html" without context %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::Include {
        with_context,
        ignore_missing,
        ..
    } = &nodes[0]
    else {
        panic!("expected include");
    };
    assert_eq!(with_context, &Some(false));
    assert!(!*ignore_missing);
}

#[test]
fn parse_include_variable_and_ignore_missing() {
    let tpl = r#"{% include name ignore missing %}"#;
    let tokens = tokenize(tpl).unwrap();
    let root = parse(&tokens).unwrap();
    let Node::Root(nodes) = root else {
        panic!("expected root");
    };
    let Node::Include {
        template,
        ignore_missing,
        with_context,
    } = &nodes[0]
    else {
        panic!("expected include");
    };
    assert!(matches!(template, Expr::Variable(_)));
    assert!(*ignore_missing);
    assert!(with_context.is_none());
}

#[test]
fn parse_include_expr_with_filter() {
    let tpl = r#"{% include name | default("x.njk") %}"#;
    assert_parse_ok(tpl);
}
