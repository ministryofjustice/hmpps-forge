use runjucks_core::lexer::{tokenize_with_options, LexerOptions, Token};
use runjucks_core::Environment;
use serde_json::json;

fn opts_trim() -> LexerOptions {
    LexerOptions {
        trim_blocks: true,
        ..LexerOptions::default()
    }
}

fn opts_lstrip() -> LexerOptions {
    LexerOptions {
        lstrip_blocks: true,
        ..LexerOptions::default()
    }
}

fn opts_both() -> LexerOptions {
    LexerOptions {
        trim_blocks: true,
        lstrip_blocks: true,
        ..LexerOptions::default()
    }
}

fn tag(s: &str) -> Token {
    Token::Tag(s.into())
}

// ── trimBlocks lexer tests ──────────────────────────────────────────────

#[test]
fn trim_blocks_strips_newline_after_tag() {
    let tokens = tokenize_with_options("{% if true %}\ncontent", opts_trim()).unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("content".into())]);
}

#[test]
fn trim_blocks_strips_crlf_after_tag() {
    let tokens = tokenize_with_options("{% if true %}\r\ncontent", opts_trim()).unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("content".into())]);
}

#[test]
fn trim_blocks_does_not_strip_spaces_only_newline() {
    let tokens = tokenize_with_options("{% if true %}  \ncontent", opts_trim()).unwrap();
    assert_eq!(
        tokens,
        vec![tag("if true"), Token::Text("  \ncontent".into()),]
    );
}

#[test]
fn trim_blocks_does_not_affect_variable_tags() {
    let tokens = tokenize_with_options("{{ x }}\ncontent", opts_trim()).unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Expression(" x ".into()),
            Token::Text("\ncontent".into()),
        ]
    );
}

#[test]
fn trim_blocks_explicit_minus_overrides() {
    let tokens = tokenize_with_options("{% if true -%}  \n  content", opts_trim()).unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("content".into())]);
}

#[test]
fn trim_blocks_preserves_newline_after_endraw_like_nunjucks() {
    let tokens = tokenize_with_options("{% raw %}x{% endraw %}\nafter", opts_trim()).unwrap();
    assert_eq!(
        tokens,
        vec![
            tag("raw"),
            Token::Text("x".into()),
            tag("endraw"),
            Token::Text("\nafter".into()),
        ]
    );
}

#[test]
fn trim_blocks_no_newline_after_tag_no_strip() {
    let tokens = tokenize_with_options("{% if true %}content", opts_trim()).unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("content".into())]);
}

// ── lstripBlocks lexer tests ────────────────────────────────────────────

#[test]
fn lstrip_blocks_strips_leading_whitespace_before_tag() {
    let tokens = tokenize_with_options("  {% if true %}", opts_lstrip()).unwrap();
    assert_eq!(tokens, vec![tag("if true")]);
}

#[test]
fn lstrip_blocks_strips_tabs_before_tag() {
    let tokens = tokenize_with_options("\t\t{% if true %}", opts_lstrip()).unwrap();
    assert_eq!(tokens, vec![tag("if true")]);
}

#[test]
fn lstrip_blocks_only_strips_same_line_whitespace() {
    let tokens = tokenize_with_options("text\n  {% if true %}", opts_lstrip()).unwrap();
    assert_eq!(tokens, vec![Token::Text("text\n".into()), tag("if true")]);
}

#[test]
fn lstrip_blocks_does_not_strip_if_non_whitespace_before_tag() {
    let tokens = tokenize_with_options("x  {% if true %}", opts_lstrip()).unwrap();
    assert_eq!(tokens, vec![Token::Text("x  ".into()), tag("if true")]);
}

#[test]
fn lstrip_blocks_does_not_affect_variable_tags() {
    let tokens = tokenize_with_options("  {{ x }}", opts_lstrip()).unwrap();
    assert_eq!(
        tokens,
        vec![Token::Text("  ".into()), Token::Expression(" x ".into())]
    );
}

#[test]
fn lstrip_blocks_strips_before_comment() {
    let tokens = tokenize_with_options("  {# comment #}text", opts_lstrip()).unwrap();
    assert_eq!(tokens, vec![Token::Text("text".into())]);
}

// ── both trimBlocks + lstripBlocks ──────────────────────────────────────

#[test]
fn both_trim_and_lstrip() {
    let tokens = tokenize_with_options("  {% if true %}\ncontent", opts_both()).unwrap();
    assert_eq!(tokens, vec![tag("if true"), Token::Text("content".into())]);
}

#[test]
fn both_multiline_template() {
    let tpl = "line1\n  {% if true %}\n  text\n  {% endif %}\nend";
    let tokens = tokenize_with_options(tpl, opts_both()).unwrap();
    assert_eq!(
        tokens,
        vec![
            Token::Text("line1\n".into()),
            tag("if true"),
            Token::Text("  text\n".into()),
            tag("endif"),
            Token::Text("end".into()),
        ]
    );
}

// ── Environment render tests ────────────────────────────────────────────

#[test]
fn env_trim_blocks_render() {
    let mut env = Environment::default();
    env.trim_blocks = true;
    env.autoescape = false;
    let out = env
        .render_string("{% if true %}\nhello{% endif %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "hello");
}

#[test]
fn env_lstrip_blocks_render() {
    let mut env = Environment::default();
    env.lstrip_blocks = true;
    env.autoescape = false;
    let out = env
        .render_string("  {% if true %}hello  {% endif %}".into(), json!({}))
        .unwrap();
    assert_eq!(out, "hello  ");
}

#[test]
fn env_both_trim_lstrip_render() {
    let mut env = Environment::default();
    env.trim_blocks = true;
    env.lstrip_blocks = true;
    env.autoescape = false;
    let out = env
        .render_string("  {% if true %}\nhello\n  {% endif %}\n".into(), json!({}))
        .unwrap();
    assert_eq!(out, "hello\n");
}

#[test]
fn env_trim_blocks_for_loop() {
    let mut env = Environment::default();
    env.trim_blocks = true;
    env.lstrip_blocks = true;
    env.autoescape = false;
    let out = env
        .render_string(
            "{% for i in items %}\n  {{ i }}\n{% endfor %}\n".into(),
            json!({"items": ["a", "b"]}),
        )
        .unwrap();
    assert_eq!(out, "  a\n  b\n");
}

#[test]
fn env_trim_blocks_does_not_strip_newline_after_comment() {
    let mut env = Environment::default();
    env.trim_blocks = true;
    env.autoescape = false;
    let out = env
        .render_string("before{# comment #}\nafter".into(), json!({}))
        .unwrap();
    // Nunjucks `trimBlocks` applies to `{% %}` only, not `{# #}`.
    assert_eq!(out, "before\nafter");
}

#[test]
fn env_trim_blocks_does_not_strip_newline_after_endraw_matches_nunjucks() {
    let mut env = Environment::default();
    env.trim_blocks = true;
    env.autoescape = false;
    let out = env
        .render_string("{% raw %}x{% endraw %}\nafter".into(), json!({}))
        .unwrap();
    assert_eq!(out, "x\nafter");
}
