//! Minimal probes for Nunjucks features the govuk/MOJ macros rely on.
use runjucks_core::Environment;
use serde_json::json;

fn r(src: &str) -> String {
    let mut env = Environment::default();
    env.autoescape = true;
    match env.render_string(src.into(), json!({"a": [1], "b": [2], "s": "x", "o": {"x": 1, "y": 2}})) {
        Ok(s) => format!("{s:?}"),
        Err(e) => format!("ERR {e}"),
    }
}

#[test]
fn probes() {
    for (name, src, want) in [
        ("comment trim", "a  {#- c -#}  b", "\"ab\""),
        ("tag trim", "a  {%- if true -%}  b  {%- endif -%}  c", "\"abc\""),
        ("var trim", "a  {{- s -}}  b", "\"axb\""),
        ("macro trim", "{% macro m() -%}  x  {%- endmacro %}[{{ m() }}]", "\"[x]\""),
        ("set in macro", "{% macro m() -%}\n  {% set v = 1 %}\n  {{- v -}}\n{%- endmacro %}[{{ m() }}]", "\"[1]\""),
        ("===", "{{ 'y' if 1 === 1 }}", "\"y\""),
        ("!==", "{{ 'y' if 1 !== 2 }}", "\"y\""),
        ("in [undefined, null]", "{{ 'y' if nope in [undefined, null] }}", "\"y\""),
        ("is escaped", "{{ 'y' if (s | safe) is escaped }}", "\"y\""),
        ("is mapping", "{{ 'y' if {a:1} is mapping }}", "\"y\""),
        ("safe .val", "{{ (s | safe).val }}", "\"x\""),
        ("concat", "{{ a.concat(b) | join(',') }}", "\"1,2\""),
        ("undefined not mapping", "{{ 'bad' if nope is mapping else 'ok' }}", "\"ok\""),
        ("safe through trim", "{{ ('<b>' | safe) | trim }}", "\"<b>\""),
        ("macro through indent", "{% macro m() %}<b>\n</b>{% endmacro %}{{ m() | trim | indent(2) }}", "\"<b>\\n  </b>\""),
        ("for k,v", "{% for k, v in o %}{{ k }}={{ v }};{% endfor %}", "\"x=1;y=2;\""),
        ("set ternary obj", "{% for k, v in o %}{% set opts = v if v is mapping else { value: v, optional: false } %}{{ opts.value }};{% endfor %}", "\"1;2;\""),
        ("set in for leaks", "{% set acc = '' %}{% for k, v in o %}{% set acc = acc + k %}{% endfor %}{{ acc }}", "\"xy\""),
        ("set in if in for", "{% set acc = '' %}{% for k, v in o %}{% if true %}{% set acc = acc + k %}{% endif %}{% endfor %}{{ acc }}", "\"xy\""),
    ] {
        let got = r(src);
        println!("{} {name}: {got}", if got == want { "ok  " } else { "FAIL" });
    }
}
