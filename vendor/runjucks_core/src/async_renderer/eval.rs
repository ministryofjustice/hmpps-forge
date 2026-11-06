//! Async expression evaluation: `eval_to_value_async` and `eval_for_output_async`.

use crate::ast::{BinOp, Expr, UnaryOp};
use crate::environment::Environment;
use crate::errors::{Result, RunjucksError};
use crate::globals::{parse_cycler_id, parse_joiner_id, RJ_CALLABLE};
use crate::render_common::{
    add_like_js, apply_builtin_filter_chain_on_cow_value, as_number,
    collect_attr_chain_from_getattr, compare_values, eval_in, is_test_parts, is_truthy,
    jinja_slice_array, json_num, peel_builtin_upper_lower_length_chain,
};
use crate::renderer::{CtxStack, RenderState};
use crate::value::{is_undefined_value, mark_safe, undefined_value};
use serde_json::{json, Map, Value};
use std::borrow::Cow;

use super::macros::{render_caller_invocation_async, render_macro_body_async};
use super::nodes::render_children_async;

fn try_dispatch_builtin(
    state: &mut RenderState<'_>,
    stack: &CtxStack,
    name: &str,
    arg_vals: &[Value],
) -> Option<Result<Value>> {
    crate::render_common::try_dispatch_builtin(
        &mut state.cyclers,
        &mut state.joiners,
        stack.defined(name),
        stack.get_ref(name),
        name,
        arg_vals,
    )
}

/// Check whether any filter name in an expression chain has an async override registered.
fn filter_chain_has_async_override(env: &Environment, e: &Expr) -> bool {
    let mut cur = e;
    loop {
        match cur {
            Expr::Filter { name, input, .. } => {
                if env.async_custom_filters.contains_key(name) {
                    return true;
                }
                cur = input.as_ref();
            }
            _ => return false,
        }
    }
}

fn try_apply_peeled_builtin_filter_chain_value(
    env: &Environment,
    stack: &mut CtxStack,
    e: &Expr,
) -> Option<Result<Value>> {
    if filter_chain_has_async_override(env, e) {
        return None;
    }
    let (rev_names, leaf) = peel_builtin_upper_lower_length_chain(e, &env.custom_filters)?;
    match leaf {
        Expr::Variable(var_name) => {
            let v = match env.resolve_variable_ref(stack, var_name) {
                Ok(v) => v,
                Err(e) => return Some(Err(e)),
            };
            Some(apply_builtin_filter_chain_on_cow_value(v, &rev_names))
        }
        Expr::Literal(Value::String(s)) => {
            let mut current = s.clone();
            for n in &rev_names {
                match *n {
                    "upper" => current = current.to_uppercase(),
                    "lower" => current = current.to_lowercase(),
                    "trim" => {
                        current = current
                            .trim_matches(|c: char| c.is_whitespace())
                            .to_string();
                    }
                    "capitalize" => {
                        current = crate::filters::capitalize_string_slice(&current);
                    }
                    "length" => return Some(Ok(json!(current.chars().count()))),
                    _ => unreachable!(),
                }
            }
            Some(Ok(Value::String(current)))
        }
        Expr::Literal(Value::Array(a)) if rev_names == ["length"] => Some(Ok(json!(a.len()))),
        _ => None,
    }
}

async fn eval_slice_bound_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    e: Option<&Expr>,
    stack: &mut CtxStack,
) -> Result<Option<i64>> {
    let Some(e) = e else {
        return Ok(None);
    };
    let v = eval_to_value_async(env, state, e, stack).await?;
    if v.is_null() || is_undefined_value(&v) {
        return Ok(None);
    }
    let n = v
        .as_i64()
        .or_else(|| v.as_f64().map(|x| x as i64))
        .or_else(|| crate::value::value_to_string(&v).parse().ok());
    match n {
        Some(x) => Ok(Some(x)),
        None => Err(RunjucksError::new("slice bound must be a number")),
    }
}

pub(super) fn eval_to_value_async<'a>(
    env: &'a Environment,
    state: &'a mut RenderState<'_>,
    e: &'a Expr,
    stack: &'a mut CtxStack,
) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Value>> + 'a>> {
    Box::pin(eval_to_value_inner(env, state, e, stack))
}

async fn eval_to_value_inner(
    env: &Environment,
    state: &mut RenderState<'_>,
    e: &Expr,
    stack: &mut CtxStack,
) -> Result<Value> {
    match e {
        Expr::Literal(v) => Ok(v.clone()),
        Expr::Variable(name) => env.resolve_variable(stack, name),
        Expr::Unary { op, expr } => match op {
            UnaryOp::Not => {
                if let Expr::Variable(name) = expr.as_ref() {
                    let v = env.resolve_variable_ref(stack, name)?;
                    return Ok(Value::Bool(!is_truthy(v.as_ref())));
                }
                let v = eval_to_value_async(env, state, expr, stack).await?;
                Ok(Value::Bool(!is_truthy(&v)))
            }
            UnaryOp::Neg => {
                if let Expr::Variable(name) = expr.as_ref() {
                    let v = env.resolve_variable_ref(stack, name)?;
                    let n = as_number(v.as_ref())
                        .ok_or_else(|| RunjucksError::new("unary '-' expects a numeric value"))?;
                    return Ok(json_num(-n));
                }
                let v = eval_to_value_async(env, state, expr, stack).await?;
                let n = as_number(&v)
                    .ok_or_else(|| RunjucksError::new("unary '-' expects a numeric value"))?;
                Ok(json_num(-n))
            }
            UnaryOp::Pos => {
                if let Expr::Variable(name) = expr.as_ref() {
                    let v = env.resolve_variable_ref(stack, name)?;
                    if let Some(n) = as_number(v.as_ref()) {
                        return Ok(json_num(n));
                    }
                    return Ok(v.into_owned());
                }
                let v = eval_to_value_async(env, state, expr, stack).await?;
                Ok(v)
            }
        },
        Expr::Binary { op, left, right } => match op {
            BinOp::Add => Ok(add_like_js(
                &eval_to_value_async(env, state, left, stack).await?,
                &eval_to_value_async(env, state, right, stack).await?,
            )),
            BinOp::Concat => Ok(Value::String(format!(
                "{}{}",
                eval_for_output_async(env, state, left, stack).await?,
                eval_for_output_async(env, state, right, stack).await?
            ))),
            BinOp::Sub => {
                let a = eval_to_value_async(env, state, left, stack).await?;
                let b = eval_to_value_async(env, state, right, stack).await?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`-` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`-` expects numbers"))?;
                Ok(json_num(x - y))
            }
            BinOp::Mul => {
                let a = eval_to_value_async(env, state, left, stack).await?;
                let b = eval_to_value_async(env, state, right, stack).await?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`*` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`*` expects numbers"))?;
                Ok(json_num(x * y))
            }
            BinOp::Div => {
                let a = eval_to_value_async(env, state, left, stack).await?;
                let b = eval_to_value_async(env, state, right, stack).await?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`/` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`/` expects numbers"))?;
                Ok(json!(x / y))
            }
            BinOp::FloorDiv => {
                let a = eval_to_value_async(env, state, left, stack).await?;
                let b = eval_to_value_async(env, state, right, stack).await?;
                let x =
                    as_number(&a).ok_or_else(|| RunjucksError::new("`//` expects numbers"))?;
                let y =
                    as_number(&b).ok_or_else(|| RunjucksError::new("`//` expects numbers"))?;
                if y == 0.0 {
                    return Err(RunjucksError::new("division by zero"));
                }
                Ok(json_num((x / y).floor()))
            }
            BinOp::Mod => {
                let a = eval_to_value_async(env, state, left, stack).await?;
                let b = eval_to_value_async(env, state, right, stack).await?;
                let x = as_number(&a).ok_or_else(|| RunjucksError::new("`%` expects numbers"))?;
                let y = as_number(&b).ok_or_else(|| RunjucksError::new("`%` expects numbers"))?;
                Ok(json_num(x % y))
            }
            BinOp::Pow => {
                let a = eval_to_value_async(env, state, left, stack).await?;
                let b = eval_to_value_async(env, state, right, stack).await?;
                let x =
                    as_number(&a).ok_or_else(|| RunjucksError::new("`**` expects numbers"))?;
                let y =
                    as_number(&b).ok_or_else(|| RunjucksError::new("`**` expects numbers"))?;
                Ok(json!(x.powf(y)))
            }
            BinOp::And => {
                let l = eval_to_value_async(env, state, left, stack).await?;
                if !is_truthy(&l) {
                    return Ok(l);
                }
                eval_to_value_async(env, state, right, stack).await
            }
            BinOp::Or => {
                let l = eval_to_value_async(env, state, left, stack).await?;
                if is_truthy(&l) {
                    return Ok(l);
                }
                eval_to_value_async(env, state, right, stack).await
            }
            BinOp::In => {
                let key = eval_to_value_async(env, state, left, stack).await?;
                let container = eval_to_value_async(env, state, right, stack).await?;
                Ok(Value::Bool(eval_in(&key, &container)?))
            }
            BinOp::Is => {
                let (test_name, arg_exprs) = is_test_parts(right).ok_or_else(|| {
                    RunjucksError::new("`is` test must be an identifier, call, string, or null")
                })?;
                if test_name == "defined" {
                    if let Expr::Variable(n) = &**left {
                        return Ok(Value::Bool(stack.defined(n)));
                    }
                }
                if test_name == "callable" {
                    if let Expr::Variable(n) = &**left {
                        if state.lookup_macro(n).is_some() {
                            return Ok(Value::Bool(true));
                        }
                    }
                }
                if arg_exprs.is_empty() {
                    let v = match &**left {
                        Expr::Variable(n) => env.resolve_variable_ref(stack, n)?,
                        _ => Cow::Owned(eval_to_value_async(env, state, left, stack).await?),
                    };
                    return Ok(Value::Bool(env.apply_is_test(test_name, v.as_ref(), &[])?));
                }
                let mut arg_vals = Vec::with_capacity(arg_exprs.len());
                for ae in arg_exprs {
                    arg_vals.push(eval_to_value_async(env, state, ae, stack).await?);
                }
                let v = match &**left {
                    Expr::Variable(n) => env.resolve_variable_ref(stack, n)?,
                    _ => Cow::Owned(eval_to_value_async(env, state, left, stack).await?),
                };
                if matches!(test_name, "equalto" | "eq" | "sameas") && arg_exprs.len() == 1 {
                    if let Expr::Variable(lhs) = &**left {
                        if let Expr::Variable(rhs) = &arg_exprs[0] {
                            if lhs == rhs {
                                return Ok(Value::Bool(true));
                            }
                        }
                    }
                }
                Ok(Value::Bool(env.apply_is_test(
                    test_name,
                    v.as_ref(),
                    &arg_vals,
                )?))
            }
        },
        Expr::Compare { head, rest } => {
            if rest.len() == 1 {
                let (op, rhs_e) = &rest[0];
                match head.as_ref() {
                    Expr::Variable(n) => {
                        let r = eval_to_value_async(env, state, rhs_e, stack).await?;
                        let left = env.resolve_variable_ref(stack, n)?;
                        return Ok(Value::Bool(compare_values(left.as_ref(), *op, &r)));
                    }
                    _ => {
                        let left = eval_to_value_async(env, state, head, stack).await?;
                        let r = eval_to_value_async(env, state, rhs_e, stack).await?;
                        return Ok(Value::Bool(compare_values(&left, *op, &r)));
                    }
                }
            }
            let mut acc = eval_to_value_async(env, state, head, stack).await?;
            for (op, rhs_e) in rest.iter() {
                let r = eval_to_value_async(env, state, rhs_e, stack).await?;
                let ok = compare_values(&acc, *op, &r);
                acc = Value::Bool(ok);
            }
            Ok(acc)
        }
        Expr::InlineIf {
            cond,
            then_expr,
            else_expr,
        } => {
            let c = eval_to_value_async(env, state, cond, stack).await?;
            if is_truthy(&c) {
                eval_to_value_async(env, state, then_expr, stack).await
            } else if let Some(els) = else_expr {
                eval_to_value_async(env, state, els, stack).await
            } else {
                Ok(Value::Null)
            }
        }
        Expr::GetAttr { base, attr } => {
            if let Expr::Variable(ns) = base.as_ref() {
                if state.macro_namespaces.contains_key(ns)
                    || state.macro_namespace_values.contains_key(ns)
                {
                    if let Some(v) = state.lookup_namespaced_value(ns, attr) {
                        return Ok(v.clone());
                    }
                    if state.lookup_namespaced_macro(ns, attr).is_some() {
                        let mut m = Map::new();
                        m.insert(RJ_CALLABLE.to_string(), Value::Bool(true));
                        return Ok(Value::Object(m));
                    }
                    return Ok(undefined_value());
                }
            }
            if let Some((root_name, attrs)) = collect_attr_chain_from_getattr(e) {
                if !state.macro_namespaces.contains_key(root_name)
                    && !state.macro_namespace_values.contains_key(root_name)
                {
                    let mut cur = env.resolve_variable_ref(stack, root_name)?;
                    for a in &attrs {
                        if is_undefined_value(cur.as_ref()) || cur.as_ref().is_null() {
                            return Ok(undefined_value());
                        }
                        match cur.as_ref() {
                            Value::Object(o) => {
                                cur =
                                    Cow::Owned(o.get(*a).cloned().unwrap_or_else(undefined_value));
                            }
                            _ => return Ok(undefined_value()),
                        }
                    }
                    return Ok(cur.into_owned());
                }
            }
            let b = eval_to_value_async(env, state, base, stack).await?;
            if is_undefined_value(&b) || b.is_null() {
                return Ok(undefined_value());
            }
            match b {
                Value::Object(o) => Ok(o.get(attr).cloned().unwrap_or_else(undefined_value)),
                _ => Ok(undefined_value()),
            }
        }
        Expr::GetItem { base, index } => match index.as_ref() {
            Expr::Slice {
                start: s,
                stop: st,
                step: step_e,
            } => {
                let start_v = eval_slice_bound_async(env, state, s.as_deref(), stack).await?;
                let stop_v = eval_slice_bound_async(env, state, st.as_deref(), stack).await?;
                let step_v =
                    eval_slice_bound_async(env, state, step_e.as_deref(), stack).await?;
                if let Expr::Variable(name) = base.as_ref() {
                    let base_val = env.resolve_variable_ref(stack, name)?;
                    if is_undefined_value(base_val.as_ref()) || base_val.as_ref().is_null() {
                        return Ok(undefined_value());
                    }
                    if let Value::Array(a) = base_val.as_ref() {
                        return Ok(Value::Array(jinja_slice_array(a, start_v, stop_v, step_v)));
                    }
                    return Ok(Value::Null);
                }
                let b = eval_to_value_async(env, state, base, stack).await?;
                if is_undefined_value(&b) || b.is_null() {
                    return Ok(undefined_value());
                }
                let Value::Array(a) = &b else {
                    return Ok(Value::Null);
                };
                Ok(Value::Array(jinja_slice_array(a, start_v, stop_v, step_v)))
            }
            idx_e => {
                if let Expr::Variable(name) = base.as_ref() {
                    let base_val = env.resolve_variable_ref(stack, name)?;
                    if is_undefined_value(base_val.as_ref()) || base_val.as_ref().is_null() {
                        return Ok(undefined_value());
                    }
                    match idx_e {
                        Expr::Literal(Value::Number(n)) => {
                            let idx = n
                                .as_u64()
                                .or_else(|| n.as_f64().map(|x| x as u64))
                                .unwrap_or(0)
                                as usize;
                            match base_val.as_ref() {
                                Value::Array(a) => {
                                    return Ok(
                                        a.get(idx).cloned().unwrap_or_else(undefined_value)
                                    );
                                }
                                _ => return Ok(undefined_value()),
                            }
                        }
                        Expr::Literal(Value::String(k)) => match base_val.as_ref() {
                            Value::Object(o) => {
                                return Ok(
                                    o.get(k).cloned().unwrap_or_else(undefined_value)
                                );
                            }
                            _ => return Ok(undefined_value()),
                        },
                        _ => {}
                    }
                }
                let b = eval_to_value_async(env, state, base, stack).await?;
                if is_undefined_value(&b) || b.is_null() {
                    return Ok(undefined_value());
                }
                let i = eval_to_value_async(env, state, idx_e, stack).await?;
                match (&b, &i) {
                    (Value::Array(a), Value::Number(n)) => {
                        let idx = n
                            .as_u64()
                            .or_else(|| n.as_f64().map(|x| x as u64))
                            .unwrap_or(0) as usize;
                        Ok(a.get(idx).cloned().unwrap_or_else(undefined_value))
                    }
                    (Value::Object(o), Value::String(k)) => {
                        Ok(o.get(k).cloned().unwrap_or_else(undefined_value))
                    }
                    _ => Ok(undefined_value()),
                }
            }
        },
        Expr::Slice { .. } => Err(RunjucksError::new(
            "slice expression is only valid inside `[ ]`",
        )),
        Expr::Call {
            callee,
            args,
            kwargs,
        } => {
            let mut arg_vals = Vec::with_capacity(args.len());
            for a in args {
                arg_vals.push(eval_to_value_async(env, state, a, stack).await?);
            }
            let mut kw_vals = Vec::with_capacity(kwargs.len());
            for (k, e) in kwargs {
                kw_vals.push((k.clone(), eval_to_value_async(env, state, e, stack).await?));
            }
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if attr == "test" {
                    let base_v = eval_to_value_async(env, state, base, stack).await?;
                    if crate::value::is_regexp_value(&base_v) {
                        if !kw_vals.is_empty() {
                            return Err(RunjucksError::new(
                                "regex `.test` does not accept keyword arguments",
                            ));
                        }
                        if arg_vals.len() != 1 {
                            return Err(RunjucksError::new(
                                "regex `.test` expects exactly one argument",
                            ));
                        }
                        let Some((pat, fl)) = crate::value::regexp_pattern_flags(&base_v) else {
                            return Err(RunjucksError::new("invalid regex value"));
                        };
                        let s = crate::value::value_to_string(&arg_vals[0]);
                        return Ok(Value::Bool(crate::js_regex::regexp_test(&pat, &fl, &s)?));
                    }
                }
            }
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if attr == "next" && arg_vals.is_empty() && kw_vals.is_empty() {
                    let b = eval_to_value_async(env, state, base, stack).await?;
                    if let Some(id) = parse_cycler_id(&b) {
                        if let Some(c) = state.cyclers.get_mut(id) {
                            return Ok(c.next());
                        }
                        return Ok(Value::Null);
                    }
                }
            }
            if let Expr::Variable(name) = callee.as_ref() {
                if name == "super" {
                    if !args.is_empty() || !kw_vals.is_empty() {
                        return Err(RunjucksError::new("`super()` takes no arguments"));
                    }
                    let (block_name, layer) = state.super_context.clone().ok_or_else(|| {
                        RunjucksError::new("`super()` is only valid inside a `{% block %}`")
                    })?;
                    let (body_to_render, next) = {
                        let chains = state.block_chains.as_ref().ok_or_else(|| {
                            RunjucksError::new(
                                "`super()` requires template inheritance (`{% extends %}`)",
                            )
                        })?;
                        let chain = chains.get(&block_name).ok_or_else(|| {
                            RunjucksError::new(format!(
                                "no super block available for `{block_name}`"
                            ))
                        })?;
                        let next = layer + 1;
                        if next >= chain.len() {
                            return Err(RunjucksError::new(
                                "no parent block available for `super()`",
                            ));
                        }
                        (chain[next].clone(), next)
                    };
                    let prev = state.super_context.replace((block_name.clone(), next));
                    let s = render_children_async(env, state, &body_to_render, stack).await?;
                    state.super_context = prev;
                    return Ok(mark_safe(s));
                }
                if name == "caller" {
                    let frame = state.caller_stack.last().cloned().ok_or_else(|| {
                        RunjucksError::new(
                            "`caller()` is only valid inside a macro invoked from `{% call %}`",
                        )
                    })?;
                    let s = render_caller_invocation_async(
                        env, state, &frame, &arg_vals, &kw_vals, stack,
                    )
                    .await?;
                    return Ok(mark_safe(s));
                }
                if let Some(mdef) = state.lookup_macro(name).cloned() {
                    let s = render_macro_body_async(
                        env, state, &mdef, &arg_vals, &kw_vals, stack, None,
                    )
                    .await?;
                    return Ok(mark_safe(s));
                }
                if arg_vals.is_empty() {
                    let v = env.resolve_variable(stack, name)?;
                    if let Some(id) = parse_joiner_id(&v) {
                        if let Some(j) = state.joiners.get_mut(id) {
                            return Ok(Value::String(j.invoke()));
                        }
                    }
                }
                if let Some(r) = try_dispatch_builtin(state, stack, name, &arg_vals) {
                    return r;
                }
                // Check async globals first, then sync
                #[cfg(feature = "async")]
                if let Some(f) = env.async_custom_globals.get(name) {
                    return f(&arg_vals, &kw_vals).await;
                }
                if let Some(f) = env.custom_globals.get(name) {
                    return f(&arg_vals, &kw_vals);
                }
            }
            if let Expr::GetAttr { base, attr } = callee.as_ref() {
                if let Expr::Variable(ns) = base.as_ref() {
                    if let Some(mdef) = state.lookup_namespaced_macro(ns, attr).cloned() {
                        let mc = state.macro_namespace_values.get(ns).cloned();
                        let s = render_macro_body_async(
                            env,
                            state,
                            &mdef,
                            &arg_vals,
                            &kw_vals,
                            stack,
                            mc.as_ref(),
                        )
                        .await?;
                        return Ok(mark_safe(s));
                    }
                }
            }
            Err(RunjucksError::new(
                "only template macros, built-in globals (`range`, `cycler`, `joiner`), registered global callables, or `super`/`caller` are supported for `()` expressions",
            ))
        }
        Expr::Filter { name, input, args } => {
            // Fast-path: builtin filter chain on variable/literal (no async needed)
            if args.is_empty() {
                if let Some(r) = try_apply_peeled_builtin_filter_chain_value(env, stack, e) {
                    return r;
                }
            }
            if args.is_empty() && !env.custom_filters.contains_key(name) && !env.async_custom_filters.contains_key(name) {
                if let Expr::Variable(var_name) = input.as_ref() {
                    let input_v = env.resolve_variable_ref(stack, var_name)?;
                    match name.as_str() {
                        "upper" => {
                            return Ok(Value::String(
                                crate::value::value_to_string(input_v.as_ref()).to_uppercase(),
                            ));
                        }
                        "lower" => {
                            return Ok(Value::String(
                                crate::value::value_to_string(input_v.as_ref()).to_lowercase(),
                            ));
                        }
                        "length" => {
                            return Ok(match input_v.as_ref() {
                                Value::String(s) => json!(s.chars().count()),
                                Value::Array(a) => json!(a.len()),
                                Value::Object(o) => json!(o.len()),
                                v if is_undefined_value(v) => json!(0),
                                _ => json!(0),
                            });
                        }
                        "capitalize" => {
                            return Ok(crate::filters::chain_capitalize_like_builtin(
                                input_v.as_ref(),
                            ));
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::String(s)) = input.as_ref() {
                    match name.as_str() {
                        "upper" => return Ok(Value::String(s.to_uppercase())),
                        "lower" => return Ok(Value::String(s.to_lowercase())),
                        "length" => return Ok(json!(s.chars().count())),
                        "capitalize" => {
                            return Ok(Value::String(crate::filters::capitalize_string_slice(s)));
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::Array(a)) = input.as_ref() {
                    if name == "length" {
                        return Ok(json!(a.len()));
                    }
                }
            }
            // Check async filters first
            #[cfg(feature = "async")]
            if let Some(af) = env.async_custom_filters.get(name) {
                let input_v = eval_to_value_async(env, state, input, stack).await?;
                let mut arg_vals = Vec::with_capacity(args.len());
                for a in args {
                    arg_vals.push(eval_to_value_async(env, state, a, stack).await?);
                }
                return af(&input_v, &arg_vals).await;
            }
            let input_v = eval_to_value_async(env, state, input, stack).await?;
            let mut arg_vals = Vec::with_capacity(args.len());
            for a in args {
                arg_vals.push(eval_to_value_async(env, state, a, stack).await?);
            }
            crate::filters::apply_builtin(env, &mut state.rng, name, &input_v, &arg_vals)
        }
        Expr::List(items) => {
            let mut out = Vec::with_capacity(items.len());
            for it in items {
                out.push(eval_to_value_async(env, state, it, stack).await?);
            }
            Ok(Value::Array(out))
        }
        Expr::Dict(pairs) => {
            let mut m = Map::new();
            for (k, v) in pairs {
                let key_v = eval_to_value_async(env, state, k, stack).await?;
                let key = match key_v {
                    Value::String(s) => s,
                    _ => crate::value::value_to_string(&key_v),
                };
                m.insert(key, eval_to_value_async(env, state, v, stack).await?);
            }
            Ok(Value::Object(m))
        }
        Expr::RegexLiteral { pattern, flags } => {
            let mut m = Map::new();
            m.insert(crate::value::RJ_REGEXP.to_string(), Value::Bool(true));
            m.insert("pattern".to_string(), Value::String(pattern.clone()));
            m.insert("flags".to_string(), Value::String(flags.clone()));
            Ok(Value::Object(m))
        }
    }
}

pub(super) async fn eval_for_output_async(
    env: &Environment,
    state: &mut RenderState<'_>,
    e: &Expr,
    stack: &mut CtxStack,
) -> Result<String> {
    match e {
        Expr::Literal(v) => Ok(crate::value::value_to_string(v)),
        Expr::Variable(name) => {
            let v = env.resolve_variable_ref(stack, name)?;
            let s = crate::value::value_to_string(v.as_ref());
            if env.autoescape && !crate::value::is_marked_safe(v.as_ref()) {
                Ok(crate::filters::escape_html(&s))
            } else {
                Ok(s)
            }
        }
        Expr::Filter { name, input, args } => {
            if args.is_empty() && !filter_chain_has_async_override(env, e) {
                if let Some((rev_names, leaf)) =
                    peel_builtin_upper_lower_length_chain(e, &env.custom_filters)
                {
                    match leaf {
                        Expr::Variable(var_name) => {
                            let v = env.resolve_variable_ref(stack, var_name)?;
                            let input_safe = crate::value::is_marked_safe(v.as_ref());
                            match apply_builtin_filter_chain_on_cow_value(v, &rev_names) {
                                Ok(val) => {
                                    let s = crate::value::value_to_string(&val);
                                    let escape = env.autoescape
                                        && match &val {
                                            Value::String(_) => !input_safe,
                                            _ => true,
                                        };
                                    if escape {
                                        return Ok(crate::filters::escape_html(&s));
                                    }
                                    return Ok(s);
                                }
                                Err(e) => return Err(e),
                            }
                        }
                        Expr::Literal(Value::String(s)) => {
                            let mut current = s.clone();
                            for n in &rev_names {
                                match *n {
                                    "upper" => current = current.to_uppercase(),
                                    "lower" => current = current.to_lowercase(),
                                    "trim" => {
                                        current = current
                                            .trim_matches(|c: char| c.is_whitespace())
                                            .to_string();
                                    }
                                    "capitalize" => {
                                        current =
                                            crate::filters::capitalize_string_slice(&current);
                                    }
                                    "length" => {
                                        let s = current.chars().count().to_string();
                                        let escape = env.autoescape;
                                        return Ok(if escape {
                                            crate::filters::escape_html(&s)
                                        } else {
                                            s
                                        });
                                    }
                                    _ => unreachable!(),
                                }
                            }
                            let escape = env.autoescape;
                            return Ok(if escape {
                                crate::filters::escape_html(&current)
                            } else {
                                current
                            });
                        }
                        Expr::Literal(Value::Array(a)) if rev_names == ["length"] => {
                            let s = a.len().to_string();
                            let escape = env.autoescape;
                            return Ok(if escape {
                                crate::filters::escape_html(&s)
                            } else {
                                s
                            });
                        }
                        _ => {}
                    }
                }
            }
            if args.is_empty() && !env.custom_filters.contains_key(name) && !env.async_custom_filters.contains_key(name) {
                if let Expr::Variable(var_name) = input.as_ref() {
                    let input_v = env.resolve_variable_ref(stack, var_name)?;
                    match name.as_str() {
                        "upper" => {
                            let out =
                                crate::value::value_to_string(input_v.as_ref()).to_uppercase();
                            return if env.autoescape
                                && !crate::value::is_marked_safe(input_v.as_ref())
                            {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "lower" => {
                            let out =
                                crate::value::value_to_string(input_v.as_ref()).to_lowercase();
                            return if env.autoescape
                                && !crate::value::is_marked_safe(input_v.as_ref())
                            {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "length" => {
                            let n = match input_v.as_ref() {
                                Value::String(s) => s.chars().count(),
                                Value::Array(a) => a.len(),
                                Value::Object(o) => o.len(),
                                v if is_undefined_value(v) => 0,
                                _ => 0,
                            };
                            return Ok(n.to_string());
                        }
                        "capitalize" => {
                            let out =
                                crate::filters::chain_capitalize_like_builtin(input_v.as_ref());
                            let s = crate::value::value_to_string(&out);
                            return if env.autoescape
                                && !crate::value::is_marked_safe(input_v.as_ref())
                            {
                                Ok(crate::filters::escape_html(&s))
                            } else {
                                Ok(s)
                            };
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::String(s)) = input.as_ref() {
                    match name.as_str() {
                        "upper" => {
                            let out = s.to_uppercase();
                            return if env.autoescape {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "lower" => {
                            let out = s.to_lowercase();
                            return if env.autoescape {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        "length" => {
                            return Ok(s.chars().count().to_string());
                        }
                        "capitalize" => {
                            let out = crate::filters::capitalize_string_slice(s);
                            return if env.autoescape {
                                Ok(crate::filters::escape_html(&out))
                            } else {
                                Ok(out)
                            };
                        }
                        _ => {}
                    }
                }
                if let Expr::Literal(Value::Array(a)) = input.as_ref() {
                    if name == "length" {
                        return Ok(a.len().to_string());
                    }
                }
            }
            let v = eval_to_value_async(env, state, e, stack).await?;
            let s = crate::value::value_to_string(&v);
            if env.autoescape && !crate::value::is_marked_safe(&v) {
                Ok(crate::filters::escape_html(&s))
            } else {
                Ok(s)
            }
        }
        _ => {
            let v = eval_to_value_async(env, state, e, stack).await?;
            let s = crate::value::value_to_string(&v);
            if env.autoescape && !crate::value::is_marked_safe(&v) {
                Ok(crate::filters::escape_html(&s))
            } else {
                Ok(s)
            }
        }
    }
}
