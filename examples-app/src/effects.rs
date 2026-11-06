//! The guide's effects and transformers: `effects.ts` (content and search),
//! `sections/patterns/effects.ts` (the pattern demos) and the inline transformers the patterns
//! register. TS effects mutate `context.getSession()` in place; these use `update_session`.

use std::sync::Arc;

use forge_core::Value;
use forge_core::engine::errors::ForgeResult;
use forge_core::engine::registries::FunctionEntry;
use forge_core::engine::runtime::context::EffectContext;
use forge_core::val;

use crate::data::{FormDataStore, GuideContentStore, MocksApi, long_date};
use crate::search::GuideSearch;

/// `GuideDeps`.
pub struct GuideDeps {
    pub content: GuideContentStore,
    pub search: GuideSearch,
    pub forms: FormDataStore,
    pub mocks: MocksApi,
}

fn arg(args: &[Value], i: usize) -> Value {
    args.get(i).cloned().unwrap_or(Value::Undefined)
}

fn arg_str(args: &[Value], i: usize) -> String {
    arg(args, i).to_js_string()
}

fn arg_strings(args: &[Value], i: usize) -> Vec<String> {
    arg(args, i).as_array().map(|a| a.iter().map(Value::to_js_string).collect()).unwrap_or_default()
}

/// JS `parseInt(String(v), 10)`; `None` for NaN.
fn parse_int(v: &Value) -> Option<i64> {
    let s = v.to_js_string();
    let s = s.trim_start();
    let (sign, digits) = match s.strip_prefix('-') {
        Some(rest) => (-1, rest),
        None => (1, s.strip_prefix('+').unwrap_or(s)),
    };
    let digits: String = digits.chars().take_while(char::is_ascii_digit).collect();
    digits.parse::<i64>().ok().map(|n| sign * n)
}

/// `value ?? fallback`.
fn nullish(v: Value, fallback: impl FnOnce() -> Value) -> Value {
    match v {
        Value::Undefined | Value::Null => fallback(),
        v => v,
    }
}

fn items(v: &Value) -> Vec<Value> {
    v.as_array().map(|a| a.to_vec()).unwrap_or_default()
}

fn session_id(ctx: &EffectContext) -> Option<String> {
    ctx.get_session().get("id").as_str().map(str::to_string)
}

/// `session.patternDrafts[code]`, creating both levels if missing.
fn drafts_entry<'a>(session: &'a mut Value, code: &str) -> &'a mut Value {
    if !matches!(session.get("patternDrafts"), Value::Object(_)) {
        session.set("patternDrafts", Value::empty_object());
    }
    let drafts = session.as_object_mut().unwrap().get_mut("patternDrafts").unwrap().as_object_mut().unwrap();
    if !matches!(drafts.get(code), Some(Value::Object(_))) {
        drafts.insert(code.into(), Value::empty_object());
    }
    drafts.get_mut(code).unwrap()
}

fn set_answers_from(ctx: &EffectContext, stored: &Value, only_missing: bool) -> ForgeResult<()> {
    if let Value::Object(o) = stored {
        for (code, value) in o.iter() {
            if !only_missing || !ctx.has_answer(code) {
                ctx.set_answer(code, value.clone())?;
            }
        }
    }
    Ok(())
}

fn clear_all_answers(ctx: &EffectContext) {
    for key in ctx.get_all_answers().keys() {
        ctx.clear_answer(key);
    }
}

/// Merges the current answers for `field_codes` over each collection item (`{ ...item, code: answer ?? item[code] }`).
fn merge_indexed(ctx: &EffectContext, collection: &[Value], field_codes: &[String]) -> Vec<Value> {
    collection
        .iter()
        .enumerate()
        .map(|(index, item)| {
            let mut merged = item.clone();
            if !matches!(merged, Value::Object(_)) {
                merged = Value::empty_object();
            }
            for code in field_codes {
                let answer = ctx.get_answer(&format!("{code}_{index}"));
                merged.set(code.as_str(), nullish(answer, || item.get(code)));
            }
            merged
        })
        .collect()
}

fn set_indexed_answers(ctx: &EffectContext, collection: &[Value], field_codes: &[String]) -> ForgeResult<()> {
    for (index, item) in collection.iter().enumerate() {
        for code in field_codes {
            ctx.set_answer(&format!("{code}_{index}"), nullish(item.get(code), || Value::from("")))?;
        }
    }
    Ok(())
}

/// `stored[collectionCode] ?? context.getData(collectionCode) ?? []`.
fn stored_collection(ctx: &EffectContext, pattern_code: &str, collection_code: &str) -> Vec<Value> {
    let stored = ctx.get_session().get("patternDrafts").get(pattern_code).get(collection_code);
    items(&nullish(stored, || nullish(ctx.get_data(collection_code), || Value::array(vec![]))))
}

fn bundle_item(ctx: &EffectContext, field_codes: &[String]) -> Value {
    let mut item = Value::empty_object();
    for code in field_codes {
        let value = ctx.get_answer(code);
        if !value.is_undefined() {
            item.set(code.as_str(), value);
        }
    }
    item
}

fn clear_fields(ctx: &EffectContext, field_codes: &[String]) -> ForgeResult<()> {
    for code in field_codes {
        ctx.set_answer(code, Value::Undefined)?;
    }
    Ok(())
}

/// The `:index` route parameter, when it addresses an item of `collection`.
fn route_index(ctx: &EffectContext, len: usize) -> Option<usize> {
    let raw = ctx.get_request_param("index");
    if raw.is_undefined() {
        return None;
    }
    parse_int(&raw).filter(|&i| i >= 0 && (i as usize) < len).map(|i| i as usize)
}

macro_rules! effect {
    ($name:literal, $deps:ident, |$ctx:ident, $args:ident| $body:block) => {{
        let $deps = $deps.clone();
        #[allow(unused_variables)]
        FunctionEntry::effect($name, move |$ctx: EffectContext, $args: Vec<Value>| {
            let $deps = $deps.clone();
            async move { $body }
        })
    }};
}

pub fn guide_effects(deps: &Arc<GuideDeps>) -> Vec<FunctionEntry> {
    vec![
        effect!("LoadContent", deps, |ctx, args| {
            let slug = arg_str(&args, 0);
            if let Some(entry) = deps.content.get(&slug) {
                ctx.set_data("content", Value::from(entry.markdown.as_str()))?;
                ctx.set_data("headings", Value::array(deps.content.headings(&slug).iter().map(|h| h.to_value()).collect()))?;
                ctx.set_data("pageTitle", Value::from(entry.title.as_str()))?;
            }
            Ok(())
        }),
        effect!("SearchContent", deps, |ctx, args| {
            let query = ctx.get_query_param("q").as_str().unwrap_or_default().to_string();
            if query.is_empty() {
                ctx.set_data("searchResults", Value::array(vec![]))?;
                ctx.set_data("searchQuery", Value::from(""))?;
            } else {
                ctx.set_data("searchResults", deps.search.search(&query))?;
                ctx.set_data("searchQuery", Value::from(query))?;
            }
            Ok(())
        }),
    ]
}

pub fn pattern_effects(deps: &Arc<GuideDeps>) -> Vec<FunctionEntry> {
    vec![
        effect!("LoadAnswers", deps, |ctx, args| {
            let Some(sid) = session_id(&ctx) else { return Ok(()) };
            if let Some(stored) = deps.forms.get(&sid, &arg_str(&args, 0)) {
                set_answers_from(&ctx, &Value::object(stored), true)?;
            }
            Ok(())
        }),
        effect!("LoadDraftAnswers", deps, |ctx, args| {
            let stored = ctx.get_session().get("patternDrafts").get(&arg_str(&args, 0));
            set_answers_from(&ctx, &stored, true)
        }),
        effect!("SaveAnswers", deps, |ctx, args| {
            let Some(sid) = session_id(&ctx) else { return Ok(()) };
            for field in ctx.get_fields_to_clear() {
                ctx.clear_answer(&field);
            }
            deps.forms.set(&sid, &arg_str(&args, 0), ctx.get_all_answers());
            Ok(())
        }),
        effect!("SaveDraftAnswers", deps, |ctx, args| {
            let answers = ctx.get_all_answers();
            ctx.update_session(|s| {
                let entry = drafts_entry(s, &arg_str(&args, 0));
                for (k, v) in answers {
                    entry.set(k, v);
                }
            });
            Ok(())
        }),
        effect!("SaveSubmitStateToSession", deps, |ctx, args| {
            ctx.update_session(|s| {
                if !matches!(s.get("patternSubmitted"), Value::Object(_)) {
                    s.set("patternSubmitted", Value::empty_object());
                }
                let mut submitted = s.get("patternSubmitted");
                submitted.set(arg_str(&args, 0), arg(&args, 1));
                s.set("patternSubmitted", submitted);
            });
            Ok(())
        }),
        effect!("ClearAnswers", deps, |ctx, args| {
            let Some(sid) = session_id(&ctx) else { return Ok(()) };
            deps.forms.delete(&sid, &arg_str(&args, 0));
            clear_all_answers(&ctx);
            Ok(())
        }),
        effect!("ClearDraftAnswers", deps, |ctx, args| {
            ctx.update_session(|s| {
                if let Some(Value::Object(drafts)) = s.as_object_mut().and_then(|o| o.get_mut("patternDrafts")) {
                    std::sync::Arc::make_mut(drafts).shift_remove(arg_str(&args, 0).as_str());
                }
            });
            clear_all_answers(&ctx);
            Ok(())
        }),
        effect!("SeedAnswers", deps, |ctx, args| {
            let answers = arg(&args, 1);
            if let Some(sid) = session_id(&ctx) {
                deps.forms.set(&sid, &arg_str(&args, 0), answers.as_object().map(|o| (**o).clone()).unwrap_or_default());
            }
            set_answers_from(&ctx, &answers, false)
        }),
        effect!("SeedDraftAnswers", deps, |ctx, args| {
            let answers = arg(&args, 1);
            ctx.update_session(|s| {
                let entry = drafts_entry(s, &arg_str(&args, 0));
                if let Value::Object(o) = &answers {
                    for (k, v) in o.iter() {
                        entry.set(k.clone(), v.clone());
                    }
                }
            });
            set_answers_from(&ctx, &answers, false)
        }),
        effect!("AddItemToCollection", deps, |ctx, args| {
            let (collection_code, field_codes) = (arg_str(&args, 0), arg_strings(&args, 1));
            let item = bundle_item(&ctx, &field_codes);
            let mut collection = items(&ctx.get_answer(&collection_code));
            collection.push(item);
            ctx.set_answer(&collection_code, Value::array(collection))?;
            clear_fields(&ctx, &field_codes)
        }),
        effect!("RemoveItemFromCollection", deps, |ctx, args| {
            let collection_code = arg_str(&args, 0);
            let raw = ctx.get_query_param("remove");
            if raw.is_undefined() {
                return Ok(());
            }
            let mut collection = items(&ctx.get_answer(&collection_code));
            if let Some(i) = parse_int(&raw).filter(|&i| i >= 0 && (i as usize) < collection.len()) {
                collection.remove(i as usize);
                ctx.set_answer(&collection_code, Value::array(collection))?;
            }
            Ok(())
        }),
        effect!("LoadItemForDelete", deps, |ctx, args| {
            let (collection_code, field_codes) = (arg_str(&args, 0), arg_strings(&args, 1));
            let collection = items(&ctx.get_answer(&collection_code));
            let Some(index) = route_index(&ctx, collection.len()) else { return Ok(()) };
            for code in &field_codes {
                let v = collection[index].get(code);
                if !v.is_undefined() {
                    ctx.set_data(code, v)?;
                }
            }
            Ok(())
        }),
        effect!("DeleteItemFromCollection", deps, |ctx, args| {
            let collection_code = arg_str(&args, 0);
            let mut collection = items(&ctx.get_answer(&collection_code));
            let Some(index) = route_index(&ctx, collection.len()) else { return Ok(()) };
            collection.remove(index);
            ctx.set_answer(&collection_code, Value::array(collection))
        }),
        effect!("SetAnswer", deps, |ctx, args| { ctx.set_answer(&arg_str(&args, 0), arg(&args, 1)) }),
        effect!("LoadItemForEdit", deps, |ctx, args| {
            let (pattern_code, collection_code, field_codes) = (arg_str(&args, 0), arg_str(&args, 1), arg_strings(&args, 2));
            let collection = items(&ctx.get_answer(&collection_code));
            let Some(index) = route_index(&ctx, collection.len()) else { return Ok(()) };
            for code in &field_codes {
                let v = collection[index].get(code);
                if !v.is_undefined() {
                    ctx.set_answer(code, v)?;
                }
            }
            ctx.update_session(|s| drafts_entry(s, &pattern_code).set("editingIndex", Value::Number(index as f64)));
            Ok(())
        }),
        effect!("InitializeRepeatingFieldsets", deps, |ctx, args| {
            let (pattern_code, collection_code, field_codes) = (arg_str(&args, 0), arg_str(&args, 1), arg_strings(&args, 2));
            let stored = ctx.get_session().get("patternDrafts").get(&pattern_code).get(&collection_code);
            let collection = items(&stored);
            if collection.is_empty() {
                return Ok(());
            }
            ctx.set_data(&collection_code, Value::array(collection.clone()))?;
            set_indexed_answers(&ctx, &collection, &field_codes)
        }),
        effect!("AddRepeatingItem", deps, |ctx, args| {
            let (pattern_code, collection_code, field_codes) = (arg_str(&args, 0), arg_str(&args, 1), arg_strings(&args, 2));
            let collection = stored_collection(&ctx, &pattern_code, &collection_code);
            let mut updated = merge_indexed(&ctx, &collection, &field_codes);
            updated.push(Value::from_pairs(field_codes.iter().map(|c| (c.as_str(), Value::from("")))));
            let value = Value::array(updated.clone());
            ctx.update_session(|s| drafts_entry(s, &pattern_code).set(collection_code.as_str(), value.clone()));
            ctx.set_data(&collection_code, value)?;
            set_indexed_answers(&ctx, &updated, &field_codes)
        }),
        effect!("RemoveRepeatingItem", deps, |ctx, args| {
            let (pattern_code, collection_code, field_codes) = (arg_str(&args, 0), arg_str(&args, 1), arg_strings(&args, 2));
            if !matches!(ctx.get_session().get("patternDrafts").get(&pattern_code), Value::Object(_)) {
                return Ok(());
            }
            let collection = stored_collection(&ctx, &pattern_code, &collection_code);
            let action = ctx.get_post_data("action");
            let Some(index) = action
                .as_str()
                .and_then(|a| parse_int(&Value::from(a.replacen("remove_", "", 1))))
                .filter(|&i| i >= 0 && (i as usize) < collection.len())
            else {
                return Ok(());
            };
            let mut updated = merge_indexed(&ctx, &collection, &field_codes);
            updated.remove(index as usize);
            let value = Value::array(updated.clone());
            ctx.update_session(|s| drafts_entry(s, &pattern_code).set(collection_code.as_str(), value.clone()));
            ctx.set_data(&collection_code, value)?;
            set_indexed_answers(&ctx, &updated, &field_codes)
        }),
        effect!("SaveRepeatingItems", deps, |ctx, args| {
            let (pattern_code, collection_code, field_codes) = (arg_str(&args, 0), arg_str(&args, 1), arg_strings(&args, 2));
            let collection = stored_collection(&ctx, &pattern_code, &collection_code);
            let value = Value::array(merge_indexed(&ctx, &collection, &field_codes));
            ctx.update_session(|s| drafts_entry(s, &pattern_code).set(collection_code.as_str(), value));
            Ok(())
        }),
        effect!("LookupAddress", deps, |ctx, args| {
            let postcode = ctx.get_answer("postcode");
            if !postcode.truthy() {
                return Ok(());
            }
            let a = deps.mocks.lookup_address(&postcode.to_js_string());
            ctx.set_answer("addressLine1", a.line1.into())?;
            ctx.set_answer("addressLine2", a.line2.into())?;
            ctx.set_answer("addressTown", a.town.into())?;
            ctx.set_answer("addressCounty", a.county.into())?;
            ctx.set_answer("addressPostcode", a.postcode.into())
        }),
        effect!("DrawLotteryNumbers", deps, |ctx, args| {
            let draw = deps.mocks.lottery_balls();
            for (i, n) in draw.balls.iter().enumerate() {
                ctx.set_data(&format!("ball{}", i + 1), Value::from(n.to_string()))?;
            }
            ctx.set_data("bonusBall", Value::from(draw.bonus_ball.to_string()))?;
            ctx.set_data("drawDate", Value::from(draw.draw_date))
        }),
        effect!("SimulateLogin", deps, |ctx, args| {
            let user = Value::from_pairs([("name", arg(&args, 0)), ("role", arg(&args, 1))]);
            ctx.update_session(|s| s.set("demoUser", user));
            Ok(())
        }),
        effect!("SimulateLogout", deps, |ctx, args| {
            ctx.update_session(|s| {
                if let Some(o) = s.as_object_mut() {
                    o.shift_remove("demoUser");
                }
            });
            Ok(())
        }),
        effect!("EditItemInCollection", deps, |ctx, args| {
            let (pattern_code, collection_code, field_codes) = (arg_str(&args, 0), arg_str(&args, 1), arg_strings(&args, 2));
            let editing = ctx.get_session().get("patternDrafts").get(&pattern_code).get("editingIndex");
            if editing.is_undefined() {
                return Ok(());
            }
            let index = editing.as_f64().unwrap_or(f64::NAN);
            let mut collection = items(&ctx.get_answer(&collection_code));
            if !(index >= 0.0 && (index as usize) < collection.len()) {
                return Ok(());
            }
            collection[index as usize] = bundle_item(&ctx, &field_codes);
            ctx.set_answer(&collection_code, Value::array(collection))?;
            clear_fields(&ctx, &field_codes)?;
            ctx.update_session(|s| {
                if let Some(o) = drafts_entry(s, &pattern_code).as_object_mut() {
                    o.shift_remove("editingIndex");
                }
            });
            Ok(())
        }),
        effect!("SearchStations", deps, |ctx, args| {
            let query = ctx.get_answer("searchQuery").as_str().map(|q| q.trim().to_lowercase()).unwrap_or_default();
            if query.is_empty() {
                return ctx.set_data("searchResults", Value::array(vec![]));
            }
            let results: Vec<Value> = stations()
                .iter()
                .enumerate()
                .filter(|(_, s)| s.name.to_lowercase().contains(&query))
                .map(|(i, s)| station_summary(i, s, &format!("station/{i}")))
                .collect();
            ctx.set_data("searchResults", Value::array(results))?;
            ctx.set_data("hasSearched", Value::from("true"))
        }),
        effect!("LoadStation", deps, |ctx, args| {
            let raw = ctx.get_request_param("index");
            if raw.is_undefined() {
                return Ok(());
            }
            let all = stations();
            if let Some(i) = parse_int(&raw).filter(|&i| i >= 0 && (i as usize) < all.len()) {
                let s = &all[i as usize];
                ctx.set_data("stationName", s.name.into())?;
                ctx.set_data("stationLines", s.lines.into())?;
                ctx.set_data("stationZone", s.zone.into())?;
                ctx.set_data("stationOpened", s.opened.into())?;
                ctx.set_data("stationDescription", s.description.into())?;
                ctx.set_data("stationPage", Value::from((i / 5 + 1).to_string()))?;
            }
            Ok(())
        }),
        effect!("LoadStationPage", deps, |ctx, args| {
            const PAGE_SIZE: usize = 5;
            // The paged list leaves out the hidden 21st station.
            let all = &stations()[..20];
            let total_pages = all.len().div_ceil(PAGE_SIZE) as i64;
            let page_param = nullish(ctx.get_query_param("page"), || Value::from("1"));
            let page = parse_int(&page_param).filter(|&p| p != 0).unwrap_or(1).max(1).min(total_pages);
            let start = ((page - 1) as usize) * PAGE_SIZE;
            let page_items: Vec<Value> = all
                .iter()
                .enumerate()
                .skip(start)
                .take(PAGE_SIZE)
                .map(|(i, s)| station_summary(i, s, &format!("detail/{i}")))
                .collect();
            ctx.set_data("stations", Value::array(page_items))?;
            ctx.set_data("currentPage", Value::Number(page as f64))?;
            ctx.set_data("pages", Value::array(vec![Value::Number(0.0); total_pages as usize]))
        }),
        effect!("LoadCaseOverview", deps, |ctx, args| {
            let case = case_overview();
            let goals = items(&case.get("goals"));
            let achieved = goals.iter().filter(|g| g.get("status").as_str() == Some("ACHIEVED")).count();
            ctx.set_data("case", case.clone())?;
            ctx.set_data("goalsAchieved", Value::Number(achieved as f64))?;
            ctx.set_data("goalsTotal", Value::Number(goals.len() as f64))?;
            let compliance = case.get("compliance");
            let attended = compliance.get("attended").as_f64().unwrap_or(0.0);
            let total = attended + compliance.get("missed").as_f64().unwrap_or(0.0);
            let rate = if total > 0.0 { js_round(attended / total * 100.0) } else { 0.0 };
            ctx.set_data("complianceRate", Value::Number(rate))
        }),
        effect!("LoadBlogPosts", deps, |ctx, args| {
            let posts = nullish(ctx.get_session().get("blogPosts"), || Value::array(vec![]));
            let count = items(&posts).len();
            ctx.set_data("posts", posts)?;
            if count > 0 {
                ctx.set_data("postCount", Value::Number(count as f64))?;
            }
            Ok(())
        }),
        effect!("SaveBlogPost", deps, |ctx, args| {
            let title = ctx.get_answer("postTitle").as_str().map(|t| t.trim().to_string()).unwrap_or_default();
            let body = ctx.get_answer("postBody").as_str().map(|t| t.trim().to_string()).unwrap_or_default();
            if title.is_empty() || body.is_empty() {
                return Ok(());
            }
            let post = Value::from_pairs([
                ("title", Value::from(title)),
                ("body", Value::from(body)),
                ("date", Value::from(long_date(false))),
            ]);
            ctx.update_session(|s| {
                let mut posts = items(&s.get("blogPosts"));
                posts.insert(0, post);
                s.set("blogPosts", Value::array(posts));
            });
            ctx.set_answer("postTitle", Value::Undefined)?;
            ctx.set_answer("postBody", Value::Undefined)
        }),
        effect!("LoadPlanGoals", deps, |ctx, args| {
            let goals = items(&stored_plan_goals(&ctx));
            let active = goals.iter().filter(|g| g.get("status").as_str() == Some("ACTIVE")).count();
            ctx.set_data("activeGoalCount", Value::Number(active as f64))?;
            ctx.set_data("totalGoalCount", Value::Number(goals.len() as f64))?;
            ctx.set_data("goals", Value::array(goals))
        }),
        effect!("InitializePlanActions", deps, |ctx, args| {
            let active: Vec<Value> =
                items(&stored_plan_goals(&ctx)).into_iter().filter(|g| g.get("status").as_str() == Some("ACTIVE")).collect();
            ctx.set_data("activeGoals", Value::array(active.clone()))?;
            for (index, goal) in active.iter().enumerate() {
                let actions = items(&goal.get("actions"));
                let key = format!("action_{index}");
                if !actions.is_empty() && !ctx.has_answer(&key) {
                    let joined = actions.iter().map(Value::to_js_string).collect::<Vec<_>>().join(", ");
                    ctx.set_answer(&key, Value::from(joined))?;
                }
            }
            Ok(())
        }),
        effect!("SavePlanActions", deps, |ctx, args| {
            let stored = items(&stored_plan_goals(&ctx));
            let mut active_index = 0;
            let mut updated = Vec::with_capacity(stored.len());
            for goal in stored {
                if goal.get("status").as_str() != Some("ACTIVE") {
                    updated.push(goal);
                    continue;
                }
                let key = format!("action_{active_index}");
                let action = ctx.get_answer(&key);
                ctx.set_answer(&key, Value::Undefined)?;
                active_index += 1;
                match action.as_str().map(str::trim) {
                    Some(a) if !a.is_empty() => {
                        let actions: Vec<Value> =
                            a.split(',').map(str::trim).filter(|s| !s.is_empty()).map(Value::from).collect();
                        let mut g = goal.clone();
                        g.set("actions", Value::array(actions));
                        updated.push(g);
                    }
                    _ => updated.push(goal),
                }
            }
            let value = Value::array(updated);
            ctx.update_session(|s| drafts_entry(s, "collection-validation").set("goals", value));
            Ok(())
        }),
    ]
}

/// `Math.round` (halves round towards +∞).
fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

fn stored_plan_goals(ctx: &EffectContext) -> Value {
    nullish(ctx.get_session().get("patternDrafts").get("collection-validation").get("goals"), plan_goals)
}

/// The transformers the pattern demos register inline.
pub fn pattern_transformers() -> Vec<FunctionEntry> {
    vec![
        FunctionEntry::transformer("RiskLevelTag", |value, _| {
            let (text, colour) = match value.as_str() {
                Some("VERY_HIGH") => ("Very high".to_string(), "red"),
                Some("HIGH") => ("High".to_string(), "red"),
                Some("MEDIUM") => ("Medium".to_string(), "yellow"),
                Some("LOW") => ("Low".to_string(), "green"),
                _ => (value.to_js_string(), "grey"),
            };
            Ok(Value::from(format!("<strong class=\"govuk-tag govuk-tag--{colour}\">{text}</strong>")))
        }),
        FunctionEntry::transformer("GoalsSummary", |value, _| {
            let goals = items(value);
            let achieved = goals.iter().filter(|g| g.get("status").as_str() == Some("ACHIEVED")).count();
            Ok(Value::from(format!("{achieved} of {} goals achieved", goals.len())))
        }),
        FunctionEntry::transformer("ComplianceSummary", |value, _| {
            let attended = value.get("attended").as_f64().unwrap_or(f64::NAN);
            let total = attended + value.get("missed").as_f64().unwrap_or(f64::NAN);
            let rate = if total > 0.0 { js_round(attended / total * 100.0) } else { 0.0 };
            Ok(Value::from(format!("{}% attendance rate", Value::Number(rate).to_js_string())))
        }),
    ]
}

pub struct Station {
    pub name: &'static str,
    pub lines: &'static str,
    pub zone: &'static str,
    pub opened: &'static str,
    pub description: &'static str,
}

fn station_summary(index: usize, s: &Station, href: &str) -> Value {
    Value::from_pairs([
        ("index", Value::Number(index as f64)),
        ("name", s.name.into()),
        ("lines", s.lines.into()),
        ("zone", s.zone.into()),
        ("href", Value::from(href)),
    ])
}

pub fn stations() -> &'static [Station] {
    &[
        Station { name: "Baker Street", lines: "Metropolitan, Hammersmith & City, Circle, Jubilee, Bakerloo", zone: "1", opened: "10 January 1863", description: "One of the original stations on the Metropolitan Railway, the world's first underground railway. Named after the nearby street, famously associated with the fictional detective Sherlock Holmes." },
        Station { name: "King's Cross St Pancras", lines: "Northern, Piccadilly, Victoria, Metropolitan, Circle", zone: "1", opened: "10 January 1863", description: "The busiest interchange on the Underground, serving six lines and connecting to major national rail and international Eurostar services." },
        Station { name: "Oxford Circus", lines: "Central, Bakerloo, Victoria", zone: "1", opened: "30 July 1900", description: "Located at the junction of Oxford Street and Regent Street, this is one of the busiest stations in London with over 100 million passengers per year." },
        Station { name: "Camden Town", lines: "Northern", zone: "2", opened: "22 June 1907", description: "A major interchange on the Northern line where the Edgware and High Barnet branches diverge. The station is often exit-only on Sunday afternoons due to crowding from the nearby markets." },
        Station { name: "Brixton", lines: "Victoria", zone: "2", opened: "23 July 1971", description: "The southern terminus of the Victoria line and one of the last stations to be built on the Underground. It was the first station on the network to have platform edge doors, installed in a trial." },
        Station { name: "Canary Wharf", lines: "Jubilee", zone: "2", opened: "17 September 1999", description: "A cavernous station designed by Norman Foster, serving the Canary Wharf financial district. Its vast underground ticket hall is one of the largest enclosed spaces in Europe." },
        Station { name: "Westminster", lines: "District, Circle, Jubilee", zone: "1", opened: "24 December 1868", description: "Serves the Houses of Parliament, Big Ben, and Westminster Abbey. The deep-level Jubilee line platforms, opened in 1999, feature a striking exposed concrete design by Michael Hopkins." },
        Station { name: "Paddington", lines: "Bakerloo, Circle, District, Hammersmith & City", zone: "1", opened: "10 January 1863", description: "One of the original Metropolitan Railway stations, adjacent to the mainline terminus designed by Isambard Kingdom Brunel. Provides connections to Heathrow via the Elizabeth line." },
        Station { name: "Liverpool Street", lines: "Central, Circle, Hammersmith & City, Metropolitan", zone: "1", opened: "1 February 1874", description: "Serves the adjacent mainline station and the City of London financial district. The station was extensively rebuilt in the 1990s as part of the Broadgate development." },
        Station { name: "Waterloo", lines: "Bakerloo, Northern, Jubilee, Waterloo & City", zone: "1", opened: "8 August 1898", description: "Named after the Battle of Waterloo, this station serves the South Bank cultural complex and connects to the mainline station, one of the busiest in the country." },
        Station { name: "Victoria", lines: "District, Circle, Victoria", zone: "1", opened: "24 December 1868", description: "A major interchange between three Underground lines and the mainline terminus serving Gatwick Airport and the south coast. The Victoria line was named after this station." },
        Station { name: "Angel", lines: "Northern", zone: "1", opened: "17 November 1901", description: "Named after the Angel Inn, a former coaching inn. The station was completely rebuilt in the early 1990s and features the longest escalator on the Underground at 60 metres." },
        Station { name: "Notting Hill Gate", lines: "Central, Circle, District", zone: "1/2", opened: "1 October 1868", description: "Serves the Notting Hill area, known for the annual Carnival and Portobello Road Market. The station was rebuilt in 1959 to combine two separate stations into one." },
        Station { name: "Stratford", lines: "Central, Jubilee", zone: "3", opened: "4 December 1946", description: "A major transport hub in east London, extensively expanded for the 2012 Olympic Games. Also served by the DLR, Elizabeth line, and national rail services." },
        Station { name: "Kingsbury", lines: "Jubilee", zone: "4", opened: "10 December 1932", description: "Originally opened on the Metropolitan Railway's Stanmore branch, it transferred to the Bakerloo line in 1939 and then to the Jubilee line in 1979." },
        Station { name: "Kennington", lines: "Northern", zone: "1/2", opened: "18 December 1890", description: "An important junction on the Northern line where the Charing Cross and Bank branches merge. The station features a unique loop tunnel used by terminating trains." },
        Station { name: "Kilburn", lines: "Jubilee", zone: "2", opened: "24 November 1879", description: "Originally named Kilburn & Brondesbury when it opened on the Metropolitan Railway. Not to be confused with Kilburn Park on the Bakerloo line or Kilburn High Road on the Overground." },
        Station { name: "Pimlico", lines: "Victoria", zone: "1", opened: "14 September 1972", description: "The newest station in Zone 1, opened nine months after the rest of the Victoria line extension. It serves Tate Britain and the surrounding residential area." },
        Station { name: "Piccadilly Circus", lines: "Bakerloo, Piccadilly", zone: "1", opened: "10 March 1906", description: "Located beneath the famous junction and its iconic illuminated advertising signs. The circular ticket hall, designed by Charles Holden, was a pioneering piece of underground architecture." },
        Station { name: "Bank", lines: "Central, Northern, Waterloo & City", zone: "1", opened: "25 February 1900", description: "Serves the Bank of England and the heart of the City of London. The station complex, shared with Monument, is one of the most labyrinthine on the network." },
        Station { name: "Waterloo Waterpark", lines: "Classified", zone: "Lh'owon", opened: "15 November 2811", description: "Welcome back.<br><br>I've awakened you from stasis and teleported you down to a planet where I need some work done. You are on Lh'owon, the homeworld of the S'pht.<br><br>I'm sure you're wondering why you were in stasis, what happened to the Marathon and Tau Ceti, and most of all where your rocket launcher and fusion gun are. There'll be plenty of time for explanations later.<br><br>Be careful, I'm sure you've already recognised some of our old friends.<br><br>Durandal" },
    ]
}

fn plan_goals() -> Value {
    val!([
        { "title": "Improve English skills", "status": "ACTIVE", "actions": ["Attend weekly literacy class", "Complete practice exercises"] },
        { "title": "Find stable housing", "status": "ACTIVE", "actions": [] },
        { "title": "Build employment skills", "status": "ACTIVE", "actions": [] },
        { "title": "Develop support network", "status": "FUTURE", "actions": [] }
    ])
}

fn case_overview() -> Value {
    val!({
        "name": { "firstName": "Sam", "lastName": "Jones" },
        "crn": "X123456",
        "tier": "A1",
        "status": "ACTIVE",
        "riskScores": {
            "overall": "HIGH", "selfHarm": "LOW", "publicProtection": "VERY_HIGH",
            "knownAdult": "MEDIUM", "children": "LOW", "staff": "LOW"
        },
        "sentence": {
            "type": "Community Order",
            "startDate": "15 January 2025",
            "endDate": "14 January 2027",
            "requirements": ["40 hours unpaid work", "Rehabilitation Activity Requirement"]
        },
        "goals": [
            { "title": "Find stable accommodation", "status": "ACHIEVED" },
            { "title": "Enrol in education programme", "status": "IN_PROGRESS" },
            { "title": "Attend substance misuse sessions", "status": "IN_PROGRESS" },
            { "title": "Complete unpaid work hours", "status": "NOT_STARTED" },
            { "title": "Secure part-time employment", "status": "NOT_STARTED" }
        ],
        "compliance": { "attended": 8, "missed": 1, "acceptableAbsences": 1, "warningLetters": 0 }
    })
}
