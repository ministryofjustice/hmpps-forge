//! GOV.UK Frontend components (port of `forge-govuk-components`).
//!
//! Each component maps its evaluated block to the upstream macro's `params` exactly as the TS
//! component does, then renders the upstream `govuk/components/*/template.njk` through Runjucks.
//! [`components()`] registers them with a Forge instance; the `Component` constants build blocks.

pub mod classes;
pub mod jsx;
pub mod validations;

/// `GovUKUtilityClasses`: GOV.UK Frontend utility class names (generated from the TS object).
pub fn utility_classes() -> Value {
    static CLASSES: std::sync::LazyLock<Value> =
        std::sync::LazyLock::new(|| serde_json::from_str(include_str!("utility_classes.json")).expect("utility classes"));
    CLASSES.clone()
}

use forge_core::authoring::{transformer, Component};
use forge_core::engine::registries::ComponentEntry;
use forge_core::schema::Schema;
use forge_core::value::{Map, Value};
use forge_runjucks::nunjucks_render;

/// An ordered params object; `undefined` entries are kept (and dropped on serialisation).
macro_rules! params {
    ($($key:literal => $value:expr),* $(,)?) => {{
        let mut map = Map::new();
        $( map.insert($key.into(), Value::from($value)); )*
        Value::object(map)
    }};
}

/// JS `a || b`.
fn or(a: Value, b: Value) -> Value {
    if a.truthy() { a } else { b }
}

/// JS `a ?? b`.
fn nullish(a: Value, b: Value) -> Value {
    if a.is_nullish() { b } else { a }
}

/// `props.html ? undefined : props.text`.
fn text_unless_html(p: &Value, text: &str, html: &str) -> Value {
    if p.get(html).truthy() { Value::Undefined } else { p.get(text) }
}

/// `normaliseGovukTextParam`.
fn text_param(v: Value) -> Value {
    match v {
        Value::Object(_) | Value::Array(_) | Value::Null | Value::Opaque(_) => v,
        Value::Undefined => Value::Undefined,
        Value::String(s) if s.is_empty() => Value::Undefined,
        other => Value::from_pairs([("text", other)]),
    }
}

/// `normaliseGovukFieldset`.
fn fieldset(fieldset: Value, legend: Value) -> Value {
    if fieldset.truthy() {
        return fieldset;
    }
    if legend.is_undefined() || legend.as_str() == Some("") {
        return Value::Undefined;
    }
    Value::from_pairs([("legend", Value::from_pairs([("text", legend)]))])
}

/// `normaliseGovukErrorMessage`: the first error's message.
fn error_message(errors: Value) -> Value {
    let first = errors.get("0");
    if !first.truthy() || first.get("message").as_str() == Some("") {
        return Value::Undefined;
    }
    Value::from_pairs([("text", first.get("message"))])
}

/// `renderGovukBlocksToHtml`: rendered nested blocks joined.
fn blocks_html(blocks: Value) -> Value {
    if !blocks.truthy() {
        return Value::Undefined;
    }
    let list = match &blocks {
        Value::Array(a) => a.iter().cloned().collect::<Vec<_>>(),
        _ => vec![blocks.clone()],
    };
    if list.is_empty() {
        return Value::Undefined;
    }
    Value::from(list.iter().map(|b| b.get("html").to_js_string()).collect::<String>())
}

/// `normaliseGovukTextHtmlContent` -> `(text, html)`.
fn text_html(text: Value, html: Value, blocks: Value) -> (Value, Value) {
    let rendered = blocks_html(blocks);
    let html = if rendered.is_undefined() { html } else { rendered };
    let text = if html.is_undefined() { text } else { Value::Undefined };
    (text, html)
}

/// `items.filter(item => item.visibleWhen !== false)`; `undefined` stays `undefined` (`?.`).
fn visible(items: Value) -> Value {
    match items {
        Value::Array(a) => Value::array(a.iter().filter(|i| !i.get("visibleWhen").strict_eq(&Value::Bool(false))).cloned().collect()),
        other => other,
    }
}

fn map_items(items: Value, f: impl Fn(&Value) -> Value) -> Value {
    match visible(items) {
        Value::Array(a) => Value::array(a.iter().map(f).collect()),
        other => other,
    }
}

fn entry(variant: &str, template: &'static str, params: fn(&Value) -> Value) -> ComponentEntry {
    ComponentEntry::new(variant).with_render(nunjucks_render(template, params))
}

fn field_entry(variant: &str, template: &'static str, input: Schema, params: fn(&Value) -> Value) -> ComponentEntry {
    entry(variant, template, params).with_input(input)
}

fn anchor_id_or_code(p: &Value) -> Option<String> {
    nullish(p.get("id"), p.get("code")).as_str().map(str::to_string)
}

fn anchor_prefix_or_code(p: &Value) -> Option<String> {
    or(p.get("idPrefix"), p.get("code")).as_str().map(str::to_string)
}

fn accordion(p: &Value) -> Value {
    let items = map_items(p.get("items"), |item| {
        let heading = item.get("heading");
        let summary = item.get("summary");
        let content = item.get("content");
        let (text, html) = text_html(content.get("text"), content.get("html"), content.get("blocks"));
        params! {
            "heading" => params! { "text" => text_unless_html(&heading, "text", "html"), "html" => heading.get("html") },
            "summary" => if summary.truthy() {
                params! { "text" => text_unless_html(&summary, "text", "html"), "html" => summary.get("html") }
            } else { Value::Undefined },
            "content" => params! { "text" => text, "html" => html },
            "expanded" => item.get("expanded"),
        }
    });
    params! {
        "id" => p.get("id"), "items" => items, "headingLevel" => p.get("headingLevel"),
        "rememberExpanded" => p.get("rememberExpanded"), "hideAllSectionsText" => p.get("hideAllSectionsText"),
        "showAllSectionsText" => p.get("showAllSectionsText"), "hideSectionText" => p.get("hideSectionText"),
        "showSectionText" => p.get("showSectionText"), "hideSectionAriaLabelText" => p.get("hideSectionAriaLabelText"),
        "showSectionAriaLabelText" => p.get("showSectionAriaLabelText"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes"),
    }
}

fn back_link(p: &Value) -> Value {
    params! { "href" => p.get("href"), "text" => text_unless_html(p, "text", "html"), "html" => p.get("html"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn breadcrumbs(p: &Value) -> Value {
    params! { "items" => visible(p.get("items")), "collapseOnMobile" => p.get("collapseOnMobile"),
        "labelText" => p.get("labelText"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn button(p: &Value) -> Value {
    let mut params = params! { "id" => p.get("id"), "text" => text_unless_html(p, "text", "html"), "html" => p.get("html"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes"), "isStartButton" => p.get("isStartButton") };
    let is_link = p.as_object().is_some_and(|o| o.contains_key("href")) && !p.get("href").is_undefined();
    if is_link {
        params.set("href", p.get("href"));
    } else {
        params.set("name", nullish(p.get("name"), Value::from("action")));
        params.set("type", or(p.get("buttonType"), Value::from("submit")));
        params.set("value", p.get("value"));
        params.set("disabled", p.get("disabled"));
        params.set("preventDoubleClick", p.get("preventDoubleClick"));
    }
    params
}

fn character_count(p: &Value) -> Value {
    params! {
        "id" => nullish(p.get("id"), p.get("code")), "name" => p.get("code"), "rows" => or(p.get("rows"), Value::from("5")),
        "value" => p.get("value"),
        "maxlength" => if p.get("maxWords").truthy() { Value::Undefined } else { p.get("maxLength") },
        "maxwords" => p.get("maxWords"), "threshold" => p.get("threshold"),
        "label" => text_param(p.get("label")), "hint" => text_param(p.get("hint")),
        "errorMessage" => error_message(p.get("errors")), "formGroup" => p.get("formGroup"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes"), "spellcheck" => p.get("spellcheck"),
        "countMessage" => p.get("countMessage"), "textareaDescriptionText" => p.get("textareaDescriptionText"),
        "charactersUnderLimitText" => p.get("charactersUnderLimitText"), "charactersAtLimitText" => p.get("charactersAtLimitText"),
        "charactersOverLimitText" => p.get("charactersOverLimitText"), "wordsUnderLimitText" => p.get("wordsUnderLimitText"),
        "wordsAtLimitText" => p.get("wordsAtLimitText"), "wordsOverLimitText" => p.get("wordsOverLimitText"),
    }
}

fn is_divider(o: &Value) -> bool {
    o.as_object().is_some_and(|m| m.contains_key("divider") && !m.contains_key("value"))
}

fn conditional(block: Value) -> Value {
    match blocks_html(block) {
        Value::Undefined => Value::Undefined,
        html => Value::from_pairs([("html", html)]),
    }
}

fn checkboxes(p: &Value) -> Value {
    let value = p.get("value");
    let items = map_items(p.get("items"), |o| {
        if is_divider(o) {
            return params! { "divider" => o.get("divider") };
        }
        let checked = if !o.get("checked").is_undefined() {
            o.get("checked").truthy()
        } else {
            value.as_array().is_some_and(|a| a.iter().any(|v| v.strict_eq(&o.get("value"))))
        };
        params! { "value" => o.get("value"), "text" => o.get("text"), "html" => o.get("html"), "id" => o.get("id"),
            "hint" => text_param(o.get("hint")), "checked" => checked, "conditional" => conditional(o.get("block")),
            "disabled" => o.get("disabled"), "behaviour" => o.get("behaviour"), "attributes" => o.get("attributes"),
            "label" => o.get("label") }
    });
    params! { "fieldset" => fieldset(p.get("fieldset"), p.get("label")), "idPrefix" => or(p.get("idPrefix"), p.get("code")),
        "name" => or(p.get("name"), p.get("code")), "describedBy" => p.get("describedBy"), "formGroup" => p.get("formGroup"),
        "hint" => text_param(p.get("hint")), "items" => items, "classes" => p.get("classes"),
        "attributes" => p.get("attributes"), "errorMessage" => error_message(p.get("errors")) }
}

fn date_input(p: &Value, fields: &[(&str, &str, &str)]) -> Value {
    let parts = match p.get("value") {
        v if v.is_nullish() => Value::empty_object(),
        v => v,
    };
    let details = p.get("errors").get("0").get("details");
    let has_errors = p.get("errors").get("length").to_js_number() > 0.0;
    let name_prefix = or(p.get("namePrefix"), p.get("code")).to_js_string();
    let id_prefix = or(p.get("id"), p.get("code")).to_js_string();
    let items: Vec<Value> = fields
        .iter()
        .map(|(name, label, classes)| {
            let field_error = has_errors && (!details.get("field").truthy() || details.get("field").as_str() == Some(name));
            let classes = if field_error { format!("{classes} govuk-input--error") } else { (*classes).to_string() };
            params! { "id" => format!("{id_prefix}-{name}"), "name" => format!("{name_prefix}[{name}]"), "label" => *label,
                "value" => parts.get(name), "pattern" => "[0-9]*", "inputmode" => "numeric", "classes" => classes }
        })
        .collect();
    params! { "id" => or(p.get("id"), p.get("code")), "fieldset" => fieldset(p.get("fieldset"), p.get("label")),
        "hint" => text_param(p.get("hint")), "errorMessage" => error_message(p.get("errors")),
        "formGroup" => p.get("formGroup"), "items" => Value::array(items), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

const DAY: (&str, &str, &str) = ("day", "Day", "govuk-input--width-2");
const MONTH: (&str, &str, &str) = ("month", "Month", "govuk-input--width-2");
const YEAR: (&str, &str, &str) = ("year", "Year", "govuk-input--width-4");

fn details(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("content"));
    params! { "summaryText" => text_unless_html(p, "summaryText", "summaryHtml"), "summaryHtml" => p.get("summaryHtml"),
        "text" => text, "html" => html, "open" => p.get("open"), "id" => p.get("id"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn exit_this_page(p: &Value) -> Value {
    params! { "id" => p.get("id"), "text" => text_unless_html(p, "text", "html"), "html" => p.get("html"),
        "redirectUrl" => p.get("redirectUrl"), "classes" => p.get("classes"), "attributes" => p.get("attributes"),
        "activatedText" => p.get("activatedText"), "timedOutText" => p.get("timedOutText"),
        "pressTwoMoreTimesText" => p.get("pressTwoMoreTimesText"), "pressOneMoreTimeText" => p.get("pressOneMoreTimeText") }
}

fn inset_text(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("blocks"));
    params! { "text" => text, "html" => html, "id" => p.get("id"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn notification_banner(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("content"));
    params! { "text" => text, "html" => html, "titleText" => text_unless_html(p, "titleText", "titleHtml"),
        "titleHtml" => p.get("titleHtml"), "titleHeadingLevel" => p.get("titleHeadingLevel"), "type" => p.get("bannerType"),
        "role" => p.get("role"), "titleId" => p.get("titleId"), "disableAutoFocus" => p.get("disableAutoFocus"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn pagination(p: &Value) -> Value {
    let hidden = |v: Value| if v.get("visibleWhen").strict_eq(&Value::Bool(false)) { Value::Undefined } else { v };
    params! { "previous" => hidden(p.get("previous")), "next" => hidden(p.get("next")), "items" => visible(p.get("items")),
        "landmarkLabel" => p.get("landmarkLabel"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn panel(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("blocks"));
    params! { "titleText" => text_unless_html(p, "titleText", "titleHtml"), "titleHtml" => p.get("titleHtml"),
        "headingLevel" => p.get("headingLevel"), "text" => text, "html" => html, "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn password_input(p: &Value) -> Value {
    params! { "id" => nullish(p.get("id"), p.get("code")), "name" => p.get("code"), "label" => text_param(p.get("label")),
        "hint" => text_param(p.get("hint")), "value" => p.get("value"), "disabled" => p.get("disabled"),
        "autocomplete" => p.get("autocomplete"), "describedBy" => p.get("describedBy"), "formGroup" => p.get("formGroup"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes"), "showPasswordText" => p.get("showPasswordText"),
        "hidePasswordText" => p.get("hidePasswordText"), "showPasswordAriaLabelText" => p.get("showPasswordAriaLabelText"),
        "hidePasswordAriaLabelText" => p.get("hidePasswordAriaLabelText"),
        "passwordShownAnnouncementText" => p.get("passwordShownAnnouncementText"),
        "passwordHiddenAnnouncementText" => p.get("passwordHiddenAnnouncementText"), "button" => p.get("button"),
        "errorMessage" => error_message(p.get("errors")) }
}

fn radios(p: &Value) -> Value {
    let value = p.get("value");
    let items = map_items(p.get("items"), |o| {
        if is_divider(o) {
            return params! { "divider" => o.get("divider") };
        }
        let checked = nullish(o.get("checked"), Value::Bool(value.strict_eq(&o.get("value"))));
        params! { "value" => o.get("value"), "text" => o.get("text"), "html" => o.get("html"), "id" => o.get("id"),
            "hint" => text_param(o.get("hint")), "checked" => checked, "conditional" => conditional(o.get("block")),
            "disabled" => o.get("disabled"), "attributes" => o.get("attributes") }
    });
    params! { "fieldset" => fieldset(p.get("fieldset"), p.get("label")), "idPrefix" => or(p.get("idPrefix"), p.get("code")),
        "name" => p.get("code"), "value" => value, "formGroup" => p.get("formGroup"), "hint" => text_param(p.get("hint")),
        "items" => items, "classes" => p.get("classes"), "attributes" => p.get("attributes"),
        "errorMessage" => error_message(p.get("errors")) }
}

fn select(p: &Value) -> Value {
    params! { "id" => nullish(p.get("id"), p.get("code")), "name" => p.get("code"), "items" => visible(p.get("items")),
        "label" => text_param(p.get("label")), "hint" => text_param(p.get("hint")), "value" => p.get("value"),
        "disabled" => p.get("disabled"), "describedBy" => p.get("describedBy"), "formGroup" => p.get("formGroup"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes"), "errorMessage" => error_message(p.get("errors")) }
}

/// `{ ...rest-without(key), ...extra }`.
fn spread_without(v: &Value, without: &str, extra: &[(&str, Value)]) -> Value {
    let mut map: Map = v.as_object().map(|o| o.iter().filter(|(k, _)| k.as_ref() != without).map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default();
    for (k, x) in extra {
        map.insert((*k).into(), x.clone());
    }
    Value::object(map)
}

fn summary_list(p: &Value) -> Value {
    let rows = map_items(p.get("rows"), |row| {
        let value = row.get("value");
        let value = if !value.truthy() {
            Value::Undefined
        } else {
            let (text, html) = text_html(value.get("text"), value.get("html"), value.get("blocks"));
            spread_without(&value, "blocks", &[("text", text), ("html", html)])
        };
        spread_without(row, "", &[("value", value)])
    });
    params! { "rows" => rows, "card" => p.get("card"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn table(p: &Value) -> Value {
    let rows = match p.get("rows") {
        Value::Array(rows) => Value::array(
            rows.iter()
                .map(|row| match row {
                    Value::Array(cells) => Value::array(
                        cells
                            .iter()
                            .map(|cell| match blocks_html(cell.get("blocks")) {
                                Value::Undefined => spread_without(cell, "blocks", &[]),
                                html => spread_without(cell, "blocks", &[("text", Value::Undefined), ("html", html)]),
                            })
                            .collect(),
                    ),
                    other => other.clone(),
                })
                .collect(),
        ),
        other => other,
    };
    params! { "rows" => rows, "head" => p.get("head"), "caption" => p.get("caption"), "captionClasses" => p.get("captionClasses"),
        "firstCellIsHeader" => p.get("firstCellIsHeader"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn tabs(p: &Value) -> Value {
    let items = map_items(p.get("items"), |item| {
        let panel = item.get("panel");
        let (text, html) = text_html(panel.get("text"), panel.get("html"), panel.get("blocks"));
        params! { "id" => item.get("id"), "label" => item.get("label"), "attributes" => item.get("attributes"),
            "panel" => params! { "text" => text, "html" => html, "attributes" => panel.get("attributes") } }
    });
    params! { "id" => p.get("id"), "title" => p.get("title"), "items" => items, "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn tag(p: &Value) -> Value {
    params! { "text" => text_unless_html(p, "text", "html"), "html" => p.get("html"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn task_list(p: &Value) -> Value {
    params! { "items" => visible(p.get("items")), "classes" => p.get("classes"), "attributes" => p.get("attributes"),
        "idPrefix" => p.get("idPrefix") }
}

fn text_input(p: &Value) -> Value {
    params! { "id" => nullish(p.get("id"), p.get("code")), "name" => p.get("code"), "label" => text_param(p.get("label")),
        "hint" => text_param(p.get("hint")), "value" => p.get("value"), "type" => nullish(p.get("inputType"), Value::from("text")),
        "inputmode" => p.get("inputMode"), "disabled" => p.get("disabled"), "autocomplete" => p.get("autocomplete"),
        "describedBy" => p.get("describedBy"), "pattern" => p.get("pattern"), "spellcheck" => p.get("spellcheck"),
        "autocapitalize" => p.get("autocapitalize"), "prefix" => p.get("prefix"), "suffix" => p.get("suffix"),
        "formGroup" => p.get("formGroup"), "inputWrapper" => p.get("inputWrapper"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes"), "errorMessage" => error_message(p.get("errors")) }
}

fn textarea(p: &Value) -> Value {
    params! { "id" => nullish(p.get("id"), p.get("code")), "name" => p.get("code"), "spellcheck" => p.get("spellcheck"),
        "rows" => or(p.get("rows"), Value::from("5")), "value" => p.get("value"), "disabled" => p.get("disabled"),
        "label" => text_param(p.get("label")), "hint" => text_param(p.get("hint")),
        "errorMessage" => error_message(p.get("errors")), "formGroup" => p.get("formGroup"), "classes" => p.get("classes"),
        "autocomplete" => p.get("autocomplete"), "describedBy" => p.get("describedBy"), "attributes" => p.get("attributes") }
}

fn warning_text(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("blocks"));
    params! { "text" => text, "html" => html, "iconFallbackText" => p.get("iconFallbackText"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

/// The params builder and template for a variant, for testing the mapping without rendering.
pub fn params_for(variant: &str) -> Option<(&'static str, fn(&Value) -> Value)> {
    Some(match variant {
        "govukAccordion" => ("govuk/components/accordion/template.njk", accordion),
        "govukBackLink" => ("govuk/components/back-link/template.njk", back_link),
        "govukBreadcrumbs" => ("govuk/components/breadcrumbs/template.njk", breadcrumbs),
        "govukButton" | "govukLinkButton" => ("govuk/components/button/template.njk", button),
        "govukCharacterCount" => ("govuk/components/character-count/template.njk", character_count),
        "govukCheckboxInput" => ("govuk/components/checkboxes/template.njk", checkboxes),
        "govukDateInputFull" => ("govuk/components/date-input/template.njk", |p| date_input(p, &[DAY, MONTH, YEAR])),
        "govukDateInputYearMonth" => ("govuk/components/date-input/template.njk", |p| date_input(p, &[MONTH, YEAR])),
        "govukDateInputMonthDay" => ("govuk/components/date-input/template.njk", |p| date_input(p, &[DAY, MONTH])),
        "govukDetails" => ("govuk/components/details/template.njk", details),
        "govukExitThisPage" => ("govuk/components/exit-this-page/template.njk", exit_this_page),
        "govukInsetText" => ("govuk/components/inset-text/template.njk", inset_text),
        "govukNotificationBanner" => ("govuk/components/notification-banner/template.njk", notification_banner),
        "govukPagination" => ("govuk/components/pagination/template.njk", pagination),
        "govukPanel" => ("govuk/components/panel/template.njk", panel),
        "govukPasswordInput" => ("govuk/components/password-input/template.njk", password_input),
        "govukRadioInput" => ("govuk/components/radios/template.njk", radios),
        "govukSelectInput" => ("govuk/components/select/template.njk", select),
        "govukSummaryList" => ("govuk/components/summary-list/template.njk", summary_list),
        "govukTable" => ("govuk/components/table/template.njk", table),
        "govukTabs" => ("govuk/components/tabs/template.njk", tabs),
        "govukTag" => ("govuk/components/tag/template.njk", tag),
        "govukTaskList" => ("govuk/components/task-list/template.njk", task_list),
        "govukTextInput" => ("govuk/components/input/template.njk", text_input),
        "govukTextarea" => ("govuk/components/textarea/template.njk", textarea),
        "govukWarningText" => ("govuk/components/warning-text/template.njk", warning_text),
        _ => return None,
    })
}

fn date_schema(parts: &[&str]) -> Schema {
    Schema::strict_object(parts.iter().map(|p| (*p, Schema::String)))
}

/// Every GOV.UK component, for `Forge::register_global_components` or a package.
pub fn components() -> Vec<ComponentEntry> {
    let basic = [
        "govukAccordion", "govukBackLink", "govukBreadcrumbs", "govukButton", "govukLinkButton", "govukDetails",
        "govukExitThisPage", "govukInsetText", "govukNotificationBanner", "govukPagination", "govukPanel",
        "govukSummaryList", "govukTable", "govukTabs", "govukTag", "govukTaskList", "govukWarningText",
    ];
    let mut out: Vec<ComponentEntry> = basic
        .iter()
        .map(|v| {
            let (template, params) = params_for(v).expect("known variant");
            entry(v, template, params)
        })
        .collect();
    let with_id = |v: &str, schema: Schema| {
        let (template, params) = params_for(v).expect("known variant");
        field_entry(v, template, schema, params).with_error_anchor(anchor_id_or_code)
    };
    out.push(with_id("govukCharacterCount", Schema::String));
    out.push(with_id("govukPasswordInput", Schema::String));
    out.push(with_id("govukSelectInput", Schema::String));
    out.push(with_id("govukTextInput", Schema::String));
    out.push(with_id("govukTextarea", Schema::String));
    let (t, p) = params_for("govukCheckboxInput").expect("known");
    out.push(field_entry("govukCheckboxInput", t, Schema::array(Schema::String), p).multiple().with_error_anchor(anchor_prefix_or_code));
    let (t, p) = params_for("govukRadioInput").expect("known");
    out.push(field_entry("govukRadioInput", t, Schema::String, p).with_error_anchor(anchor_prefix_or_code));
    for (variant, parts, anchor) in [
        ("govukDateInputFull", &["year", "month", "day"][..], "day"),
        ("govukDateInputYearMonth", &["year", "month"][..], "month"),
        ("govukDateInputMonthDay", &["month", "day"][..], "day"),
    ] {
        let (t, p) = params_for(variant).expect("known");
        out.push(field_entry(variant, t, date_schema(parts), p).with_error_anchor(move |props| {
            Some(format!("{}-{anchor}", or(props.get("id"), props.get("code")).to_js_string()))
        }));
    }
    out.extend(jsx::components());
    out
}

/// `prepare` for the date inputs: prepend `Object.ToISO` / `Object.FromISO`.
fn prepare_dates(props: Value, paths: Value) -> Value {
    let prepend = |key: &str, first: Value| {
        let mut list = vec![first];
        if let Value::Array(existing) = props.get(key) {
            list.extend(existing.iter().cloned());
        }
        Value::array(list)
    };
    let mut out = props.clone();
    out.set("formatters", prepend("formatters", transformer::object::to_iso(paths.clone())));
    out.set("parsers", prepend("parsers", transformer::object::from_iso(paths)));
    out
}

/// Block builders (`GovUKTextInput({...})` and friends).
pub mod blocks {
    use super::*;

    pub const ACCORDION: Component = Component::basic("govukAccordion");
    pub const BACK_LINK: Component = Component::basic("govukBackLink");
    pub const BREADCRUMBS: Component = Component::basic("govukBreadcrumbs");
    pub const BUTTON: Component = Component::basic("govukButton");
    pub const LINK_BUTTON: Component = Component::basic("govukLinkButton");
    pub const DETAILS: Component = Component::basic("govukDetails");
    pub const EXIT_THIS_PAGE: Component = Component::basic("govukExitThisPage");
    pub const INSET_TEXT: Component = Component::basic("govukInsetText");
    pub const NOTIFICATION_BANNER: Component = Component::basic("govukNotificationBanner");
    pub const PAGINATION: Component = Component::basic("govukPagination");
    pub const PANEL: Component = Component::basic("govukPanel");
    pub const SUMMARY_LIST: Component = Component::basic("govukSummaryList");
    pub const TABLE: Component = Component::basic("govukTable");
    pub const TABS: Component = Component::basic("govukTabs");
    pub const TAG: Component = Component::basic("govukTag");
    pub const TASK_LIST: Component = Component::basic("govukTaskList");
    pub const WARNING_TEXT: Component = Component::basic("govukWarningText");
    pub const CHARACTER_COUNT: Component = Component::field("govukCharacterCount");
    pub const CHECKBOX_INPUT: Component = Component::field("govukCheckboxInput");
    pub const PASSWORD_INPUT: Component = Component::field("govukPasswordInput");
    pub const RADIO_INPUT: Component = Component::field("govukRadioInput");
    pub const SELECT_INPUT: Component = Component::field("govukSelectInput");
    pub const TEXT_INPUT: Component = Component::field("govukTextInput");
    pub const TEXTAREA: Component = Component::field("govukTextarea");
    pub const HEADING: Component = Component::basic("govukHeading");
    pub const BODY: Component = Component::basic("govukBody");
    pub const LIST: Component = Component::basic("govukList");
    pub const SECTION_BREAK: Component = Component::basic("govukSectionBreak");
    pub const BUTTON_GROUP: Component = Component::basic("govukButtonGroup");
    pub const GRID_ROW: Component = Component::basic("govukGridRow");
    pub const DATE_INPUT_FULL: Component = Component::field("govukDateInputFull").with_prepare(|p| {
        prepare_dates(p, Value::from_pairs([("year", "year".into()), ("month", "month".into()), ("day", "day".into())]))
    });
    pub const DATE_INPUT_YEAR_MONTH: Component = Component::field("govukDateInputYearMonth")
        .with_prepare(|p| prepare_dates(p, Value::from_pairs([("year", "year".into()), ("month", "month".into())])));
    pub const DATE_INPUT_MONTH_DAY: Component = Component::field("govukDateInputMonthDay")
        .with_prepare(|p| prepare_dates(p, Value::from_pairs([("month", "month".into()), ("day", "day".into())])));
}
