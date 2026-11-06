//! Route (port of `concerns/route`): the static route tree built at mount, per-request route
//! metadata (titles, descriptions, metadata are expressions), and redirect target resolution.

use std::collections::HashMap;
use std::sync::Arc;

use crate::engine::ast::{AstIndex, Node, NodeId, NodeKind};
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::expr::{ExprCompiler, Scope};
use crate::engine::runtime::context::SharedContext;
use crate::engine::value_expr::{ValueExpr, ValuePolicy};
use crate::route_path::{join_paths, resolve_path_params};
use crate::value::{Map, Value};

/// Step route template paths for one journey base path (`JourneyRouteTemplateCatalog`).
#[derive(Clone, Debug, Default)]
pub struct RouteTemplateCatalog {
    pub path_by_step: indexmap::IndexMap<NodeId, String>,
    pub step_by_path: HashMap<String, NodeId>,
}

impl RouteTemplateCatalog {
    pub fn path_of(&self, step: &str) -> Option<&str> {
        self.path_by_step.get(step).map(String::as_str)
    }

    pub fn step_at(&self, path: &str) -> Option<&NodeId> {
        self.step_by_path.get(path)
    }
}

/// `StepRouteDescriptor` / `JourneyRouteDescriptor`.
#[derive(Clone, Debug)]
pub struct RouteDescriptor {
    pub node_id: NodeId,
    pub path: String,
    pub ancestor_journey_ids: Vec<NodeId>,
}

/// Route indexes in AST registration order (`RouteIndexBuilder`).
pub fn build_route_indexes(index: &AstIndex) -> (Vec<RouteDescriptor>, Vec<RouteDescriptor>) {
    let chain = |start: Option<&Arc<Node>>| -> Vec<NodeId> {
        let mut ids = Vec::new();
        if let Some(s) = start {
            ids.push(s.id.clone());
            ids.extend(index.ancestors(&s.id).into_iter().map(|n| n.id.clone()));
        }
        ids.reverse();
        ids
    };
    let mut journeys = Vec::new();
    let mut steps = Vec::new();
    for id in &index.order {
        let node = &index.nodes[id];
        let path = node.str_prop("path").unwrap_or_default().to_string();
        match node.kind {
            NodeKind::Journey => journeys.push(RouteDescriptor { node_id: id.clone(), path, ancestor_journey_ids: chain(Some(node)) }),
            NodeKind::Step => steps.push(RouteDescriptor { node_id: id.clone(), path, ancestor_journey_ids: chain(index.parent(id)) }),
            _ => {}
        }
    }
    (journeys, steps)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RouteKind {
    Journey,
    Step,
}

impl RouteKind {
    pub fn as_str(self) -> &'static str {
        match self {
            RouteKind::Journey => "journey",
            RouteKind::Step => "step",
        }
    }
}

/// `StoredRouteTreeNode`.
#[derive(Clone, Debug)]
pub struct StoredRouteNode {
    pub segment: String,
    pub template_path: String,
    pub route: Option<(RouteKind, NodeId)>,
    pub children: Vec<StoredRouteNode>,
}

/// `JourneyRouteContext`.
#[derive(Clone, Debug)]
pub struct JourneyRouteContext {
    pub journey_id: NodeId,
    pub template_path: String,
    pub mount_path: String,
    pub parent_template_path: Option<String>,
}

/// `StepRouteContext`.
#[derive(Clone, Debug)]
pub struct StepRouteContext {
    pub step_id: NodeId,
    pub path: String,
    pub route_template_path: String,
    pub journey_base_path: String,
}

/// The route tree for everything mounted on one Forge instance (`RouteTreeIndex`).
#[derive(Clone, Debug, Default)]
pub struct RouteTree {
    pub roots: Vec<StoredRouteNode>,
    pub catalogs: HashMap<String, Arc<RouteTemplateCatalog>>,
}

impl RouteTree {
    /// `RouteTreeBuilder.build`.
    pub fn insert_package(
        &mut self,
        base_path: &str,
        journeys: &[RouteDescriptor],
        steps: &[RouteDescriptor],
    ) -> ForgeResult<(Vec<JourneyRouteContext>, Vec<StepRouteContext>)> {
        let by_id: HashMap<&NodeId, &RouteDescriptor> = journeys.iter().map(|j| (&j.node_id, j)).collect();
        let mut contexts: indexmap::IndexMap<NodeId, JourneyRouteContext> = indexmap::IndexMap::new();
        for d in journeys {
            let mut parent_path = base_path.to_string();
            let mut parent_template: Option<String> = None;
            for ancestor_id in &d.ancestor_journey_ids {
                let Some(ancestor) = by_id.get(ancestor_id) else { continue };
                let template_path = join_paths(&[&parent_path, &ancestor.path]);
                contexts.entry(ancestor.node_id.clone()).or_insert_with(|| JourneyRouteContext {
                    journey_id: ancestor.node_id.clone(),
                    template_path: template_path.clone(),
                    mount_path: match &parent_template {
                        None => join_paths(&[base_path, &ancestor.path]),
                        Some(_) => join_paths(&["", &ancestor.path]),
                    },
                    parent_template_path: parent_template.clone(),
                });
                parent_path = template_path.clone();
                parent_template = Some(template_path);
            }
        }
        for c in contexts.values() {
            self.insert_route(&c.template_path, RouteKind::Journey, &c.journey_id)?;
        }
        let mut catalogs: HashMap<String, RouteTemplateCatalog> = HashMap::new();
        let mut step_contexts = Vec::new();
        for d in steps {
            let journey_base = d.ancestor_journey_ids.iter().fold(base_path.to_string(), |path, id| match by_id.get(id) {
                Some(j) => join_paths(&[&path, &j.path]),
                None => path,
            });
            let route_template_path = join_paths(&[&journey_base, &d.path]);
            let catalog = catalogs.entry(journey_base.clone()).or_default();
            catalog.path_by_step.insert(d.node_id.clone(), route_template_path.clone());
            catalog.step_by_path.insert(route_template_path.clone(), d.node_id.clone());
            step_contexts.push(StepRouteContext {
                step_id: d.node_id.clone(),
                path: d.path.clone(),
                route_template_path,
                journey_base_path: journey_base,
            });
        }
        for s in &step_contexts {
            self.insert_route(&s.route_template_path, RouteKind::Step, &s.step_id)?;
        }
        for (k, v) in catalogs {
            self.catalogs.insert(k, Arc::new(v));
        }
        Ok((contexts.into_values().collect(), step_contexts))
    }

    fn insert_route(&mut self, template_path: &str, kind: RouteKind, id: &NodeId) -> ForgeResult<()> {
        let node = self.ensure_node(template_path);
        if let Some((existing, _)) = &node.route
            && !(*existing == RouteKind::Journey && kind == RouteKind::Step)
        {
            return Err(ForgeError::DuplicateRoute { message: template_path.to_string() });
        }
        node.route = Some((kind, id.clone()));
        Ok(())
    }

    fn ensure_node(&mut self, path: &str) -> &mut StoredRouteNode {
        let template_path = join_paths(&[path]);
        let segments: Vec<&str> = template_path.split('/').filter(|s| !s.is_empty()).collect();
        fn child_index(siblings: &mut Vec<StoredRouteNode>, segment: &str, template_path: String) -> usize {
            siblings.iter().position(|c| c.segment == segment).unwrap_or_else(|| {
                siblings.push(StoredRouteNode { segment: segment.to_string(), template_path, route: None, children: Vec::new() });
                siblings.len() - 1
            })
        }
        let Some((last, init)) = segments.split_last() else {
            let i = child_index(&mut self.roots, "", "/".into());
            return &mut self.roots[i];
        };
        let mut parent_path = String::new();
        let mut siblings = &mut self.roots;
        for seg in init {
            let child_path = join_paths(&[&parent_path, seg]);
            let i = child_index(siblings, seg, child_path.clone());
            siblings = &mut siblings[i].children;
            parent_path = child_path;
        }
        let i = child_index(siblings, last, join_paths(&[&parent_path, last]));
        &mut siblings[i]
    }
}

/// Compiled route metadata for every step and journey (`RouteMetadataCompiler`).
pub struct CompiledRouteMetadata {
    entries: Vec<(NodeId, ValueExpr, Option<ValueExpr>, Option<ValueExpr>)>,
}

/// One node's resolved metadata.
#[derive(Clone, Debug, Default)]
pub struct ResolvedRouteMetadata {
    pub title: Value,
    pub description: Value,
    pub metadata: Value,
}

impl CompiledRouteMetadata {
    pub fn compile(index: &AstIndex, exprs: &ExprCompiler<'_>) -> ForgeResult<Self> {
        let mut entries = Vec::new();
        for id in &index.order {
            let node = &index.nodes[id];
            if !matches!(node.kind, NodeKind::Journey | NodeKind::Step) {
                continue;
            }
            entries.push((
                id.clone(),
                exprs.value_opt(node.prop("title"))?,
                node.prop("description").map(|p| exprs.value(p)).transpose()?,
                node.prop("metadata").map(|p| exprs.value(p)).transpose()?,
            ));
        }
        Ok(Self { entries })
    }

    pub async fn evaluate(&self, ctx: &SharedContext) -> ForgeResult<HashMap<NodeId, ResolvedRouteMetadata>> {
        let policy = ValuePolicy::throwing();
        let mut scope = Scope::new(ctx.clone());
        let mut out = HashMap::new();
        for (id, title, description, metadata) in &self.entries {
            let resolved = ResolvedRouteMetadata {
                title: title.eval(&mut scope, &policy).await?,
                description: match description {
                    Some(d) => d.eval(&mut scope, &policy).await?,
                    None => Value::Undefined,
                },
                metadata: match metadata {
                    Some(m) => m.eval(&mut scope, &policy).await?,
                    None => Value::Undefined,
                },
            };
            out.insert(id.clone(), resolved);
        }
        Ok(out)
    }
}

/// `hydrateRouteTree`: the request's route tree as a JS-shaped value.
pub fn hydrate_route_tree(
    roots: &[StoredRouteNode],
    current_step_path: &str,
    params: &Value,
    metadata: &HashMap<NodeId, ResolvedRouteMetadata>,
) -> Value {
    Value::array(roots.iter().map(|n| hydrate_node(n, current_step_path, params, metadata)).collect())
}

fn hydrate_node(node: &StoredRouteNode, current: &str, params: &Value, metadata: &HashMap<NodeId, ResolvedRouteMetadata>) -> Value {
    let children: Vec<Value> = node.children.iter().map(|c| hydrate_node(c, current, params, metadata)).collect();
    let active = node.template_path == current || children.iter().any(|c| c.get("active").truthy());
    let entry = node.route.as_ref().and_then(|(_, id)| metadata.get(id));
    let mut map = Map::new();
    map.insert("segment".into(), Value::from(node.segment.as_str()));
    map.insert("path".into(), Value::from(resolve_path_params(&node.template_path, params)));
    map.insert("templatePath".into(), Value::from(node.template_path.as_str()));
    map.insert("active".into(), Value::Bool(active));
    map.insert("metadata".into(), entry.map(|e| e.metadata.clone()).unwrap_or_default());
    map.insert(
        "route".into(),
        match &node.route {
            Some((kind, id)) => Value::from_pairs([
                ("kind", Value::from(kind.as_str())),
                ("nodeId", Value::String(id.clone())),
                ("title", entry.map(|e| e.title.clone()).unwrap_or_default()),
                ("description", entry.map(|e| e.description.clone()).unwrap_or_default()),
                ("metadata", entry.map(|e| e.metadata.clone()).unwrap_or_default()),
            ]),
            None => Value::Undefined,
        },
    );
    map.insert("children".into(), Value::array(children));
    Value::object(map)
}

/// `resolveRedirectTarget`: a redirect string resolved against the request location, returning
/// the navigation value (path + search + hash, or the full URL for external targets).
pub fn resolve_redirect_target(target: &str, origin: &str, pathname: &str, base_path: Option<&str>) -> ForgeResult<String> {
    let encode = |p: &str| p.replace(':', "%3A");
    let decode = |p: &str| {
        let mut out = String::with_capacity(p.len());
        let mut rest = p;
        while let Some(i) = rest.find('%') {
            out.push_str(&rest[..i]);
            let tail = &rest[i..];
            if tail.len() >= 3 && tail[1..3].eq_ignore_ascii_case("3A") {
                out.push(':');
                rest = &tail[3..];
            } else {
                out.push('%');
                rest = &tail[1..];
            }
        }
        out.push_str(rest);
        out
    };
    let bad = |e: url::ParseError| ForgeError::evaluation(format!("Invalid URL: {e}"));
    if target.starts_with("http://") || target.starts_with("https://") {
        return Ok(url::Url::parse(target).map_err(bad)?.to_string());
    }
    let resolved = if target.starts_with('/') {
        url::Url::parse(origin).map_err(bad)?.join(&encode(target)).map_err(bad)?
    } else {
        let dot_relative = target.starts_with("./") || target.starts_with("../");
        let base = match base_path {
            Some(b) if !dot_relative => format!("{origin}{}/", encode(b)),
            _ => format!("{origin}{}", encode(pathname)),
        };
        url::Url::parse(&base).map_err(bad)?.join(&encode(target)).map_err(bad)?
    };
    let mut value = resolved.path().to_string();
    if let Some(q) = resolved.query() {
        value.push('?');
        value.push_str(q);
    }
    if let Some(f) = resolved.fragment() {
        value.push('#');
        value.push_str(f);
    }
    Ok(decode(&value))
}
