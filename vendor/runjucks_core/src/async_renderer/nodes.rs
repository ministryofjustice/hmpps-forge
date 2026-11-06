//! Async AST node dispatch and child rendering.

use crate::ast::{Expr, Node};
use crate::environment::Environment;
use crate::errors::{Result, RunjucksError};
use crate::render_common::is_truthy;
use crate::renderer::{
    collect_top_level_macros, scan_literal_import_graph, CtxStack, RenderState,
};
use serde_json::{Map, Value};
use std::collections::HashMap;
use std::pin::Pin;
use std::future::Future;

use super::entry::render_entry_async;
use super::eval::{eval_for_output_async, eval_to_value_async};
use super::loops::{
    render_async_all, render_async_each, render_for_async, render_switch_async,
};
use super::macros::render_macro_body_async;

pub(super) fn render_node_async<'a>(
    env: &'a Environment,
    state: &'a mut RenderState<'_>,
    n: &'a Node,
    stack: &'a mut CtxStack,
) -> Pin<Box<dyn Future<Output = Result<String>> + 'a>> {
    Box::pin(render_node_inner(env, state, n, stack))
}

async fn render_node_inner(
    env: &Environment,
    state: &mut RenderState<'_>,
    n: &Node,
    stack: &mut CtxStack,
) -> Result<String> {
    match n {
        Node::Root(nodes) => {
            let mut defs = HashMap::new();
            for n in nodes.iter() {
                if let crate::ast::Node::MacroDef(m) = n {
                    defs.insert(m.name.clone(), m.clone());
                }
            }
            let had_macros = !defs.is_empty();
            let scope_base = state.macro_scopes.len();
            if had_macros {
                state.push_macros(defs);
            }
            let mut out = String::new();
            out.reserve(nodes.len().saturating_mul(32));
            for child in nodes.iter() {
                if matches!(child, Node::MacroDef(_) | Node::Extends { .. }) {
                    continue;
                }
                out.push_str(&render_node_async(env, state, child, stack).await?);
            }
            while state.macro_scopes.len() > scope_base {
                state.pop_macros();
            }
            Ok(out)
        }
        Node::Text(s) => Ok(s.to_string()),
        Node::Output(exprs) => render_output_async(env, state, exprs, stack).await,
        Node::If { branches } => {
            for br in branches {
                if let Some(cond) = &br.cond {
                    if !is_truthy(&eval_to_value_async(env, state, cond, stack).await?) {
                        continue;
                    }
                }
                return render_children_async(env, state, &br.body, stack).await;
            }
            Ok(String::new())
        }
        Node::Switch {
            expr,
            cases,
            default_body,
        } => render_switch_async(env, state, expr, cases, default_body.as_deref(), stack).await,
        Node::For {
            vars,
            iter,
            body,
            else_body,
        } => render_for_async(env, state, vars, iter, body, else_body.as_deref(), stack).await,
        Node::Set {
            targets,
            value,
            body,
        } => {
            if let Some(expr) = value {
                let v = eval_to_value_async(env, state, expr, stack).await?;
                for t in targets {
                    stack.set(t, v.clone());
                }
            } else if let Some(nodes) = body {
                let s = render_children_async(env, state, nodes, stack).await?;
                if let Some(t) = targets.first() {
                    stack.set(t, Value::String(s));
                }
            }
            Ok(String::new())
        }
        Node::Include {
            template,
            ignore_missing,
            with_context,
        } => {
            let loader = state
                .loader
                .ok_or_else(|| RunjucksError::new("`include` requires a template loader"))?;
            let name = crate::value::value_to_string(
                &eval_to_value_async(env, state, template, stack).await?,
            );
            let included = match env.load_and_parse_named(&name, loader) {
                Ok(ast) => ast,
                Err(_) if *ignore_missing => return Ok(String::new()),
                Err(e) => return Err(e),
            };
            state.push_template(&name)?;
            let out = if matches!(with_context, Some(false)) {
                let mut isolated = CtxStack::from_root(Map::new());
                render_entry_async(env, state, included.as_ref(), &mut isolated).await?
            } else {
                render_entry_async(env, state, included.as_ref(), stack).await?
            };
            state.pop_template();
            Ok(out)
        }
        Node::Import {
            template,
            alias,
            with_context,
        } => {
            let loader = state
                .loader
                .ok_or_else(|| RunjucksError::new("`import` requires a template loader"))?;
            let name = crate::value::value_to_string(
                &eval_to_value_async(env, state, template, stack).await?,
            );
            let imported = env.load_and_parse_named(&name, loader)?;
            state.push_template(&name)?;
            scan_literal_import_graph(env, state, imported.as_ref(), loader)?;
            let defs = collect_top_level_macros(imported.as_ref());
            let exported_sets = eval_exported_top_level_sets_async(
                env,
                state,
                imported.as_ref(),
                stack,
                *with_context,
            )
            .await?;
            state.pop_template();
            state.macro_namespaces.insert(alias.clone(), defs);
            state
                .macro_namespace_values
                .insert(alias.clone(), exported_sets);
            Ok(String::new())
        }
        Node::FromImport {
            template,
            names,
            with_context,
        } => {
            let loader = state
                .loader
                .ok_or_else(|| RunjucksError::new("`from` requires a template loader"))?;
            let name = crate::value::value_to_string(
                &eval_to_value_async(env, state, template, stack).await?,
            );
            let imported = env.load_and_parse_named(&name, loader)?;
            state.push_template(&name)?;
            scan_literal_import_graph(env, state, imported.as_ref(), loader)?;
            let defs = collect_top_level_macros(imported.as_ref());
            let exported_sets = eval_exported_top_level_sets_async(
                env,
                state,
                imported.as_ref(),
                stack,
                *with_context,
            )
            .await?;
            state.pop_template();
            let mut scope = HashMap::new();
            for (export_name, alias_opt) in names {
                let local = alias_opt.as_ref().unwrap_or(export_name);
                if let Some(mdef) = defs.get(export_name) {
                    scope.insert(local.clone(), mdef.clone());
                } else if let Some(v) = exported_sets.get(export_name) {
                    stack.set(local, v.clone());
                } else {
                    return Err(RunjucksError::new(format!(
                        "cannot import '{export_name}'"
                    )));
                }
            }
            state.push_macros(scope);
            Ok(String::new())
        }
        Node::Extends { .. } => Err(RunjucksError::new(
            "`extends` is only valid at the top level of a loaded template",
        )),
        Node::Block { name, body } => {
            let to_render: Vec<crate::ast::Node> =
                if let Some(ref chains) = state.block_chains {
                    chains
                        .get(name)
                        .and_then(|ch| ch.first().cloned())
                        .unwrap_or_else(|| body.clone())
                } else {
                    body.clone()
                };
            let prev_super = state.super_context.take();
            state.super_context = Some((name.clone(), 0));
            let out = render_children_async(env, state, &to_render, stack).await;
            state.super_context = prev_super;
            out
        }
        Node::FilterBlock { name, args, body } => {
            let s = render_children_async(env, state, body, stack).await?;
            let arg_vals: Vec<Value> = {
                let mut v = Vec::with_capacity(args.len());
                for a in args {
                    v.push(eval_to_value_async(env, state, a, stack).await?);
                }
                v
            };
            // Check async filters first, then fall back to sync/builtin
            if let Some(af) = env.async_custom_filters.get(name.as_str()) {
                let v = af(&Value::String(s), &arg_vals).await?;
                let out = crate::value::value_to_string(&v);
                return if env.autoescape && !crate::value::is_marked_safe(&v) {
                    Ok(crate::filters::escape_html(&out))
                } else {
                    Ok(out)
                };
            }
            let v = crate::filters::apply_builtin(
                env,
                &mut state.rng,
                name,
                &Value::String(s),
                &arg_vals,
            )?;
            let out = crate::value::value_to_string(&v);
            if env.autoescape && !crate::value::is_marked_safe(&v) {
                Ok(crate::filters::escape_html(&out))
            } else {
                Ok(out)
            }
        }
        Node::CallBlock {
            caller_params,
            callee,
            body,
        } => {
            let Expr::Call {
                callee: macro_target,
                args,
                kwargs,
            } = callee
            else {
                return Err(RunjucksError::new(
                    "`{% call %}` expects a macro call expression",
                ));
            };
            let arg_vals = {
                let mut v = Vec::with_capacity(args.len());
                for a in args {
                    v.push(eval_to_value_async(env, state, a, stack).await?);
                }
                v
            };
            let kw_vals = {
                let mut v = Vec::with_capacity(kwargs.len());
                for (k, e) in kwargs {
                    v.push((k.clone(), eval_to_value_async(env, state, e, stack).await?));
                }
                v
            };
            let mdef = resolve_macro_target(state, macro_target)?;
            let frame = crate::renderer::CallerFrame {
                body: body.clone(),
                params: caller_params.clone(),
            };
            state.caller_stack.push(frame);
            let module_closure_owned =
                if let Expr::GetAttr { base, attr: _ } = macro_target.as_ref() {
                    if let crate::ast::Expr::Variable(ns) = base.as_ref() {
                        state.macro_namespace_values.get(ns).cloned()
                    } else {
                        None
                    }
                } else {
                    None
                };
            let res = render_macro_body_async(
                env,
                state,
                &mdef,
                &arg_vals,
                &kw_vals,
                stack,
                module_closure_owned.as_ref(),
            )
            .await;
            state.caller_stack.pop();
            res
        }
        Node::ExtensionTag {
            extension_name,
            args,
            body,
            ..
        } => {
            let handler = env.custom_extensions.get(extension_name).ok_or_else(|| {
                RunjucksError::new(format!("unknown extension `{extension_name}`"))
            })?;
            let ctx_for_handler = Value::Object(stack.flatten());
            let body_s = if let Some(nodes) = body {
                Some(render_children_async(env, state, nodes, stack).await?)
            } else {
                None
            };
            let out = handler(&ctx_for_handler, args.as_str(), body_s)?;
            Ok(if env.autoescape {
                crate::filters::escape_html(&out)
            } else {
                out
            })
        }
        Node::AsyncEach {
            vars,
            iter,
            body,
            else_body,
        } => render_async_each(env, state, vars, iter, body, else_body.as_deref(), stack).await,
        Node::AsyncAll {
            vars,
            iter,
            body,
            else_body,
        } => render_async_all(env, state, vars, iter, body, else_body.as_deref(), stack).await,
        Node::IfAsync { branches } => {
            for br in branches {
                if let Some(cond) = &br.cond {
                    if !is_truthy(&eval_to_value_async(env, state, cond, stack).await?) {
                        continue;
                    }
                }
                return render_children_async(env, state, &br.body, stack).await;
            }
            Ok(String::new())
        }
        Node::MacroDef(_) => Ok(String::new()),
    }
}

pub(super) async fn render_children_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    nodes: &[Node],
    stack: &mut CtxStack,
) -> Result<String> {
    let mut out = String::new();
    out.reserve(nodes.len().saturating_mul(32));
    for child in nodes {
        out.push_str(&render_node_async(env, state, child, stack).await?);
    }
    Ok(out)
}

async fn render_output_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    exprs: &[Expr],
    stack: &mut CtxStack,
) -> Result<String> {
    let mut out = String::new();
    out.reserve(exprs.len().saturating_mul(24));
    for e in exprs {
        out.push_str(&eval_for_output_async(env, state, e, stack).await?);
    }
    Ok(out)
}

/// Resolve macro from variable or namespace.attribute.
fn resolve_macro_target(
    state: &RenderState<'_>,
    macro_target: &Expr,
) -> Result<crate::ast::MacroDef> {
    if let Expr::Variable(name) = macro_target {
        state
            .lookup_macro(name)
            .cloned()
            .ok_or_else(|| RunjucksError::new(format!("unknown macro `{name}`")))
    } else if let Expr::GetAttr { base, attr } = macro_target {
        if let Expr::Variable(ns) = base.as_ref() {
            state
                .lookup_namespaced_macro(ns, attr)
                .cloned()
                .ok_or_else(|| RunjucksError::new(format!("unknown macro `{ns}.{attr}`")))
        } else {
            Err(RunjucksError::new(
                "`{% call %}` only supports simple macro or `namespace.macro()` calls",
            ))
        }
    } else {
        Err(RunjucksError::new(
            "`{% call %}` only supports simple macro or `namespace.macro()` calls",
        ))
    }
}

/// Async version of eval_exported_top_level_sets.
async fn eval_exported_top_level_sets_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    root: &Node,
    ctx_stack: &mut CtxStack,
    with_context: Option<bool>,
) -> Result<HashMap<String, Value>> {
    use crate::renderer::{collect_top_level_set_exports, TopLevelSetExport};
    let mut out = HashMap::new();
    let exports = collect_top_level_set_exports(root);
    let mut import_stack = if matches!(with_context, Some(true)) {
        CtxStack::from_root(ctx_stack.flatten())
    } else {
        CtxStack::from_root(Map::new())
    };
    for ex in exports {
        match ex {
            TopLevelSetExport::FromExpr { targets, expr } => {
                let v = eval_to_value_async(env, state, &expr, &mut import_stack).await?;
                for t in &targets {
                    import_stack.set(t, v.clone());
                }
                for t in &targets {
                    out.insert(t.clone(), v.clone());
                }
            }
            TopLevelSetExport::FromBlock { target, body } => {
                let s = render_children_async(env, state, &body, &mut import_stack).await?;
                let val = Value::String(s);
                import_stack.set(&target, val.clone());
                out.insert(target, val);
            }
        }
    }
    Ok(out)
}
