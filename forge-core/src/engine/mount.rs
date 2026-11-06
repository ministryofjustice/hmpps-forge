//! Package compilation and mounting (port of `PackageInstance`, `CompilationModelBuilder`,
//! `CodegenOrchestrator` and `MountRegistry`).

use std::sync::{Arc, RwLock};

use crate::engine::analysis::{static_data, FieldModel, FieldModelBuilder, Ownership};
use crate::engine::ast::{AstIndex, Node, NodeFactory, NodeId, NodeKind, Prop};
use crate::engine::concerns::answer_cleardown::CompiledFieldInventory;
use crate::engine::concerns::answer_preparation::CompiledAnswerPreparation;
use crate::engine::concerns::hooks::{CompiledAccessLifecycle, CompiledSubmitHooks};
use crate::engine::concerns::reachability::CompiledReachability;
use crate::engine::concerns::resolve::CompiledResolve;
use crate::engine::concerns::route::{build_route_indexes, CompiledRouteMetadata, RouteTemplateCatalog, RouteTree};
use crate::engine::concerns::validation::{CompiledEntryValidation, CompiledStepValidation};
use crate::engine::errors::{ForgeError, ForgeResult};
use crate::engine::expr::ExprCompiler;
use crate::engine::registries::{ComponentRegistry, FunctionRegistry};
use crate::engine::tracing::{fields, Span};
use crate::value::{Map, Value};

/// Journey-scoped artifacts shared by the journey node and its steps.
pub struct JourneyArtifacts {
    pub reachability: CompiledReachability,
    pub field_inventory: CompiledFieldInventory,
    /// Validating steps' validations, in step order; empty when reachability is disabled.
    pub step_validations: Vec<(NodeId, Arc<CompiledStepValidation>)>,
    pub catalog: Arc<RouteTemplateCatalog>,
}

pub struct StepArtifacts {
    pub submit: CompiledSubmitHooks,
    pub entry_validation: CompiledEntryValidation,
    pub validation: Arc<CompiledStepValidation>,
    pub resolve: CompiledResolve,
    pub template_path: String,
}

pub enum MountedKind {
    Step(StepArtifacts),
    Journey,
}

/// One routable node (`MountedNode`).
pub struct MountedNode {
    pub mount_key: String,
    pub kind: MountedKind,
    pub node_id: NodeId,
    pub journey_code: String,
    pub path: String,
    pub template_path: String,
    pub base_path: String,
    pub components: ComponentRegistry,
    pub static_data: Map,
    pub access: CompiledAccessLifecycle,
    pub answer_preparation: CompiledAnswerPreparation,
    pub journey: Arc<JourneyArtifacts>,
    pub route_metadata: Arc<CompiledRouteMetadata>,
    pub route_tree: Arc<RwLock<RouteTree>>,
}

/// A routable node in the topology (`ForgeRoute`).
#[derive(Clone, Debug)]
pub struct ForgeRoute {
    pub node_id: String,
    pub kind: &'static str,
    pub template_path: String,
    pub base_path: String,
    pub methods: &'static [&'static str],
}

fn chain_root_first(index: &AstIndex, node: &Arc<Node>) -> Vec<Arc<Node>> {
    let mut chain = index.ancestors(&node.id);
    chain.reverse();
    chain.push(node.clone());
    chain
}

fn validating_fields(fields: &[Arc<FieldModel>]) -> Vec<Arc<FieldModel>> {
    fields.iter().filter(|f| f.validation.is_some()).cloned().collect()
}

fn step_validation(step: &Arc<Node>, fields: &[Arc<FieldModel>], exprs: &ExprCompiler<'_>) -> ForgeResult<(bool, CompiledStepValidation)> {
    let validating = validating_fields(fields);
    let domain = crate::engine::analysis::compile_rules(exprs, step.prop("validWhen"))?;
    let has_validation = validating.iter().any(|f| f.iterator_path.is_empty()) || domain.is_some();
    Ok((has_validation, CompiledStepValidation { fields: validating, domain }))
}

/// The compilation trace's view of one `compile_and_mount` run: the `compilation.pipeline` root
/// span and the journey code once the AST phase has read it.
pub struct CompilationTrace {
    pub root: Span,
    pub journey_code: Option<String>,
    /// Set once every compilation phase has run. Mounting can still fail afterwards (a route
    /// clash), which in TS happens outside the compilation pipeline.
    pub compiled: bool,
}

impl CompilationTrace {
    pub fn new(enabled: bool) -> Self {
        Self {
            root: if enabled { Span::root("compilation", "compilation.pipeline") } else { Span::disabled() },
            journey_code: None,
            compiled: false,
        }
    }

    /// Lowering units (one `codegen.journey` per journey owning steps, with its `codegen.step`
    /// units), then the `routes` phase and the root.
    fn finish(&mut self, lowering: &Span, index: &AstIndex, ownership: &Ownership) {
        for id in index.order.iter().filter(|id| index.nodes[*id].kind == NodeKind::Journey) {
            let steps = ownership.steps_of(id);
            if steps.is_empty() {
                continue;
            }
            let journey =
                lowering.child(format!("journey:{id}"), "codegen.journey", || fields([("nodeId", Value::String(id.clone()))]));
            for step in steps {
                journey.child(format!("step:{}", step.id), "codegen.step", || fields([("nodeId", Value::String(step.id.clone()))])).done();
            }
            journey.done();
        }
        lowering.done();
        self.phase("routes").done();
        self.root.done();
        self.compiled = true;
    }

    fn phase(&self, name: &str) -> Span {
        self.root.open(name, &format!("compilation.{name}"))
    }
}

/// Compiles one package's journey and mounts its steps and journeys.
pub fn compile_and_mount(
    journey_json: &Value,
    functions: &FunctionRegistry,
    components: &ComponentRegistry,
    base_path: &str,
    route_tree: &Arc<RwLock<RouteTree>>,
) -> ForgeResult<Vec<Arc<MountedNode>>> {
    compile_and_mount_traced(journey_json, functions, components, base_path, route_tree, &mut CompilationTrace::new(false))
}

/// [`compile_and_mount`], recording the TS compilation phases (`CompilationPipelineBootstrap`
/// order: dsl-validation, ast, semantic-analysis, analysis, lowering, routes) into `trace`.
/// Rust inserts routes before code generation, so the `routes` span is opened last but its
/// work ran earlier; the lowering units are built from the compiled journeys and steps.
pub fn compile_and_mount_traced(
    journey_json: &Value,
    functions: &FunctionRegistry,
    components: &ComponentRegistry,
    base_path: &str,
    route_tree: &Arc<RwLock<RouteTree>>,
    trace: &mut CompilationTrace,
) -> ForgeResult<Vec<Arc<MountedNode>>> {
    let phase = trace.phase("dsl-validation");
    crate::engine::dsl::validate(journey_json)?;
    phase.done();

    let phase = trace.phase("ast");
    let root = NodeFactory::for_root(journey_json).create_node(journey_json)?;
    if root.kind != NodeKind::Journey {
        return Err(ForgeError::Authoring { message: "A package must be built around a journey".into() });
    }
    let journey_code = root.str_prop("code").unwrap_or_default().to_string();
    trace.journey_code = Some(journey_code.clone());
    let index = AstIndex::build(&root);
    phase.done();

    let phase = trace.phase("semantic-analysis");
    crate::engine::semantic::validate(&index, functions, components)?;
    phase.done();

    let phase = trace.phase("analysis");
    let exprs = ExprCompiler::new(functions);
    let ownership = Ownership::build(&index);
    let builder = FieldModelBuilder { components, exprs: &exprs };

    // Step fields, in AST order.
    let mut step_fields = std::collections::HashMap::new();
    for id in &index.order {
        let node = &index.nodes[id];
        if node.kind == NodeKind::Step {
            step_fields.insert(id.clone(), builder.build_step_fields(ownership.fields_of(id), ownership.map_iterates_of(id))?);
        }
    }

    phase.done();

    let lowering = trace.phase("lowering");
    let route_metadata = Arc::new(CompiledRouteMetadata::compile(&index, &exprs)?);
    lowering.open("package-functions", "codegen.package-functions").done();
    let (journey_routes, step_routes) = build_route_indexes(&index);
    let inserted = route_tree.write().unwrap().insert_package(base_path, &journey_routes, &step_routes);
    let (journey_contexts, step_contexts) = match inserted {
        Ok(contexts) => contexts,
        Err(e) => {
            trace.finish(&lowering, &index, &ownership);
            return Err(e);
        }
    };

    let catalog_for = |journey_base: &str| -> Arc<RouteTemplateCatalog> {
        route_tree.read().unwrap().catalogs.get(journey_base).cloned().unwrap_or_default()
    };

    // Journey artifacts.
    let mut journeys = std::collections::HashMap::new();
    let mut journey_nodes = Vec::new();
    for id in &index.order {
        let journey = &index.nodes[id];
        if journey.kind != NodeKind::Journey {
            continue;
        }
        let steps = ownership.steps_of(id).to_vec();
        let disabled = chain_root_first(&index, journey)
            .iter()
            .rev()
            .filter(|n| n.kind == NodeKind::Journey)
            .find_map(|n| {
                n.prop("reachability")
                    .and_then(Prop::as_object)
                    .and_then(|r| r.get("disableReachabilityChecks"))
                    .and_then(Prop::as_lit)
                    .and_then(Value::as_bool)
            })
            .unwrap_or(false);
        let reachability = CompiledReachability::compile(journey, &steps, disabled, &exprs)?;
        let field_inventory = CompiledFieldInventory::new(
            steps
                .iter()
                .map(|s| {
                    let codes = s
                        .prop("cleardownFieldCodes")
                        .and_then(Prop::as_array)
                        .unwrap_or_default()
                        .iter()
                        .filter_map(|p| p.as_lit().map(Value::to_js_string))
                        .collect();
                    (s.id.clone(), step_fields.get(&s.id).cloned().unwrap_or_default(), codes)
                })
                .collect(),
        );
        let mut step_validations = Vec::new();
        if !disabled {
            for s in &steps {
                let (has, compiled) = step_validation(s, step_fields.get(&s.id).map(Vec::as_slice).unwrap_or_default(), &exprs)?;
                if has {
                    step_validations.push((s.id.clone(), Arc::new(compiled)));
                }
            }
        }
        // The catalog is keyed by the journey's own template path.
        let template_path = journey_contexts.iter().find(|c| &c.journey_id == id).map(|c| c.template_path.clone()).unwrap_or_default();
        let artifacts = Arc::new(JourneyArtifacts {
            reachability,
            field_inventory,
            step_validations,
            catalog: catalog_for(&template_path),
        });
        journeys.insert(id.clone(), artifacts.clone());
        let has_catalog = route_tree.read().unwrap().catalogs.contains_key(&template_path);
        if has_catalog {
            let all_fields: Vec<Arc<FieldModel>> =
                steps.iter().flat_map(|s| step_fields.get(&s.id).cloned().unwrap_or_default()).collect();
            journey_nodes.push(Arc::new(MountedNode {
                mount_key: format!("{journey_code}::{id}"),
                kind: MountedKind::Journey,
                node_id: id.clone(),
                journey_code: journey_code.clone(),
                path: crate::route_path::normalize_relative_path(journey.str_prop("path").unwrap_or_default()),
                template_path: template_path.clone(),
                base_path: template_path.clone(),
                components: components.clone(),
                static_data: static_data(&index, journey),
                access: CompiledAccessLifecycle::compile(&chain_root_first(&index, journey), &exprs)?,
                answer_preparation: CompiledAnswerPreparation { fields: all_fields },
                journey: artifacts,
                route_metadata: route_metadata.clone(),
                route_tree: route_tree.clone(),
            }));
        }
    }

    // Step nodes (mounted first, so a step that shares a journey's path wins route matching).
    let mut nodes = Vec::new();
    for sc in &step_contexts {
        let step = index.get(&sc.step_id).cloned().ok_or_else(|| ForgeError::evaluation("Unknown step"))?;
        let parent = index.parent(&sc.step_id).cloned().ok_or_else(|| ForgeError::evaluation("Step has no journey"))?;
        let journey = journeys.get(&parent.id).cloned().ok_or_else(|| ForgeError::evaluation("Journey not compiled"))?;
        let fields = step_fields.get(&sc.step_id).cloned().unwrap_or_default();
        let validation = match journey.step_validations.iter().find(|(id, _)| id == &sc.step_id) {
            Some((_, v)) => v.clone(),
            None => Arc::new(step_validation(&step, &fields, &exprs)?.1),
        };
        let entries = step
            .prop("validateOnEntry")
            .and_then(Prop::as_array)
            .unwrap_or_default()
            .iter()
            .filter_map(Prop::as_object)
            .map(|e| {
                let groups = e
                    .get("groups")
                    .and_then(Prop::as_array)
                    .unwrap_or_default()
                    .iter()
                    .filter_map(|g| g.as_lit().map(Value::to_js_string))
                    .collect();
                let when = match e.get("when") {
                    Some(Prop::Node(n)) => Some(exprs.node(n)),
                    _ => None,
                }
                .transpose()?;
                Ok((groups, when))
            })
            .collect::<ForgeResult<Vec<_>>>()?;
        let chain = chain_root_first(&index, &step);
        let ancestor_journeys: Vec<Arc<Node>> = chain[..chain.len() - 1].iter().filter(|n| n.kind == NodeKind::Journey).cloned().collect();
        nodes.push(Arc::new(MountedNode {
            mount_key: format!("{journey_code}::{}", sc.step_id),
            kind: MountedKind::Step(StepArtifacts {
                submit: CompiledSubmitHooks::compile(&step, &exprs)?,
                entry_validation: CompiledEntryValidation { entries },
                validation,
                resolve: CompiledResolve::compile(&step, &ancestor_journeys, ownership.all_iterates_of(&sc.step_id), &exprs)?,
                template_path: sc.route_template_path.clone(),
            }),
            node_id: sc.step_id.clone(),
            journey_code: journey_code.clone(),
            path: crate::route_path::normalize_relative_path(&sc.path),
            template_path: sc.route_template_path.clone(),
            base_path: sc.journey_base_path.clone(),
            components: components.clone(),
            static_data: static_data(&index, &step),
            access: CompiledAccessLifecycle::compile(&chain, &exprs)?,
            answer_preparation: CompiledAnswerPreparation { fields },
            journey,
            route_metadata: route_metadata.clone(),
            route_tree: route_tree.clone(),
        }));
    }
    nodes.extend(journey_nodes);
    trace.finish(&lowering, &index, &ownership);
    Ok(nodes)
}
