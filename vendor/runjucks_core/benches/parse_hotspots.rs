//! Rust-only **lex + parse** microbenches (no render, no NAPI).
//!
//! Compare with [`render_hotspots`](render_hotspots.rs): that bench measures **render** on a cached AST
//! via `Environment::render_string` (parse cache hit after first call). This file measures **cold**
//! `tokenize` + `parse` cost and, separately, **render-only** on a pre-parsed AST via
//! [`Environment::render_parsed`].
//!
//! Run: `cargo bench -p runjucks_core --bench parse_hotspots`
//! Flamegraph (Linux): `cargo flamegraph --bench parse_hotspots -p runjucks_core`

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use runjucks_core::lexer::tokenize;
use runjucks_core::parser::parse;
use runjucks_core::Environment;
use serde_json::json;

/// Large body with almost no delimiters (lexer scans most of the string as `Text`).
fn tpl_large_plain() -> String {
    let line = "Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n";
    line.repeat(400)
}

/// Many small `{{ }}` regions (lexer + expression parser hot).
fn tpl_many_interpolations() -> String {
    let mut s = String::with_capacity(50 * 80);
    for i in 0..80 {
        use std::fmt::Write;
        write!(&mut s, "x{{ v{} }}", i).unwrap();
    }
    s
}

/// Nested `{% for %}` structure (tag lexer + template parser).
fn tpl_heavy_for() -> String {
    let mut t = "{% for a in outer %}".to_string();
    for _ in 0..15 {
        t.push_str("{% for b in inner %}");
    }
    t.push_str("{{ a }}{{ b }}");
    for _ in 0..15 {
        t.push_str("{% endfor %}");
    }
    t.push_str("{% endfor %}");
    t
}

fn tokenize_large_plain(c: &mut Criterion) {
    let tpl = tpl_large_plain();
    c.bench_function("tokenize_large_plain_400_lines", |b| {
        b.iter(|| black_box(tokenize(black_box(tpl.as_str())).unwrap()))
    });
}

fn tokenize_many_interpolations(c: &mut Criterion) {
    let tpl = tpl_many_interpolations();
    c.bench_function("tokenize_many_interpolations_80", |b| {
        b.iter(|| black_box(tokenize(black_box(tpl.as_str())).unwrap()))
    });
}

fn parse_cold_tokenize_and_parse(c: &mut Criterion) {
    let plain = tpl_large_plain();
    let many = tpl_many_interpolations();
    let heavy = tpl_heavy_for();

    c.bench_function("parse_cold_large_plain", |b| {
        b.iter(|| {
            let tokens = tokenize(black_box(plain.as_str())).unwrap();
            black_box(parse(black_box(&tokens)).unwrap())
        })
    });

    c.bench_function("parse_cold_many_interpolations", |b| {
        b.iter(|| {
            let tokens = tokenize(black_box(many.as_str())).unwrap();
            black_box(parse(black_box(&tokens)).unwrap())
        })
    });

    c.bench_function("parse_cold_heavy_nested_for", |b| {
        b.iter(|| {
            let tokens = tokenize(black_box(heavy.as_str())).unwrap();
            black_box(parse(black_box(&tokens)).unwrap())
        })
    });
}

/// Same template: full `render_string` (lex+parse+cache insert on first use — use fresh env per iter for cold parse)
/// vs `render_parsed` on AST built once.
fn parse_vs_render_same_template(c: &mut Criterion) {
    let tpl = "{% for n in nums %}{{ n }}{% endfor %}".to_string();
    let ctx = json!({ "nums": (0u32..200).collect::<Vec<_>>() });

    let tokens = tokenize(&tpl).unwrap();
    let ast = parse(&tokens).unwrap();

    c.bench_function("parse_vs_render_cold_render_string_for200", |b| {
        b.iter(|| {
            let env = Environment::default();
            let out = env.render_string(tpl.clone(), ctx.clone()).unwrap();
            black_box(out)
        })
    });

    c.bench_function("parse_vs_render_render_only_for200", |b| {
        let env = Environment::default();
        b.iter(|| {
            let out = env.render_parsed(black_box(&ast), ctx.clone()).unwrap();
            black_box(out)
        })
    });
}

criterion_group!(
    benches,
    tokenize_large_plain,
    tokenize_many_interpolations,
    parse_cold_tokenize_and_parse,
    parse_vs_render_same_template,
);
criterion_main!(benches);
