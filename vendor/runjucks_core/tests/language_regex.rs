//! Regex literals `r/pattern/flags` and `.test()` — [Nunjucks templating](https://mozilla.github.io/nunjucks/templating.html#regular-expressions).

use runjucks_core::Environment;
use serde_json::json;

#[test]
fn regex_test_matches_substring() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ 'yes' if r/foo/.test('barfoobaz') else 'no' }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "yes");
}

#[test]
fn regex_test_case_insensitive_flag() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ 'yes' if r/foo/i.test('FOO') else 'no' }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "yes");
}

#[test]
fn regex_escaped_slash_in_pattern() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ 'yes' if r/foo\\/bar/.test('foo/bar') else 'no' }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "yes");
}

#[test]
fn regex_test_no_match() {
    let env = Environment::default();
    let out = env
        .render_string(
            "{{ 'yes' if r/^foo$/.test('bar') else 'no' }}".into(),
            json!({}),
        )
        .unwrap();
    assert_eq!(out, "no");
}

#[test]
fn set_regex_and_test_in_if() {
    let env = Environment::default();
    let tpl = "{% set reg = r/^foo.*/g %}{% if reg.test('foobar') %}ok{% endif %}";
    let out = env.render_string(tpl.into(), json!({})).unwrap();
    assert_eq!(out, "ok");
}
