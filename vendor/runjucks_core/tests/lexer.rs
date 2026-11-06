use runjucks_core::lexer::{tokenize, Lexer, Token};

#[test]
fn tokenize_empty_is_single_empty_text_token() {
    let tokens = tokenize("").unwrap();
    assert_eq!(tokens, vec![Token::Text(String::new())]);
}

#[test]
fn tokenize_plain_text_no_delimiters_is_single_text_token() {
    let s = "  line1\n\tline2  ";
    let tokens = tokenize(s).unwrap();
    assert_eq!(tokens, vec![Token::Text(s.to_owned())]);
}

#[test]
fn tokenize_unicode_plain_text() {
    let s = "你好 🦀 «ταБЬℓσ»";
    let tokens = tokenize(s).unwrap();
    assert_eq!(tokens, vec![Token::Text(s.to_owned())]);
}

#[test]
fn tokenize_only_variable_region() {
    let tokens = tokenize("{{ x }}").unwrap();
    assert_eq!(tokens, vec![Token::Expression(" x ".into())]);
}

#[test]
fn tokenize_text_variable_text() {
    let tokens = tokenize("Hello, {{ name }}!").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Text("Hello, ".into()),
            Token::Expression(" name ".into()),
            Token::Text("!".into()),
        ]
    );
}

#[test]
fn tokenize_multiple_variable_regions() {
    let tokens = tokenize("{{ a }} and {{ b }}").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Expression(" a ".into()),
            Token::Text(" and ".into()),
            Token::Expression(" b ".into()),
        ]
    );
}

#[test]
fn lexer_next_token_yields_same_stream_as_tokenize() {
    let input = "a{{x}}b";
    let from_tokenize = tokenize(input).unwrap();

    let mut lexer = Lexer::new(input);
    let mut from_next = Vec::new();
    while let Some(t) = lexer.next_token().unwrap() {
        from_next.push(t);
    }
    assert_eq!(from_next, from_tokenize);
    assert!(lexer.is_eof());
}

#[test]
fn lexer_rest_shortens_as_tokens_are_consumed() {
    let mut lexer = Lexer::new("foo{{bar}}baz");
    assert_eq!(lexer.rest(), "foo{{bar}}baz");
    let _ = lexer.next_token().unwrap();
    assert_eq!(lexer.rest(), "{{bar}}baz");
    let _ = lexer.next_token().unwrap();
    assert_eq!(lexer.rest(), "baz");
}

#[test]
fn unclosed_variable_tag_errors() {
    let err = tokenize("hello {{ x").unwrap_err();
    assert!(
        err.to_string().contains("unclosed"),
        "unexpected message: {}",
        err
    );
}

#[test]
fn nested_open_inside_expression_errors() {
    let err = tokenize("{{ {{ x }} }}").unwrap_err();
    assert!(
        err.to_string().contains("nested"),
        "unexpected message: {}",
        err
    );
}

#[test]
fn nested_open_with_text_between_errors() {
    let err = tokenize("{{ foo {{ bar }} }}").unwrap_err();
    assert!(err.to_string().contains("nested"), "{}", err);
}

#[test]
fn lone_double_brace_without_close_errors() {
    let err = tokenize("{{").unwrap_err();
    assert!(err.to_string().contains("unclosed"), "{}", err);
}

#[test]
fn empty_expression_body_tokenizes() {
    let tokens = tokenize("{{}}").unwrap();
    assert_eq!(tokens, vec![Token::Expression(String::new())]);
}

#[test]
fn comment_between_text_is_removed_from_token_stream() {
    let tokens = tokenize("hello {# note #} world").unwrap();
    assert_eq!(
        tokens,
        vec![Token::Text("hello ".into()), Token::Text(" world".into())]
    );
}

#[test]
fn comment_only_yields_no_tokens() {
    let tokens = tokenize("{# nothing here #}").unwrap();
    assert!(tokens.is_empty());
}

#[test]
fn comment_before_variable_prefers_earliest_delimiter() {
    let tokens = tokenize("{# c #}{{ x }}").unwrap();
    assert_eq!(tokens, vec![Token::Expression(" x ".into())]);
}

#[test]
fn variable_before_comment_splits_correctly() {
    let tokens = tokenize("{{ x }}{# c #}y").unwrap();
    assert_eq!(
        tokens,
        vec![Token::Expression(" x ".into()), Token::Text("y".into())]
    );
}

#[test]
fn unclosed_comment_errors() {
    let err = tokenize("hello {# no close").unwrap_err();
    assert!(err.to_string().contains("unclosed comment"), "{}", err);
}

#[test]
fn comment_can_contain_double_braces_as_text() {
    let tokens = tokenize("{# {{ not a var }} #}ok").unwrap();
    assert_eq!(tokens, vec![Token::Text("ok".into())]);
}

#[test]
fn tokenize_empty_tag_body() {
    let tokens = tokenize("{% %}").unwrap();
    assert_eq!(tokens, vec![Token::Tag(String::new())]);
}

#[test]
fn tokenize_if_tag_trimmed_body() {
    let tokens = tokenize("{% if foo %}").unwrap();
    assert_eq!(tokens, vec![Token::Tag("if foo".into())]);
}

#[test]
fn tokenize_text_tag_text() {
    let tokens = tokenize("Hello{% if x %}world").unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Text("Hello".into()),
            Token::Tag("if x".into()),
            Token::Text("world".into()),
        ]
    );
}

#[test]
fn unclosed_tag_errors() {
    let err = tokenize("hello {% no close").unwrap_err();
    assert!(
        err.to_string().contains("unclosed") || err.to_string().contains("tag"),
        "unexpected message: {}",
        err
    );
}

#[test]
fn tag_before_comment_starts_tag_first() {
    let tokens = tokenize("{% if %}{# c #}y").unwrap();
    assert_eq!(
        tokens,
        vec![Token::Tag("if".into()), Token::Text("y".into())]
    );
}

/// `{#` starts before `{{`; `{%` inside a comment is not a tag opener.
#[test]
fn comment_before_variable_even_when_comment_contains_tag_like_text() {
    let tokens = tokenize("{# {% #}{{ x }}").unwrap();
    assert_eq!(tokens, vec![Token::Expression(" x ".into())]);
}
