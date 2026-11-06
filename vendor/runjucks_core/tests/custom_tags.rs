use runjucks_core::lexer::{tokenize_with_options, LexerOptions, Tags, Token};
use runjucks_core::Environment;
use serde_json::json;

fn custom_tags() -> Tags {
    Tags {
        block_start: "<%".into(),
        block_end: "%>".into(),
        variable_start: "<$".into(),
        variable_end: "$>".into(),
        comment_start: "<#".into(),
        comment_end: "#>".into(),
    }
}

fn custom_opts() -> LexerOptions {
    LexerOptions {
        tags: Some(custom_tags()),
        ..LexerOptions::default()
    }
}

fn tag(s: &str) -> Token {
    Token::Tag(s.into())
}

// ── Lexer tests with custom delimiters ──────────────────────────────────

#[test]
fn custom_variable_delimiters() {
    let tokens = tokenize_with_options("Hello <$ name $>!", custom_opts()).unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Text("Hello ".into()),
            Token::Expression(" name ".into()),
            Token::Text("!".into()),
        ]
    );
}

#[test]
fn custom_tag_delimiters() {
    let tokens = tokenize_with_options("<% if true %>yes<% endif %>", custom_opts()).unwrap();
    assert_eq!(
        tokens,
        vec![tag("if true"), Token::Text("yes".into()), tag("endif")]
    );
}

#[test]
fn custom_comment_delimiters() {
    let tokens = tokenize_with_options("a<# comment #>b", custom_opts()).unwrap();
    assert_eq!(
        tokens,
        vec![Token::Text("a".into()), Token::Text("b".into())]
    );
}

#[test]
fn custom_delimiters_mixed() {
    let tpl = "<% for i in items %><$ i $>, <% endfor %>";
    let tokens = tokenize_with_options(tpl, custom_opts()).unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("for i in items"),
            Token::Expression(" i ".into()),
            Token::Text(", ".into()),
            tag("endfor"),
        ]
    );
}

#[test]
fn custom_delimiters_with_trim_blocks() {
    let opts = LexerOptions {
        trim_blocks: true,
        tags: Some(custom_tags()),
        ..LexerOptions::default()
    };
    let tokens = tokenize_with_options("<% if true %>\nhello", opts).unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("hello".into())]);
}

#[test]
fn custom_delimiters_default_delimiters_are_text() {
    let tokens = tokenize_with_options("{{ x }} {% if %} {# comment #}", custom_opts()).unwrap();
    assert_eq!(
        tokens,
        vec![Token::Text("{{ x }} {% if %} {# comment #}".into())]
    );
}

// ── Environment render tests with custom delimiters ─────────────────────

#[test]
fn env_custom_tags_render() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.tags = Some(custom_tags());
    let out = env
        .render_string("Hello <$ name $>!".into(), json!({"name": "World"}))
        .unwrap();
    assert_eq!(out, "Hello World!");
}

#[test]
fn env_custom_tags_if() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.tags = Some(custom_tags());
    let out = env
        .render_string(
            "<% if x %>yes<% else %>no<% endif %>".into(),
            json!({"x": true}),
        )
        .unwrap();
    assert_eq!(out, "yes");
}

#[test]
fn env_custom_tags_for() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.tags = Some(custom_tags());
    let out = env
        .render_string(
            "<% for i in items %><$ i $><% endfor %>".into(),
            json!({"items": ["a", "b", "c"]}),
        )
        .unwrap();
    assert_eq!(out, "abc");
}

#[test]
fn env_custom_tags_with_trim() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.tags = Some(custom_tags());
    env.trim_blocks = true;
    env.lstrip_blocks = true;
    let out = env
        .render_string("  <% if true %>\nhello\n  <% endif %>\n".into(), json!({}))
        .unwrap();
    assert_eq!(out, "hello\n");
}

#[test]
fn env_custom_tags_trim_dash() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.tags = Some(custom_tags());
    let out = env
        .render_string(
            "  <%- if true -%>  hello  <%- endif -%>  ".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "hello");
}
