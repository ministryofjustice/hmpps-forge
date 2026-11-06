//! Parse cache correctness: signature invalidation and named/inline reuse.

use runjucks_core::extension::CustomExtensionHandler;
use runjucks_core::loader::{map_loader, TemplateLoader};
use runjucks_core::Environment;
use serde_json::json;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::sync::Mutex;

fn echo_handler() -> CustomExtensionHandler {
    Arc::new(|_ctx, args, body| {
        Ok(format!(
            "[{}]{}",
            args.trim(),
            body.as_deref().unwrap_or("")
        ))
    })
}

fn env_with_map(templates: HashMap<String, String>) -> Environment {
    let mut env = Environment::default();
    env.loader = Some(map_loader(templates));
    env
}

#[test]
fn inline_cache_hit_same_source_twice() {
    let env = Environment::default();
    let tpl = "Hello {{ name }}".to_string();
    let ctx = json!({ "name": "Ada" });
    let a = env.render_string(tpl.clone(), ctx.clone()).unwrap();
    let b = env.render_string(tpl, ctx).unwrap();
    assert_eq!(a, b);
    assert_eq!(a, "Hello Ada");
}

#[test]
fn signature_invalidation_trim_blocks() {
    let mut env = Environment::default();
    let tpl = "{% if true %}\nX{% endif %}".to_string();
    env.trim_blocks = false;
    let out_loose = env.render_string(tpl.clone(), json!({})).unwrap();
    env.trim_blocks = true;
    let out_trim = env.render_string(tpl, json!({})).unwrap();
    assert_ne!(out_loose, out_trim);
}

#[test]
fn signature_invalidation_custom_delimiters() {
    let mut env = Environment::default();
    let tpl = "<$ x $>".to_string();
    let as_text = env
        .render_string(tpl.clone(), json!({ "x": "hi" }))
        .unwrap();
    assert_eq!(as_text, "<$ x $>");
    env.tags = Some(runjucks_core::Tags {
        variable_start: "<$".into(),
        variable_end: "$>".into(),
        ..Default::default()
    });
    let as_var = env.render_string(tpl, json!({ "x": "hi" })).unwrap();
    assert_eq!(as_var, "hi");
}

#[test]
fn signature_invalidation_extension_tags() {
    let mut env = Environment::default();
    env.autoescape = false;
    let src = "{% echo x %}";
    assert!(env.render_string(src.into(), json!({})).is_err());
    env.register_extension("e", vec![("echo".into(), None)], echo_handler())
        .unwrap();
    let out = env.render_string(src.into(), json!({})).unwrap();
    assert_eq!(out, "[x]");
}

#[test]
fn signature_invalidation_remove_extension_after_cache() {
    let mut env = Environment::default();
    env.autoescape = false;
    env.register_extension("e", vec![("echo".into(), None)], echo_handler())
        .unwrap();
    let src = "{% echo %}";
    let ok = env.render_string(src.into(), json!({})).unwrap();
    assert_eq!(ok, "[]");
    assert!(env.remove_extension("e"));
    assert!(env.render_string(src.into(), json!({})).is_err());
}

#[test]
fn named_cache_hit_same_name_twice() {
    let mut m = HashMap::new();
    m.insert("a.njk".into(), "{{ x }}".into());
    let env = env_with_map(m);
    let ctx = json!({ "x": 1 });
    let u = env.render_template("a.njk", ctx.clone()).unwrap();
    let v = env.render_template("a.njk", ctx).unwrap();
    assert_eq!(u, v);
    assert_eq!(u, "1");
}

#[test]
fn named_cache_reflects_loader_source_change() {
    let mut m1 = HashMap::new();
    m1.insert("a.njk".into(), "one".into());
    let mut env = env_with_map(m1);
    assert_eq!(env.render_template("a.njk", json!({})).unwrap(), "one");

    let mut m2 = HashMap::new();
    m2.insert("a.njk".into(), "two".into());
    env.loader = Some(map_loader(m2));
    assert_eq!(env.render_template("a.njk", json!({})).unwrap(), "two");
}

#[test]
fn nested_include_renders_twice() {
    let mut m = HashMap::new();
    m.insert("p.njk".into(), "{{ n }}".into());
    m.insert(
        "main.njk".into(),
        r#"{% include "p.njk" %}{% include "p.njk" %}"#.into(),
    );
    let env = env_with_map(m);
    let out = env.render_template("main.njk", json!({ "n": 3 })).unwrap();
    assert_eq!(out, "33");
    let out2 = env.render_template("main.njk", json!({ "n": 4 })).unwrap();
    assert_eq!(out2, "44");
}

#[test]
fn invalidate_cache_smoke_named_and_inline() {
    let tpl = "Hello {{ x }}".to_string();
    let mut env = Environment::default();
    env.render_string(tpl.clone(), json!({ "x": 1 })).unwrap();

    let mut m = HashMap::new();
    m.insert("a.njk".into(), "{{ y }}".into());
    env.loader = Some(map_loader(m));
    env.render_template("a.njk", json!({ "y": 2 })).unwrap();

    env.invalidate_cache();

    assert_eq!(
        env.render_string(tpl, json!({ "x": 3 })).unwrap(),
        "Hello 3"
    );
    assert_eq!(
        env.render_template("a.njk", json!({ "y": 4 })).unwrap(),
        "4"
    );
}

struct CountingStableLoader {
    src: String,
    loads: Arc<AtomicUsize>,
}

impl TemplateLoader for CountingStableLoader {
    fn load(&self, _name: &str) -> runjucks_core::errors::Result<String> {
        self.loads.fetch_add(1, Ordering::SeqCst);
        Ok(self.src.clone())
    }

    fn cache_key(&self, name: &str) -> Option<String> {
        Some(name.to_string())
    }

    fn cache_keys_are_stable(&self) -> bool {
        true
    }
}

#[test]
fn named_cache_skips_reload_when_loader_keys_are_stable() {
    let loads = Arc::new(AtomicUsize::new(0));
    let loader = CountingStableLoader {
        src: "{{ x }}".into(),
        loads: loads.clone(),
    };
    let mut env = Environment::default();
    env.loader = Some(Arc::new(loader));
    let out1 = env.render_template("main.njk", json!({ "x": 1 })).unwrap();
    let out2 = env.render_template("main.njk", json!({ "x": 2 })).unwrap();
    assert_eq!(out1, "1");
    assert_eq!(out2, "2");
    assert_eq!(loads.load(Ordering::SeqCst), 1);
}

struct CowOnlyStableLoader {
    src: String,
}

impl TemplateLoader for CowOnlyStableLoader {
    fn load(&self, _name: &str) -> runjucks_core::errors::Result<String> {
        Ok(self.src.clone())
    }

    fn cache_key(&self, _name: &str) -> Option<String> {
        panic!("cache_key() should not be called when cache_key_cow() is implemented")
    }

    fn cache_key_cow<'a>(&self, name: &'a str) -> Option<std::borrow::Cow<'a, str>> {
        Some(std::borrow::Cow::Borrowed(name))
    }

    fn cache_keys_are_stable(&self) -> bool {
        true
    }
}

#[test]
fn stable_loader_uses_cache_key_cow_without_fallback_to_cache_key() {
    let mut env = Environment::default();
    env.loader = Some(Arc::new(CowOnlyStableLoader {
        src: "{{ x }}".into(),
    }));
    let out1 = env.render_template("main.njk", json!({ "x": 1 })).unwrap();
    let out2 = env.render_template("main.njk", json!({ "x": 2 })).unwrap();
    assert_eq!(out1, "1");
    assert_eq!(out2, "2");
}

struct CanonicalKeyAfterLoad {
    loads: Arc<AtomicUsize>,
    canonicalized: Mutex<bool>,
}

impl TemplateLoader for CanonicalKeyAfterLoad {
    fn load(&self, _name: &str) -> runjucks_core::errors::Result<String> {
        self.loads.fetch_add(1, Ordering::SeqCst);
        *self.canonicalized.lock().unwrap() = true;
        Ok("{{ x }}".to_string())
    }

    fn cache_key_cow<'a>(&self, name: &'a str) -> Option<std::borrow::Cow<'a, str>> {
        if *self.canonicalized.lock().unwrap() {
            Some(std::borrow::Cow::Owned(format!("canon:{name}")))
        } else {
            Some(std::borrow::Cow::Borrowed(name))
        }
    }

    fn cache_keys_are_stable(&self) -> bool {
        true
    }
}

#[test]
fn stable_loader_recomputes_cache_key_after_load() {
    let loads = Arc::new(AtomicUsize::new(0));
    let loader = Arc::new(CanonicalKeyAfterLoad {
        loads: Arc::clone(&loads),
        canonicalized: Mutex::new(false),
    });
    let mut env = Environment::default();
    env.loader = Some(loader);

    let out1 = env.render_template("main.njk", json!({ "x": 1 })).unwrap();
    let out2 = env.render_template("main.njk", json!({ "x": 2 })).unwrap();
    assert_eq!(out1, "1");
    assert_eq!(out2, "2");
    assert_eq!(loads.load(Ordering::SeqCst), 1);
}
