use runjucks_core::ast::{Expr, Node};
use runjucks_core::environment::Environment;
use runjucks_core::renderer::{render, CtxStack};
use serde_json::json;

#[test]
fn render_nested_root_flattens_text() {
    let env = Environment::default();
    let inner = Node::Root(vec![Node::Text("a".into()), Node::Text("b".into())]);
    let root = Node::Root(vec![inner]);
    let mut stack = CtxStack::from_root(json!({}).as_object().unwrap().clone());
    let out = render(&env, None, &root, &mut stack).unwrap();
    assert_eq!(out, "ab");
}

#[test]
fn render_output_literal() {
    let env = Environment::default();
    let root = Node::Root(vec![Node::Output(vec![Expr::Literal(json!("hi"))])]);
    let mut stack = CtxStack::from_root(json!({}).as_object().unwrap().clone());
    let out = render(&env, None, &root, &mut stack).unwrap();
    assert_eq!(out, "hi");
}

#[test]
fn render_output_variable_missing_is_empty() {
    let env = Environment::default();
    let root = Node::Root(vec![Node::Output(vec![Expr::Variable("missing".into())])]);
    let mut stack = CtxStack::from_root(json!({}).as_object().unwrap().clone());
    let out = render(&env, None, &root, &mut stack).unwrap();
    assert_eq!(out, "");
}

#[test]
fn render_output_variable_present() {
    let env = Environment::default();
    let root = Node::Root(vec![Node::Output(vec![Expr::Variable("name".into())])]);
    let mut stack = CtxStack::from_root(json!({ "name": "Ada" }).as_object().unwrap().clone());
    let out = render(&env, None, &root, &mut stack).unwrap();
    assert_eq!(out, "Ada");
}

#[test]
fn render_variable_autoescapes_html_when_enabled() {
    let mut env = Environment::default();
    env.autoescape = true;
    let root = Node::Root(vec![Node::Output(vec![Expr::Variable("x".into())])]);
    let mut stack = CtxStack::from_root(json!({ "x": "<script>" }).as_object().unwrap().clone());
    let out = render(&env, None, &root, &mut stack).unwrap();
    assert_eq!(out, "&lt;script&gt;");
}

#[test]
fn render_variable_no_escape_when_autoescape_off() {
    let mut env = Environment::default();
    env.autoescape = false;
    let root = Node::Root(vec![Node::Output(vec![Expr::Variable("x".into())])]);
    let mut stack = CtxStack::from_root(json!({ "x": "<b>" }).as_object().unwrap().clone());
    let out = render(&env, None, &root, &mut stack).unwrap();
    assert_eq!(out, "<b>");
}
