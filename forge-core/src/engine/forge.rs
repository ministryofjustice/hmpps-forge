//! The engine facade (port of `engine/Forge.ts`).

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use crate::builtins;
use crate::engine::concerns::render::Renderer;
use crate::engine::concerns::route::RouteTree;
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::mount::{compile_and_mount_traced, CompilationTrace, ForgeRoute, MountedKind, MountedNode};
use crate::engine::registries::{ComponentEntry, ComponentRegistry, FunctionEntry, FunctionRegistry};
use crate::engine::runtime::pipeline;
use crate::engine::tracing::{self, Instrumentation, InstrumentationSink};
use crate::framework::{Outcome, RecordingResponse, RequestSnapshot, ResponseBindings};
use crate::route_path::normalize_base_path;
use crate::value::Value;

pub const DEFAULT_MAX_ITERATOR_ITERATIONS: usize = 10_000;

#[derive(Clone)]
pub struct ForgeOptions {
    pub disable_built_in_functions: bool,
    pub disable_built_in_components: bool,
    pub base_path: String,
    pub max_iterator_iterations: usize,
    /// Instrumentation sinks (`instrumentation.sinks`): request traces for devtools and the like.
    pub instrumentation: Instrumentation,
}

impl std::fmt::Debug for ForgeOptions {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("ForgeOptions")
            .field("disable_built_in_functions", &self.disable_built_in_functions)
            .field("disable_built_in_components", &self.disable_built_in_components)
            .field("base_path", &self.base_path)
            .field("max_iterator_iterations", &self.max_iterator_iterations)
            .field("instrumentation_enabled", &self.instrumentation.enabled())
            .finish()
    }
}

impl Default for ForgeOptions {
    fn default() -> Self {
        Self {
            disable_built_in_functions: false,
            disable_built_in_components: false,
            base_path: String::new(),
            max_iterator_iterations: DEFAULT_MAX_ITERATOR_ITERATIONS,
            instrumentation: Instrumentation::default(),
        }
    }
}

/// A journey plus the functions and components it brings (`createForgePackage`).
pub struct ForgePackage {
    /// The finalised journey definition (the JSON shape the TS `journey()` builder produces).
    pub journey: Value,
    pub functions: Vec<FunctionEntry>,
    pub components: Vec<ComponentEntry>,
    pub enabled: bool,
}

impl ForgePackage {
    pub fn new(journey: impl Into<Value>) -> Self {
        Self { journey: journey.into(), functions: Vec::new(), components: Vec::new(), enabled: true }
    }

    pub fn with_functions(mut self, functions: impl IntoIterator<Item = FunctionEntry>) -> Self {
        self.functions.extend(functions);
        self
    }

    pub fn with_components(mut self, components: impl IntoIterator<Item = ComponentEntry>) -> Self {
        self.components.extend(components);
        self
    }
}

pub struct Forge {
    options: ForgeOptions,
    functions: FunctionRegistry,
    components: ComponentRegistry,
    base_path: String,
    route_tree: Arc<RwLock<RouteTree>>,
    nodes: HashMap<String, Arc<MountedNode>>,
    route_order: Vec<String>,
}

impl Forge {
    pub fn new(options: ForgeOptions) -> Self {
        let mut functions = FunctionRegistry::new();
        if !options.disable_built_in_functions {
            functions.register_all(builtins::functions()).expect("built-in functions are unique");
        }
        let mut components = ComponentRegistry::new();
        if !options.disable_built_in_components {
            components.register_all(builtins::components::all()).expect("built-in components are unique");
        }
        let base_path = normalize_base_path(Some(&options.base_path));
        Self {
            options,
            functions,
            components,
            base_path,
            route_tree: Arc::new(RwLock::new(RouteTree::default())),
            nodes: HashMap::new(),
            route_order: Vec::new(),
        }
    }

    pub fn register_global_functions(&mut self, entries: impl IntoIterator<Item = FunctionEntry>) -> ForgeResult<&mut Self> {
        self.functions.register_all(entries)?;
        Ok(self)
    }

    pub fn register_global_components(&mut self, entries: impl IntoIterator<Item = ComponentEntry>) -> ForgeResult<&mut Self> {
        self.components.register_all(entries)?;
        Ok(self)
    }

    /// Compiles and mounts a package. Package functions and components are layered over the
    /// global registries for that package only.
    pub fn register_package(&mut self, package: ForgePackage) -> ForgeResult<&mut Self> {
        if !package.enabled {
            return Ok(self);
        }
        let functions = self.functions.scoped(package.functions)?;
        let components = self.components.scoped(package.components)?;
        let instrumentation = &self.options.instrumentation;
        let mut trace = CompilationTrace::new(instrumentation.enabled());
        let compiled =
            compile_and_mount_traced(&package.journey, &functions, &components, &self.base_path, &self.route_tree, &mut trace);
        if instrumentation.enabled() {
            let error = compiled.as_ref().err().filter(|_| !trace.compiled).map(ForgeError::compilation_message);
            if let Some(event) = tracing::project_compilation(&trace.root, trace.journey_code.as_deref(), error.as_deref()) {
                instrumentation.on_compilation_trace(&event);
            }
        }
        let nodes = compiled?;
        for node in nodes {
            self.route_order.push(node.mount_key.clone());
            self.nodes.insert(node.mount_key.clone(), node);
        }
        Ok(self)
    }

    /// `getTopology`: every routable node, steps before journeys within a package.
    pub fn topology(&self) -> Vec<ForgeRoute> {
        self.route_order
            .iter()
            .map(|key| {
                let node = &self.nodes[key];
                let is_step = matches!(node.kind, MountedKind::Step(_));
                ForgeRoute {
                    node_id: node.mount_key.clone(),
                    kind: if is_step { "step" } else { "journey" },
                    template_path: node.template_path.clone(),
                    base_path: node.base_path.clone(),
                    methods: if is_step { &["GET", "POST"] } else { &["GET"] },
                }
            })
            .collect()
    }

    /// Registers an instrumentation sink after construction.
    pub fn add_instrumentation_sink(&mut self, sink: std::sync::Arc<dyn InstrumentationSink>) -> &mut Self {
        self.options.instrumentation.push(sink);
        self
    }

    /// Evaluates one request for the node the snapshot names.
    pub async fn execute(&self, snapshot: &RequestSnapshot, response: Arc<dyn ResponseBindings>) -> ForgeResult<Outcome> {
        let node = self
            .nodes
            .get(snapshot.node_id.as_ref())
            .cloned()
            .ok_or_else(|| ForgeError::evaluation(format!("No node registered for \"{}\"", snapshot.node_id)))?;
        pipeline::evaluate(node, snapshot, response, None, self.options.max_iterator_iterations, &self.options.instrumentation)
            .await
    }

    /// Evaluates one request and renders the page through `renderer`.
    pub async fn execute_with_renderer(
        &self,
        snapshot: &RequestSnapshot,
        response: Arc<dyn ResponseBindings>,
        renderer: Arc<dyn Renderer>,
    ) -> ForgeResult<Outcome> {
        let node = self
            .nodes
            .get(snapshot.node_id.as_ref())
            .cloned()
            .ok_or_else(|| ForgeError::evaluation(format!("No node registered for \"{}\"", snapshot.node_id)))?;
        pipeline::evaluate(
            node,
            snapshot,
            response,
            Some(renderer),
            self.options.max_iterator_iterations,
            &self.options.instrumentation,
        )
        .await
    }

    /// Convenience for callers without response bindings of their own.
    pub async fn execute_recording(&self, snapshot: &RequestSnapshot) -> ForgeResult<(Outcome, Arc<RecordingResponse>)> {
        let response = Arc::new(RecordingResponse::default());
        let outcome = self.execute(snapshot, response.clone()).await?;
        Ok((outcome, response))
    }
}
