//! Parser edge cases and Nunjucks `tests/parser.js`-inspired cases (expression subset).

use runjucks_core::ast::{BinOp, CompareOp, Expr, Node, UnaryOp};
use runjucks_core::lexer::tokenize;
use runjucks_core::parser::parse;
use serde_json::{json, Value};

fn evar(s: &str) -> Expr {
    Expr::Variable(s.into())
}

fn elit(v: Value) -> Expr {
    Expr::Literal(v)
}

#[test]
fn single_quoted_string_literal() {
    let tokens = tokenize("{{ 'foo' }}").unwrap();
    let ast = parse(&tokens).unwrap();
    assert_eq!(
        ast,
        Node::Root(vec![Node::Output(vec![elit(json!("foo"))])])
    );
}

#[test]
fn internal_whitespace_preserved_in_meaning() {
    let tokens = tokenize("{{  2   +   3  }}").unwrap();
    let ast = parse(&tokens).unwrap();
    assert!(
        matches!(
            ast,
            Node::Root(ref o) if matches!(
                o.as_slice(),
                [Node::Output(exprs)] if matches!(
                    exprs.as_slice(),
                    [Expr::Binary { op: BinOp::Add, .. }]
                )
            )
        ),
        "unexpected {ast:?}"
    );
}

#[test]
fn null_keyword_is_literal() {
    let tokens = tokenize("{{ null }}").unwrap();
    let ast = parse(&tokens).unwrap();
    assert_eq!(ast, Node::Root(vec![Node::Output(vec![elit(Value::Null)])]));
}

#[test]
fn or_and_not_precedence() {
    let tokens = tokenize("{{ true or false and false }}").unwrap();
    let ast = parse(&tokens).unwrap();
    // Nunjucks: `or` looser than `and` → true or (false and false) → true
    match ast {
        Node::Root(ref ch) if ch.len() == 1 => match &ch[0] {
            Node::Output(exprs) if exprs.len() == 1 => match &exprs[0] {
                Expr::Binary {
                    op: BinOp::Or,
                    left,
                    right,
                } => {
                    assert!(matches!(&**left, Expr::Literal(v) if *v == json!(true)));
                    assert!(matches!(&**right, Expr::Binary { op: BinOp::And, .. }));
                }
                _ => panic!("unexpected {:?}", exprs[0]),
            },
            _ => panic!("unexpected {:?}", ch[0]),
        },
        _ => panic!("unexpected {:?}", ast),
    }
}

#[test]
fn not_in_membership() {
    let tokens = tokenize("{{ 1 not in [1, 2] }}").unwrap();
    let ast = parse(&tokens).unwrap();
    let Node::Root(ch) = ast else {
        panic!("expected root");
    };
    let Node::Output(exprs) = &ch[0] else {
        panic!("expected output");
    };
    assert!(matches!(
        &exprs[0],
        Expr::Unary {
            op: UnaryOp::Not,
            expr
        } if matches!(
            expr.as_ref(),
            Expr::Binary {
                op: BinOp::In,
                ..
            }
        )
    ));
}

#[test]
fn parenthesis_override_precedence() {
    let tokens = tokenize("{{ (2 + 3) * 4 }}").unwrap();
    let ast = parse(&tokens).unwrap();
    match ast {
        Node::Root(ref ch) if ch.len() == 1 => match &ch[0] {
            Node::Output(exprs) if exprs.len() == 1 => match &exprs[0] {
                Expr::Binary {
                    op: BinOp::Mul,
                    left,
                    right,
                } => {
                    assert!(matches!(&**left, Expr::Binary { op: BinOp::Add, .. }));
                    assert!(matches!(&**right, Expr::Literal(_)));
                }
                _ => panic!("unexpected {:?}", exprs[0]),
            },
            _ => panic!("unexpected {:?}", ch[0]),
        },
        _ => panic!("unexpected {:?}", ast),
    }
}

#[test]
fn compare_chain_structure() {
    let tokens = tokenize("{{ 1 < 2 }}").unwrap();
    let ast = parse(&tokens).unwrap();
    match ast {
        Node::Root(ref ch) if ch.len() == 1 => match &ch[0] {
            Node::Output(exprs) if exprs.len() == 1 => match &exprs[0] {
                Expr::Compare { head: _, rest } => {
                    assert_eq!(rest.len(), 1);
                    assert_eq!(rest[0].0, CompareOp::Lt);
                }
                _ => panic!("unexpected {:?}", exprs[0]),
            },
            _ => panic!("unexpected {:?}", ch[0]),
        },
        _ => panic!("unexpected {:?}", ast),
    }
}

#[test]
fn tokenize_parse_round_trip_mixed_text() {
    let tokens = tokenize("a{{ x }}b").unwrap();
    let ast = parse(&tokens).unwrap();
    assert_eq!(
        ast,
        Node::Root(vec![
            Node::Text("a".into()),
            Node::Output(vec![evar("x")]),
            Node::Text("b".into()),
        ])
    );
}

#[test]
fn regex_literal_parses_with_flags() {
    let tokens = tokenize("{{ r/23/gi }}").unwrap();
    let ast = parse(&tokens).unwrap();
    match ast {
        Node::Root(ref ch) if ch.len() == 1 => match &ch[0] {
            Node::Output(exprs) if exprs.len() == 1 => match &exprs[0] {
                Expr::RegexLiteral { pattern, flags } => {
                    assert_eq!(pattern, "23");
                    assert_eq!(flags, "gi");
                }
                _ => panic!("unexpected {:?}", exprs[0]),
            },
            _ => panic!("unexpected {:?}", ch[0]),
        },
        _ => panic!("unexpected {:?}", ast),
    }
}
