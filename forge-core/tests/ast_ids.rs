//! Checks that the Rust AST assigns the same node IDs as the TypeScript engine, using the IDs
//! that appear in TS render outputs across the exported contract corpus.

use std::collections::HashMap;
use std::sync::Arc;

use forge_core::Value;
use forge_core::engine::ast::{AstIndex, Node, NodeFactory, NodeKind, Prop};

fn corpus() -> Option<Value> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/contracts.json");
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

/// Every node reachable from `root`, including template nodes.
fn all_nodes(root: &Arc<Node>, out: &mut HashMap<String, Arc<Node>>) {
    out.insert(root.id.to_string(), root.clone());
    for prop in root.props.values() {
        let mut children = Vec::new();
        prop.for_each_node(&mut |n| children.push(n.clone()));
        children.iter().for_each(|c| all_nodes(c, out));
    }
    let _ = Prop::undefined();
}

fn collect_ids(v: &Value, out: &mut Vec<(String, Value)>) {
    match v {
        Value::Object(o) => {
            for key in ["id", "nodeId"] {
                if let Some(Value::String(id)) = o.get(key)
                    && id.starts_with("compile_ast:")
                {
                    out.push((id.to_string(), v.clone()));
                }
            }
            o.values().for_each(|c| collect_ids(c, out));
        }
        Value::Array(a) => a.iter().for_each(|c| collect_ids(c, out)),
        _ => {}
    }
}

#[test]
fn node_ids_match_typescript_across_corpus() {
    let Some(corpus) = corpus() else {
        eprintln!("contract corpus not exported; skipping");
        return;
    };
    let mut checked = 0;
    for case in corpus.as_array().unwrap().iter() {
        let root = NodeFactory::new().create_node(&case.get("journey")).unwrap_or_else(|e| {
            panic!("{}: {e}", case.get("description"))
        });
        let mut nodes = HashMap::new();
        all_nodes(&root, &mut nodes);
        let _index = AstIndex::build(&root);
        for row in case.get("rows").as_array().unwrap().iter() {
            let mut ids = Vec::new();
            collect_ids(&row.get("actual"), &mut ids);
            for (id, owner) in ids {
                let node = nodes.get(&id).unwrap_or_else(|| panic!("{}: no Rust node {id}", case.get("description")));
                let ok = match &node.kind {
                    NodeKind::Block { variant, .. } => owner.get("variant").as_str().is_none_or(|v| v == variant.as_ref()),
                    NodeKind::Step => owner.get("route").get("kind").as_str().is_none_or(|k| k == "step"),
                    NodeKind::Journey => owner.get("route").get("kind").as_str().is_none_or(|k| k == "journey"),
                    _ => owner.get("kind").as_str().is_some(),
                };
                assert!(ok, "{}: {id} is {:?} in Rust but {:?} in TS", case.get("description"), node.kind, owner);
                checked += 1;
            }
        }
    }
    assert!(checked > 0);
    eprintln!("checked {checked} node ID references");
}
