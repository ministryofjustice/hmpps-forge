//! Reachability (port of `concerns/reachability`).
//!
//! The facts half evaluates each step's authored reachability expressions (entry predicates,
//! forward redirect outcomes, tie-breakers, the resume condition). The state half walks the
//! journey graph over those facts: BFS from entry points through valid steps' forward outcomes,
//! then the canonical path, frontier and resume outcome. Runtime turns the result into a redirect
//! or lets the request continue.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use crate::engine::ast::{ExprKind, Node, NodeId, NodeKind, OutcomeKind, Prop};
use crate::engine::concerns::answer_cleardown::StepFieldInventory;
use crate::engine::concerns::route::RouteTemplateCatalog;
use crate::engine::errors::ForgeResult;
use crate::engine::expr::{ExprCompiler, Expr, Scope};
use crate::engine::runtime::context::SharedContext;
use crate::route_path::resolve_path_params;
use crate::value::Value;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum UnreachableRedirect {
    Entry,
    Frontier,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ResumeOutcome {
    NoOp,
    Redirect,
}

/// One step in the reachability walk (`ReachabilityNode`).
#[derive(Clone, Debug)]
pub struct ReachabilityNode {
    pub step_id: NodeId,
    pub route_template_path: String,
    pub code: Option<String>,
    pub declaration_index: usize,
    pub is_entry_point: bool,
    pub is_conditional_entry: bool,
    pub has_validation: bool,
    pub is_reachable: bool,
    pub is_valid: bool,
    pub forward_route_template_paths: Vec<String>,
    pub declared_forward_route_template_paths: Vec<String>,
    pub predecessor_route_template_paths: Vec<String>,
    pub tie_breaker_priority: Option<f64>,
}

impl ReachabilityNode {
    fn is_active_entry(&self) -> bool {
        self.is_entry_point || self.is_conditional_entry
    }
}

/// `ReachabilityEvaluation`.
#[derive(Clone, Debug)]
pub struct ReachabilityEvaluation {
    pub current_step_id: Option<NodeId>,
    pub steps: Vec<ReachabilityNode>,
    pub default_entry_route_template_path: Option<String>,
    pub frontier_route_template_path: Option<String>,
    pub canonical_path_route_template_paths: Vec<String>,
    pub progress_exists: bool,
    pub resume_active: bool,
    pub resume_outcome: ResumeOutcome,
    pub unreachable_redirect: UnreachableRedirect,
}

/// `StepReachabilityProjection`.
#[derive(Clone, Debug, Default)]
pub struct StepReachabilityProjection {
    pub path: String,
    pub code: Option<String>,
    pub field_codes: Vec<String>,
    pub cleardown_field_codes: Vec<String>,
    pub back_path: Option<String>,
}

/// `JourneyReachabilityProjection`.
#[derive(Clone, Debug, Default)]
pub struct JourneyReachabilityProjection {
    pub reachable_steps: Vec<StepReachabilityProjection>,
    pub unreachable_steps: Vec<StepReachabilityProjection>,
}

/// A forward redirect outcome of a submit hook (`ForwardRedirectOutcome`).
struct ForwardOutcome {
    when: Option<Expr>,
    goto: Goto,
    over_approximates_when: bool,
}

enum Goto {
    Static(String),
    Dynamic(Expr),
    /// A goto that is neither a string nor a compilable node.
    None,
}

struct ForwardOutcomeGroup {
    hook_when: Option<Expr>,
    outcomes: Vec<ForwardOutcome>,
}

struct Entry {
    step_id: NodeId,
    code: Option<String>,
    is_entry_point: bool,
    entry_when: Option<Expr>,
    forward_groups: Vec<ForwardOutcomeGroup>,
    tie_breakers: Vec<(f64, Option<Expr>)>,
}

/// The compiled reachability for one journey (facts + state table).
pub struct CompiledReachability {
    entries: Vec<Entry>,
    resume_always: bool,
    resume_when: Option<Expr>,
    unreachable_redirect: UnreachableRedirect,
    disabled: bool,
}

/// `CompiledReachabilityResult`.
struct Facts {
    entry_results: Vec<Option<bool>>,
    outcome_values: Vec<Vec<String>>,
    declared_outcome_values: Vec<Vec<String>>,
    tie_breaker_priorities: Vec<Option<f64>>,
    resume_active: bool,
}

const REQUEST_TIME_NAMESPACES: &[&str] = &["post", "params", "query", "request"];

/// `RequestTimeReferenceAnalyzer.containsRequestTimeReference`. Template nodes are walked as
/// plain records, so their references are not detected (matching TS).
fn contains_request_time_reference(node: &Node) -> bool {
    if !node.template && node.expr_kind() == Some(ExprKind::Reference) {
        let root = node.prop("path").and_then(Prop::as_array).and_then(|p| p.first()).and_then(Prop::as_str);
        if root.is_some_and(|r| REQUEST_TIME_NAMESPACES.contains(&r)) {
            return true;
        }
    }
    node.props.values().any(prop_contains_request_time_reference)
}

fn prop_contains_request_time_reference(prop: &Prop) -> bool {
    match prop {
        Prop::Lit(_) => false,
        Prop::Array(items) => items.iter().any(prop_contains_request_time_reference),
        Prop::Object(o) => o.values().any(prop_contains_request_time_reference),
        Prop::Node(n) => contains_request_time_reference(n),
    }
}

impl CompiledReachability {
    /// `ReachabilityAnalyzer.analyzeJourney` + `ReachabilityCompiler.compileFacts`.
    pub fn compile(
        journey: &Arc<Node>,
        steps: &[Arc<Node>],
        disabled: bool,
        exprs: &ExprCompiler<'_>,
    ) -> ForgeResult<Self> {
        let mut entries = Vec::new();
        for step in steps {
            let reach = step.prop("reachability").and_then(Prop::as_object);
            let entry_when = reach.and_then(|r| r.get("entryWhen"));
            let is_entry_point = entry_when.and_then(Prop::as_lit).is_some_and(|v| v.strict_eq(&Value::Bool(true)));
            let entry_when = match entry_when {
                Some(Prop::Node(n)) => Some(exprs.node(n)?),
                _ => None,
            };
            let mut tie_breakers = Vec::new();
            for tb in reach.and_then(|r| r.get("tieBreakers")).and_then(Prop::as_array).unwrap_or_default() {
                let Some(tb) = tb.as_node() else { continue };
                let priority = tb.prop("priority").and_then(Prop::as_lit).and_then(Value::as_f64).unwrap_or(0.0);
                let when = match tb.node_prop("when") {
                    Some(w) => Some(exprs.node(w)?),
                    None => None,
                };
                tie_breakers.push((priority, when));
            }
            entries.push(Entry {
                step_id: step.id.clone(),
                code: step.str_prop("code").map(str::to_string),
                is_entry_point,
                entry_when,
                forward_groups: forward_groups(step, exprs)?,
                tie_breakers,
            });
        }
        let reach = journey.prop("reachability").and_then(Prop::as_object);
        let resume = reach.and_then(|r| r.get("resumeWhen"));
        let resume_always = resume.and_then(Prop::as_lit).is_some_and(|v| v.strict_eq(&Value::Bool(true)));
        let resume_when = match resume {
            Some(Prop::Node(n)) => Some(exprs.node(n)?),
            _ => None,
        };
        let unreachable_redirect = match reach.and_then(|r| r.get("unreachableRedirect")).and_then(Prop::as_str) {
            Some("frontier") => UnreachableRedirect::Frontier,
            _ => UnreachableRedirect::Entry,
        };
        Ok(Self { entries, resume_always, resume_when, unreachable_redirect, disabled })
    }

    pub fn step_ids(&self) -> impl Iterator<Item = &NodeId> {
        self.entries.iter().map(|e| &e.step_id)
    }

    async fn facts(&self, ctx: &SharedContext) -> ForgeResult<Facts> {
        let n = self.entries.len();
        let mut facts = Facts {
            entry_results: vec![None; n],
            outcome_values: vec![Vec::new(); n],
            declared_outcome_values: vec![Vec::new(); n],
            tie_breaker_priorities: vec![None; n],
            resume_active: false,
        };
        let mut scope = Scope::new(ctx.clone());
        for (i, entry) in self.entries.iter().enumerate() {
            if let Some(w) = &entry.entry_when {
                facts.entry_results[i] = Some(w.eval(&mut scope).await?.truthy());
            }
        }
        for (i, entry) in self.entries.iter().enumerate() {
            for group in &entry.forward_groups {
                for outcome in &group.outcomes {
                    if let Goto::Static(g) = &outcome.goto {
                        facts.declared_outcome_values[i].push(g.clone());
                    }
                }
                if let Some(hw) = &group.hook_when
                    && !hw.eval(&mut scope).await?.truthy()
                {
                    continue;
                }
                let values = &mut facts.outcome_values[i];
                if group.outcomes.iter().all(|o| matches!(o.goto, Goto::Static(_))) {
                    static_chain(&group.outcomes, values, &mut scope).await?;
                } else {
                    let mut matched = false;
                    for outcome in &group.outcomes {
                        if matched {
                            continue;
                        }
                        match (&outcome.when, outcome.over_approximates_when) {
                            (Some(w), false) => {
                                if w.eval(&mut scope).await?.truthy() {
                                    matched |= resolve_goto(&outcome.goto, values, &mut scope).await?;
                                }
                            }
                            (_, over) => {
                                let pushed = resolve_goto(&outcome.goto, values, &mut scope).await?;
                                if !over {
                                    matched |= pushed;
                                }
                            }
                        }
                    }
                }
            }
        }
        for (i, entry) in self.entries.iter().enumerate() {
            for (priority, when) in &entry.tie_breakers {
                match when {
                    None => {
                        facts.tie_breaker_priorities[i] = Some(*priority);
                        break;
                    }
                    Some(w) => {
                        if w.eval(&mut scope).await?.truthy() {
                            facts.tie_breaker_priorities[i] = Some(*priority);
                            break;
                        }
                    }
                }
            }
        }
        facts.resume_active = if self.resume_always {
            true
        } else if let Some(w) = &self.resume_when {
            w.eval(&mut scope).await?.truthy()
        } else {
            false
        };
        Ok(facts)
    }

    /// Runs facts then state (`RequestReachabilityWorkHandler` minus the redirect decision).
    pub async fn evaluate(
        &self,
        ctx: &SharedContext,
        catalog: &RouteTemplateCatalog,
        current_step_id: Option<&NodeId>,
        step_validities: &HashMap<NodeId, bool>,
        projection_input: Option<(&[StepFieldInventory], &Value)>,
    ) -> ForgeResult<(ReachabilityEvaluation, Option<JourneyReachabilityProjection>)> {
        let facts = self.facts(ctx).await?;
        let mut builder = GraphBuilder::new(self, catalog, &facts, step_validities);
        builder.build();
        let default_entry = builder.default_entry();
        let steps = builder.steps;
        let analysis = analyze_paths(&steps, current_step_id, default_entry.as_deref(), facts.resume_active);
        let resume_outcome = resolve_resume_outcome(
            &steps,
            current_step_id,
            facts.resume_active,
            analysis.progress_exists,
            analysis.frontier.as_deref(),
        );
        let evaluation = ReachabilityEvaluation {
            current_step_id: current_step_id.cloned(),
            steps,
            default_entry_route_template_path: default_entry,
            frontier_route_template_path: analysis.frontier,
            canonical_path_route_template_paths: analysis.canonical,
            progress_exists: analysis.progress_exists,
            resume_active: facts.resume_active,
            resume_outcome,
            unreachable_redirect: self.unreachable_redirect,
        };
        let projection = projection_input.map(|(inventory, params)| project(&evaluation, inventory, params));
        Ok((evaluation, projection))
    }
}

/// `compileStaticOutcomeChain`.
async fn static_chain(outcomes: &[ForwardOutcome], values: &mut Vec<String>, scope: &mut Scope) -> ForgeResult<()> {
    for outcome in outcomes {
        let Goto::Static(goto) = &outcome.goto else { continue };
        if outcome.over_approximates_when {
            values.push(goto.clone());
            continue;
        }
        match &outcome.when {
            Some(w) => {
                if w.eval(scope).await?.truthy() {
                    values.push(goto.clone());
                    return Ok(());
                }
            }
            None => {
                values.push(goto.clone());
                return Ok(());
            }
        }
    }
    Ok(())
}

/// `compileGotoResolution`: pushes a defined goto; returns whether one was pushed.
async fn resolve_goto(goto: &Goto, values: &mut Vec<String>, scope: &mut Scope) -> ForgeResult<bool> {
    let value = match goto {
        Goto::Static(g) => Value::from(g.as_str()),
        Goto::Dynamic(e) => e.eval(scope).await?,
        Goto::None => return Ok(false),
    };
    if value.is_undefined() {
        return Ok(false);
    }
    values.push(value.to_js_string());
    Ok(true)
}

/// `ForwardNavigationAnalyzer.analyze`.
fn forward_groups(step: &Arc<Node>, exprs: &ExprCompiler<'_>) -> ForgeResult<Vec<ForwardOutcomeGroup>> {
    let mut groups = Vec::new();
    for hook in step.children("onSubmission") {
        let branch_next = |key: &str| -> Vec<Arc<Node>> {
            hook.prop(key)
                .and_then(Prop::as_object)
                .and_then(|b| b.get("next"))
                .and_then(Prop::as_array)
                .unwrap_or_default()
                .iter()
                .filter_map(|p| p.as_node().filter(|n| n.kind == NodeKind::Outcome(OutcomeKind::Redirect)).cloned())
                .collect()
        };
        let validate = hook.prop("validate").and_then(Prop::as_lit).is_some_and(Value::truthy);
        let mut redirects = branch_next("onAlways");
        if validate {
            redirects.extend(branch_next("onValid"));
        }
        let mut outcomes = Vec::new();
        for r in &redirects {
            let when_node = r.node_prop("when");
            let over = when_node.is_some_and(|w| contains_request_time_reference(w));
            outcomes.push(ForwardOutcome {
                when: match when_node {
                    Some(w) => Some(exprs.node(w)?),
                    None => None,
                },
                goto: match r.prop("goto") {
                    Some(Prop::Lit(Value::String(s))) => Goto::Static(s.to_string()),
                    Some(Prop::Node(n)) => Goto::Dynamic(exprs.node(n)?),
                    _ => Goto::None,
                },
                over_approximates_when: over,
            });
        }
        if outcomes.is_empty() {
            continue;
        }
        let hook_when = match hook.node_prop("when") {
            Some(w) if !contains_request_time_reference(w) => Some(exprs.node(w)?),
            _ => None,
        };
        groups.push(ForwardOutcomeGroup { hook_when, outcomes });
    }
    Ok(groups)
}

/// `resolveRouteTemplateTargetPath`: a redirect target relative to the current route template.
pub fn resolve_route_template_target_path(target: &str, current: &str) -> Option<String> {
    if target.starts_with("http://") || target.starts_with("https://") || target.starts_with("//") {
        return None;
    }
    let path_only = match target.find(['?', '#']) {
        Some(i) => &target[..i],
        None => target,
    };
    let split = |p: &str| p.split('/').filter(|s| !s.is_empty()).map(str::to_string).collect::<Vec<_>>();
    let mut segments = if path_only.starts_with('/') {
        Vec::new()
    } else {
        let mut base = split(current);
        if !current.ends_with('/') {
            base.pop();
        }
        base
    };
    for segment in split(path_only) {
        match segment.as_str() {
            "." => {}
            ".." => {
                segments.pop();
            }
            _ => segments.push(segment),
        }
    }
    Some(format!("/{}", segments.join("/")))
}

/// `pickTieBreakerWinner`: highest priority wins; ties keep the earliest candidate.
fn pick_winner<'a>(candidates: impl IntoIterator<Item = &'a ReachabilityNode>) -> Option<&'a ReachabilityNode> {
    candidates.into_iter().reduce(|best, c| {
        let bp = best.tie_breaker_priority.unwrap_or(f64::NEG_INFINITY);
        let cp = c.tie_breaker_priority.unwrap_or(f64::NEG_INFINITY);
        if cp > bp { c } else { best }
    })
}

/// `ReachabilityGraphBuilder`.
struct GraphBuilder<'a> {
    plan: &'a CompiledReachability,
    catalog: &'a RouteTemplateCatalog,
    facts: &'a Facts,
    validities: &'a HashMap<NodeId, bool>,
    steps: Vec<ReachabilityNode>,
    by_path: HashMap<String, usize>,
}

impl<'a> GraphBuilder<'a> {
    fn new(
        plan: &'a CompiledReachability,
        catalog: &'a RouteTemplateCatalog,
        facts: &'a Facts,
        validities: &'a HashMap<NodeId, bool>,
    ) -> Self {
        let steps: Vec<ReachabilityNode> = plan
            .entries
            .iter()
            .enumerate()
            .map(|(i, e)| ReachabilityNode {
                step_id: e.step_id.clone(),
                route_template_path: catalog.path_of(&e.step_id).unwrap_or_default().to_string(),
                code: e.code.clone(),
                declaration_index: i,
                is_entry_point: e.is_entry_point,
                is_conditional_entry: false,
                has_validation: validities.contains_key(&e.step_id),
                is_reachable: false,
                is_valid: true,
                forward_route_template_paths: Vec::new(),
                declared_forward_route_template_paths: Vec::new(),
                predecessor_route_template_paths: Vec::new(),
                tie_breaker_priority: None,
            })
            .collect();
        let by_path = steps.iter().enumerate().map(|(i, s)| (s.route_template_path.clone(), i)).collect();
        Self { plan, catalog, facts, validities, steps, by_path }
    }

    fn build(&mut self) {
        if self.plan.disabled {
            self.steps.iter_mut().for_each(|s| s.is_reachable = true);
        } else {
            for (i, e) in self.plan.entries.iter().enumerate() {
                if e.is_entry_point {
                    self.steps[i].is_reachable = true;
                }
                if self.facts.entry_results[i] == Some(true) {
                    self.steps[i].is_reachable = true;
                    self.steps[i].is_conditional_entry = true;
                }
            }
            self.walk();
            self.populate_unvisited_forward_paths();
        }
        for i in 0..self.steps.len() {
            self.steps[i].declared_forward_route_template_paths = self.resolve_declared_forward_paths(i);
        }
        for i in 0..self.steps.len() {
            if self.steps[i].is_reachable {
                self.steps[i].tie_breaker_priority = self.facts.tie_breaker_priorities[i];
            }
        }
    }

    fn resolve_paths(&self, outcomes: &[String], current: &str) -> Vec<String> {
        let mut out: Vec<String> = Vec::new();
        for o in outcomes {
            if let Some(p) = resolve_route_template_target_path(o, current)
                && self.catalog.step_at(&p).is_some()
                && !out.contains(&p)
            {
                out.push(p);
            }
        }
        out
    }

    fn resolve_forward_paths(&self, i: usize) -> Vec<String> {
        self.resolve_paths(&self.facts.outcome_values[i], &self.steps[i].route_template_path)
    }

    fn resolve_declared_forward_paths(&self, i: usize) -> Vec<String> {
        if self.facts.declared_outcome_values[i].is_empty() {
            return self.resolve_forward_paths(i);
        }
        self.resolve_paths(&self.facts.declared_outcome_values[i], &self.steps[i].route_template_path)
    }

    fn walk(&mut self) {
        let mut queue: Vec<String> =
            self.steps.iter().filter(|s| s.is_reachable).map(|s| s.route_template_path.clone()).collect();
        let mut enqueued: HashSet<String> = queue.iter().cloned().collect();
        let mut qi = 0;
        while qi < queue.len() {
            let Some(&ci) = self.by_path.get(&queue[qi]) else {
                qi += 1;
                continue;
            };
            qi += 1;
            self.steps[ci].is_valid = self.validities.get(&self.steps[ci].step_id).copied().unwrap_or(true);
            self.steps[ci].forward_route_template_paths = self.resolve_forward_paths(ci);
            let current_path = self.steps[ci].route_template_path.clone();
            let current_valid = self.steps[ci].is_valid;
            for fwd in self.steps[ci].forward_route_template_paths.clone() {
                let Some(&ni) = self.by_path.get(&fwd) else { continue };
                if !self.steps[ni].predecessor_route_template_paths.contains(&current_path) {
                    self.steps[ni].predecessor_route_template_paths.push(current_path.clone());
                }
                if !current_valid {
                    continue;
                }
                self.steps[ni].is_reachable = true;
                if enqueued.insert(fwd.clone()) {
                    queue.push(fwd);
                }
            }
        }
    }

    fn populate_unvisited_forward_paths(&mut self) {
        for i in 0..self.steps.len() {
            if !self.steps[i].forward_route_template_paths.is_empty() {
                continue;
            }
            self.steps[i].forward_route_template_paths = self.resolve_forward_paths(i);
            let current_path = self.steps[i].route_template_path.clone();
            for fwd in self.steps[i].forward_route_template_paths.clone() {
                if let Some(&ni) = self.by_path.get(&fwd)
                    && !self.steps[ni].predecessor_route_template_paths.contains(&current_path)
                {
                    self.steps[ni].predecessor_route_template_paths.push(current_path.clone());
                }
            }
        }
    }

    fn default_entry(&self) -> Option<String> {
        pick_winner(self.steps.iter().filter(|s| s.is_active_entry()))
            .or(self.steps.first())
            .map(|s| s.route_template_path.clone())
    }
}

struct PathAnalysis {
    canonical: Vec<String>,
    frontier: Option<String>,
    progress_exists: bool,
}

fn counts_as_progress(s: &ReachabilityNode) -> bool {
    s.is_reachable && s.has_validation && s.is_valid
}

/// `ReachabilityPathAnalyzer.analyze`.
fn analyze_paths(
    steps: &[ReachabilityNode],
    current_step_id: Option<&NodeId>,
    default_entry: Option<&str>,
    resume_active: bool,
) -> PathAnalysis {
    let by_path: HashMap<&str, &ReachabilityNode> = steps.iter().map(|s| (s.route_template_path.as_str(), s)).collect();
    let progress_exists = steps.iter().any(counts_as_progress);

    let forward_path = |start: &'_ ReachabilityNode| -> Vec<ReachabilityNode> {
        let mut path = vec![start.clone()];
        let mut visited = HashSet::from([start.route_template_path.clone()]);
        let mut current = start.clone();
        while current.is_valid && !current.forward_route_template_paths.is_empty() {
            let successors = current
                .forward_route_template_paths
                .iter()
                .filter_map(|p| by_path.get(p.as_str()).copied())
                .filter(|s| s.is_reachable);
            let Some(next) = pick_winner(successors) else { break };
            if visited.contains(&next.route_template_path) {
                break;
            }
            visited.insert(next.route_template_path.clone());
            path.push(next.clone());
            current = next.clone();
        }
        path
    };
    let path_from_anchor = |anchor: &ReachabilityNode| -> Vec<ReachabilityNode> {
        if !anchor.is_reachable { vec![anchor.clone()] } else { forward_path(anchor) }
    };

    let default_path = default_entry.and_then(|p| by_path.get(p)).map(|a| path_from_anchor(a)).unwrap_or_default();

    let resume_path = {
        let mut best: Option<(ReachabilityNode, Vec<ReachabilityNode>, isize)> = None;
        for entry in steps.iter().filter(|s| s.is_active_entry()) {
            let path = path_from_anchor(entry);
            let depth = path.iter().rposition(counts_as_progress).map_or(-1, |i| i as isize);
            if depth < 0 {
                continue;
            }
            best = Some(match best {
                None => (entry.clone(), path, depth),
                Some((be, bp, bd)) => {
                    if depth != bd {
                        if depth > bd { (entry.clone(), path, depth) } else { (be, bp, bd) }
                    } else if pick_winner([&be, entry]).is_some_and(|w| w.route_template_path == entry.route_template_path) {
                        (entry.clone(), path, depth)
                    } else {
                        (be, bp, bd)
                    }
                }
            });
        }
        best.map(|(_, p, _)| p)
    };

    let canonical = if resume_active && resume_path.is_some() {
        resume_path.unwrap_or_default()
    } else {
        let through_current = current_step_id
            .and_then(|id| steps.iter().find(|s| &s.step_id == id))
            .filter(|s| s.is_reachable)
            .map(|current| {
                let mut path = vec![current.clone()];
                let mut visited = HashSet::from([current.route_template_path.clone()]);
                let mut cur = current.clone();
                while !cur.is_active_entry() && !cur.predecessor_route_template_paths.is_empty() {
                    let preds = cur.predecessor_route_template_paths.iter().filter_map(|p| by_path.get(p.as_str()).copied());
                    let Some(prev) = pick_winner(preds) else { break };
                    if visited.contains(&prev.route_template_path) {
                        break;
                    }
                    visited.insert(prev.route_template_path.clone());
                    path.insert(0, prev.clone());
                    cur = prev.clone();
                }
                let from = forward_path(current);
                path.extend(from.into_iter().skip(1));
                path
            })
            .unwrap_or_default();
        if through_current.is_empty() { default_path } else { through_current }
    };

    let frontier = {
        let non_entry: Vec<&ReachabilityNode> = canonical.iter().filter(|s| !s.is_active_entry()).collect();
        if let Some(first_invalid) = non_entry.iter().find(|s| !s.is_valid) {
            Some(first_invalid.route_template_path.clone())
        } else {
            let has_progress = non_entry.iter().any(|s| s.has_validation && s.is_valid);
            match non_entry.last() {
                Some(t) if has_progress && !(t.has_validation && t.is_valid) => Some(t.route_template_path.clone()),
                _ => None,
            }
        }
    };

    PathAnalysis {
        canonical: canonical.into_iter().map(|s| s.route_template_path).collect(),
        frontier,
        progress_exists,
    }
}

fn resolve_resume_outcome(
    steps: &[ReachabilityNode],
    current: Option<&NodeId>,
    resume_active: bool,
    progress_exists: bool,
    frontier: Option<&str>,
) -> ResumeOutcome {
    let Some(frontier) = frontier.filter(|f| !f.is_empty()) else { return ResumeOutcome::NoOp };
    if !resume_active || !progress_exists {
        return ResumeOutcome::NoOp;
    }
    let Some(current) = current else { return ResumeOutcome::Redirect };
    match steps.iter().find(|s| &s.step_id == current) {
        None => ResumeOutcome::NoOp,
        Some(s) if s.route_template_path == frontier => ResumeOutcome::NoOp,
        Some(_) => ResumeOutcome::Redirect,
    }
}

fn back_path(step: &ReachabilityNode, canonical: &[String]) -> Option<String> {
    let i = canonical.iter().position(|p| p == &step.route_template_path)?;
    (i > 0).then(|| canonical[i - 1].clone())
}

/// `ReachabilityStateProjector.project`.
fn project(evaluation: &ReachabilityEvaluation, inventory: &[StepFieldInventory], params: &Value) -> JourneyReachabilityProjection {
    let by_step: HashMap<&NodeId, &StepFieldInventory> = inventory.iter().map(|i| (&i.step_id, i)).collect();
    let mut out = JourneyReachabilityProjection::default();
    for step in &evaluation.steps {
        let inv = by_step.get(&step.step_id);
        let projected = StepReachabilityProjection {
            path: resolve_path_params(&step.route_template_path, params),
            code: step.code.clone().filter(|c| !c.is_empty()),
            field_codes: inv.map(|i| i.field_codes.clone()).unwrap_or_default(),
            cleardown_field_codes: inv.map(|i| i.cleardown_field_codes.clone()).unwrap_or_default(),
            back_path: back_path(step, &evaluation.canonical_path_route_template_paths)
                .map(|p| resolve_path_params(&p, params)),
        };
        if step.is_reachable {
            out.reachable_steps.push(projected);
        } else {
            out.unreachable_steps.push(projected);
        }
    }
    out
}

/// `resolveBacklinkRouteTemplatePath`.
pub fn backlink_route_template_path(evaluation: &ReachabilityEvaluation) -> Option<String> {
    let current = evaluation.steps.iter().find(|s| Some(&s.step_id) == evaluation.current_step_id.as_ref())?;
    back_path(current, &evaluation.canonical_path_route_template_paths)
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum NodeMode {
    Step,
    Journey,
}

/// `resolveRedirect`: the route template path to redirect to, or `None` to continue.
pub fn resolve_redirect(evaluation: &ReachabilityEvaluation, mode: NodeMode, is_get: bool) -> Option<String> {
    if mode == NodeMode::Journey {
        if evaluation.resume_outcome == ResumeOutcome::Redirect {
            return evaluation.frontier_route_template_path.clone();
        }
        return evaluation.default_entry_route_template_path.clone();
    }
    let current = evaluation.steps.iter().find(|s| Some(&s.step_id) == evaluation.current_step_id.as_ref())?;
    if is_get && evaluation.resume_outcome == ResumeOutcome::Redirect {
        return evaluation.frontier_route_template_path.clone();
    }
    if current.is_reachable {
        return None;
    }
    match evaluation.unreachable_redirect {
        UnreachableRedirect::Frontier => evaluation
            .frontier_route_template_path
            .clone()
            .or_else(|| evaluation.default_entry_route_template_path.clone()),
        UnreachableRedirect::Entry => evaluation.default_entry_route_template_path.clone(),
    }
}
