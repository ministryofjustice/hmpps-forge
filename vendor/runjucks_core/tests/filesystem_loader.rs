//! [`FileSystemLoader`] safety and reads.

use runjucks_core::loader::{file_system_loader, FileSystemLoader};
use runjucks_core::{Environment, TemplateLoader};
use serde_json::json;
use std::fs;
use std::path::PathBuf;

fn temp_dir(name: &str) -> PathBuf {
    let p = std::env::temp_dir().join(format!("runjucks-fs-test-{}-{}", name, std::process::id()));
    let _ = fs::remove_dir_all(&p);
    fs::create_dir_all(&p).expect("mkdir");
    p
}

#[test]
fn loads_file_under_root() {
    let dir = temp_dir("ok");
    fs::write(dir.join("hello.njk"), "Hello {{ x }}").unwrap();
    let loader = FileSystemLoader::new(&dir).unwrap();
    assert_eq!(loader.load("hello.njk").unwrap(), "Hello {{ x }}");

    let mut env = Environment::default();
    env.loader = Some(file_system_loader(&dir).unwrap());
    let out = env
        .render_template("hello.njk", json!({ "x": "y" }))
        .unwrap();
    assert_eq!(out, "Hello y");
}

#[test]
fn rejects_parent_dir_in_name() {
    let dir = temp_dir("dotdot");
    fs::write(dir.join("a.njk"), "x").unwrap();
    let loader = FileSystemLoader::new(&dir).unwrap();
    assert!(loader.load("../a.njk").is_err());
}

#[test]
fn missing_template_errors() {
    let dir = temp_dir("missing");
    let loader = FileSystemLoader::new(&dir).unwrap();
    assert!(loader.load("nope.njk").is_err());
}
