use runjucks_core::ast::{Expr, Node};
use runjucks_core::lexer::{tokenize, Token};
use runjucks_core::parser::{parse, parse_expr};

#[test]
fn parse_empty_token_list_yields_empty_root() {
    let ast = parse(&[]).unwrap();
    match ast {
        Node::Root(nodes) => assert!(nodes.is_empty()),
        _ => panic!("expected Root"),
    }
}

#[test]
fn parse_concatenates_adjacent_text_tokens_into_sequential_nodes() {
    let ast = parse(&[
        Token::Text("a".into()),
        Token::Text("b".into()),
        Token::Text("c".into()),
    ])
    .unwrap();
    match ast {
        Node::Root(nodes) => {
            assert_eq!(nodes.len(), 3);
            assert!(matches!(&nodes[0], Node::Text(s) if s.as_ref() == "a"));
            assert!(matches!(&nodes[1], Node::Text(s) if s.as_ref() == "b"));
            assert!(matches!(&nodes[2], Node::Text(s) if s.as_ref() == "c"));
        }
        _ => panic!("expected Root"),
    }
}

#[test]
fn parse_expr_single_identifier() {
    match parse_expr("  name  ").unwrap() {
        Expr::Variable(s) => assert_eq!(s, "name"),
        _ => panic!("expected Variable"),
    }
}

#[test]
fn parse_expr_errors_on_incomplete_binary() {
    let err = parse_expr("x +").unwrap_err();
    assert!(
        err.to_string().contains("expression parse"),
        "unexpected: {}",
        err
    );
}

#[test]
fn parse_errors_on_unclosed_if_tag() {
    let tokens = tokenize("{% if x %}").unwrap();
    let err = parse(&tokens).unwrap_err();
    assert!(
        err.to_string().contains("endif") || err.to_string().contains("unclosed"),
        "unexpected: {}",
        err
    );
}
