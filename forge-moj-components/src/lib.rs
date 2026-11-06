//! MOJ Frontend components (port of `forge-moj-components`): each maps its evaluated block to
//! the upstream macro's params as the TS component does, rendered through Runjucks.
//!
//! The card, card group and interruption card use Forge's own templates; add
//! [`templates_dir()`] to the engine's search paths.

use std::path::PathBuf;
use std::sync::LazyLock;

use forge_core::authoring::Component;
use forge_core::engine::registries::ComponentEntry;
use forge_core::schema::Schema;
use forge_core::value::{Map, Value};
use forge_runjucks::nunjucks_render;
use regex::Regex;

/// This crate's directory, which holds `templates/` and `styles/`.
pub fn crate_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

/// Forge's MOJ templates (`components/card/...`, `macros/attributes.njk`).
pub fn templates_dir() -> PathBuf {
    crate_dir().join("templates")
}

/// Forge's MOJ component styles: add to the Sass load paths and `@import "forge-moj-components"`.
pub fn styles_dir() -> PathBuf {
    crate_dir().join("styles")
}

macro_rules! params {
    ($($key:literal => $value:expr),* $(,)?) => {{
        let mut map = Map::new();
        $( map.insert($key.into(), Value::from($value)); )*
        Value::object(map)
    }};
}

fn nullish(a: Value, b: Value) -> Value {
    if a.is_nullish() { b } else { a }
}

/// JS `typeof v === 'object'`.
fn is_object(v: &Value) -> bool {
    matches!(v, Value::Object(_) | Value::Array(_) | Value::Null | Value::Opaque(_))
}

/// `typeof v === 'object' ? v : { text: v }`.
fn object_or_text(v: Value) -> Value {
    if is_object(&v) { v } else { Value::from_pairs([("text", v)]) }
}

fn visible(items: Value) -> Value {
    match items {
        Value::Array(a) => Value::array(a.iter().filter(|i| !i.get("visibleWhen").strict_eq(&Value::Bool(false))).cloned().collect()),
        other => other,
    }
}

fn map_visible(items: Value, f: impl Fn(&Value) -> Value) -> Value {
    match visible(items) {
        Value::Array(a) => Value::array(a.iter().map(f).collect()),
        other => other,
    }
}

/// `{ ...v without `without`, ...extra }`.
fn spread(v: &Value, without: &str, extra: Vec<(&str, Value)>) -> Value {
    let mut map: Map = v
        .as_object()
        .map(|o| o.iter().filter(|(k, _)| k.as_ref() != without).map(|(k, x)| (k.clone(), x.clone())).collect())
        .unwrap_or_default();
    for (k, x) in extra {
        map.insert(k.into(), x);
    }
    Value::object(map)
}

/// `normaliseMojTextHtmlContent` -> `(text, html)`.
fn text_html(text: Value, html: Value, blocks: Value) -> (Value, Value) {
    let rendered = if !blocks.truthy() {
        Value::Undefined
    } else {
        let list = match &blocks {
            Value::Array(a) => a.iter().cloned().collect::<Vec<_>>(),
            _ => vec![blocks.clone()],
        };
        if list.is_empty() { Value::Undefined } else { Value::from(list.iter().map(|b| b.get("html").to_js_string()).collect::<String>()) }
    };
    if rendered.is_undefined() { (text, nullish(Value::Undefined, html)) } else { (Value::Undefined, rendered) }
}

/// `{ ...item without blocks, ...normaliseMojTextHtmlContent(item) }`.
fn with_content(item: &Value) -> Value {
    let (text, html) = text_html(item.get("text"), item.get("html"), item.get("blocks"));
    spread(item, "blocks", vec![("text", text), ("html", html)])
}

fn alert(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("blocks"));
    params! { "variant" => p.get("alertVariant"), "title" => p.get("title"), "text" => text, "html" => html,
        "showTitleAsHeading" => p.get("showTitleAsHeading"), "headingTag" => p.get("headingTag"),
        "dismissible" => p.get("dismissible"), "dismissText" => p.get("dismissText"),
        "disableAutoFocus" => p.get("disableAutoFocus"), "focusOnDismissSelector" => p.get("focusOnDismissSelector"),
        "role" => p.get("role"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn badge(p: &Value) -> Value {
    params! { "text" => p.get("text"), "html" => p.get("html"), "classes" => p.get("classes"), "label" => p.get("label"),
        "attributes" => p.get("attributes") }
}

fn banner(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("blocks"));
    params! { "type" => p.get("bannerType"), "text" => text, "html" => html, "iconFallbackText" => p.get("iconFallbackText"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn button_menu(p: &Value) -> Value {
    params! { "button" => p.get("button"), "alignMenu" => p.get("alignMenu"), "items" => visible(p.get("items")),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn description(v: Value) -> Value {
    if v.truthy() { object_or_text(v) } else { Value::Undefined }
}

fn card_group(p: &Value) -> Value {
    let items = map_visible(p.get("items"), |item| {
        let heading = item.get("heading");
        let heading = if matches!(heading, Value::Object(_)) {
            let level = heading.get("level");
            let valid = level.as_f64().is_some_and(|n| (1.0..=6.0).contains(&n) && n.fract() == 0.0);
            params! { "text" => heading.get("text"), "html" => heading.get("html"), "classes" => heading.get("classes"),
                "level" => if valid { level } else { Value::Undefined } }
        } else {
            Value::from_pairs([("text", heading)])
        };
        params! { "heading" => heading, "href" => item.get("href"), "description" => description(item.get("description")),
            "clickable" => item.get("clickable"), "classes" => item.get("classes"), "attributes" => item.get("attributes") }
    });
    params! { "items" => items, "columns" => p.get("columns"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn card(p: &Value) -> Value {
    params! { "heading" => object_or_text(p.get("heading")), "href" => p.get("href"),
        "description" => description(p.get("description")), "clickable" => p.get("clickable"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

static ISO_DATE: LazyLock<Regex> = LazyLock::new(|| Regex::new(r"^(\d{4})-(\d{2})-(\d{2})$").unwrap());

fn join_spaces(v: Value) -> Value {
    match v {
        Value::Array(a) => Value::from(a.iter().map(|x| if x.is_nullish() { String::new() } else { x.to_js_string() }).collect::<Vec<_>>().join(" ")),
        _ => Value::Undefined,
    }
}

fn date_picker(p: &Value) -> Value {
    let value = match p.get("value") {
        Value::String(s) if !s.is_empty() => match ISO_DATE.captures(&s) {
            Some(c) => Value::from(format!("{}/{}/{}", &c[3], &c[2], &c[1])),
            None => Value::String(s),
        },
        _ => Value::Undefined,
    };
    let errors = p.get("errors");
    params! { "id" => nullish(p.get("id"), p.get("code")), "name" => p.get("code"), "value" => value,
        "label" => object_or_text(p.get("label")),
        "hint" => if p.get("hint").truthy() { object_or_text(p.get("hint")) } else { Value::Undefined },
        "errorMessage" => if errors.get("length").to_js_number() > 0.0 {
            Value::from_pairs([("text", errors.get("0").get("message"))])
        } else { Value::Undefined },
        "minDate" => p.get("minDate"), "maxDate" => p.get("maxDate"),
        "excludedDates" => join_spaces(p.get("excludedDates")), "excludedDays" => join_spaces(p.get("excludedDays")),
        "weekStartDay" => p.get("weekStartDay"), "formGroup" => p.get("formGroup"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn filter(p: &Value) -> Value {
    let selected = p.get("selectedFilters");
    let selected = if selected.truthy() {
        let categories = map_visible(selected.get("categories"), |c| spread(c, "", vec![("items", visible(c.get("items")))]));
        spread(&selected, "", vec![("categories", categories)])
    } else {
        Value::Undefined
    };
    params! { "heading" => p.get("heading"), "selectedFilters" => selected, "submit" => p.get("submit"),
        "optionsHtml" => p.get("optionsHtml"), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn identity_bar(p: &Value) -> Value {
    let title = p.get("title");
    params! { "title" => if title.as_str().is_some() { Value::from_pairs([("text", title)]) } else { title },
        "menus" => map_visible(p.get("menus"), |m| spread(m, "", vec![("items", visible(m.get("items")))])),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn interruption_card(p: &Value) -> Value {
    let (text, html) = text_html(p.get("text"), p.get("html"), p.get("blocks"));
    params! { "heading" => p.get("heading"), "text" => text, "html" => html, "primaryAction" => p.get("primaryAction"),
        "secondaryAction" => p.get("secondaryAction") }
}

fn messages(p: &Value) -> Value {
    params! { "items" => map_visible(p.get("items"), with_content), "id" => p.get("id"), "label" => p.get("label"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn table_with_module(p: &Value, module: &str) -> Value {
    params! { "rows" => p.get("rows"), "head" => p.get("head"), "caption" => p.get("caption"),
        "captionClasses" => p.get("captionClasses"), "firstCellIsHeader" => p.get("firstCellIsHeader"),
        "classes" => p.get("classes"),
        "attributes" => spread(&p.get("attributes"), "", vec![("data-module", Value::from(module))]) }
}

fn notification_badge(p: &Value) -> Value {
    params! { "text" => p.get("text"), "visuallyHiddenText" => p.get("visuallyHiddenText"), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn page_header_actions(p: &Value) -> Value {
    let heading = p.get("heading");
    params! { "heading" => if heading.as_str().is_some() { Value::from_pairs([("text", heading)]) } else { heading },
        "items" => visible(p.get("items")), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn progress_bar(p: &Value) -> Value {
    let items = map_visible(p.get("items"), |item| {
        params! { "id" => item.get("id"), "label" => object_or_text(item.get("label")), "active" => item.get("active"),
            "complete" => item.get("complete"), "classes" => item.get("classes"), "attributes" => item.get("attributes") }
    });
    params! { "id" => p.get("id"), "label" => p.get("label"), "items" => items, "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn side_navigation(p: &Value) -> Value {
    params! { "label" => p.get("label"), "items" => visible(p.get("items")),
        "sections" => map_visible(p.get("sections"), |s| spread(s, "", vec![("items", visible(s.get("items")))])),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn sub_navigation(p: &Value) -> Value {
    params! { "label" => p.get("label"), "items" => visible(p.get("items")), "classes" => p.get("classes"),
        "attributes" => p.get("attributes") }
}

fn ticket_panel(p: &Value) -> Value {
    params! { "items" => map_visible(p.get("items"), with_content), "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

fn timeline(p: &Value) -> Value {
    params! { "items" => map_visible(p.get("items"), with_content), "headingLevel" => p.get("headingLevel"),
        "classes" => p.get("classes"), "attributes" => p.get("attributes") }
}

/// The template and params builder for a variant.
pub fn params_for(variant: &str) -> Option<(&'static str, fn(&Value) -> Value)> {
    Some(match variant {
        "mojAlert" => ("moj/components/alert/template.njk", alert),
        "mojBadge" => ("moj/components/badge/template.njk", badge),
        "mojBanner" => ("moj/components/banner/template.njk", banner),
        "mojButtonMenu" => ("moj/components/button-menu/template.njk", button_menu),
        "mojCardGroup" => ("components/card-group/template.njk", card_group),
        "mojCard" => ("components/card/template.njk", card),
        "mojDatePicker" => ("moj/components/date-picker/template.njk", date_picker),
        "mojFilter" => ("moj/components/filter/template.njk", filter),
        "mojIdentityBar" => ("moj/components/identity-bar/template.njk", identity_bar),
        "mojInterruptionCard" => ("components/interruption-card/template.njk", interruption_card),
        "mojMessages" => ("moj/components/messages/template.njk", messages),
        "mojMultiSelect" => ("govuk/components/table/template.njk", |p| table_with_module(p, "moj-multi-select")),
        "mojNotificationBadge" => ("moj/components/notification-badge/template.njk", notification_badge),
        "mojPageHeaderActions" => ("moj/components/page-header-actions/template.njk", page_header_actions),
        "mojProgressBar" => ("moj/components/progress-bar/template.njk", progress_bar),
        "mojSideNavigation" => ("moj/components/side-navigation/template.njk", side_navigation),
        "mojSortableTable" => ("govuk/components/table/template.njk", |p| table_with_module(p, "moj-sortable-table")),
        "mojSubNavigation" => ("moj/components/sub-navigation/template.njk", sub_navigation),
        "mojTicketPanel" => ("moj/components/ticket-panel/template.njk", ticket_panel),
        "mojTimeline" => ("moj/components/timeline/template.njk", timeline),
        _ => return None,
    })
}

const VARIANTS: &[&str] = &[
    "mojAlert", "mojBadge", "mojBanner", "mojButtonMenu", "mojCardGroup", "mojCard", "mojDatePicker", "mojFilter",
    "mojIdentityBar", "mojInterruptionCard", "mojMessages", "mojMultiSelect", "mojNotificationBadge",
    "mojPageHeaderActions", "mojProgressBar", "mojSideNavigation", "mojSortableTable", "mojSubNavigation",
    "mojTicketPanel", "mojTimeline",
];

/// Every MOJ component.
pub fn components() -> Vec<ComponentEntry> {
    VARIANTS
        .iter()
        .map(|v| {
            let (template, params) = params_for(v).expect("known variant");
            let entry = ComponentEntry::new(v).with_render(nunjucks_render(template, params));
            if *v == "mojDatePicker" {
                entry.with_input(Schema::String).with_error_anchor(|p| nullish(p.get("id"), p.get("code")).as_str().map(str::to_string))
            } else {
                entry
            }
        })
        .collect()
}

/// Block builders.
pub mod blocks {
    use super::Component;

    pub const ALERT: Component = Component::basic("mojAlert");
    pub const BADGE: Component = Component::basic("mojBadge");
    pub const BANNER: Component = Component::basic("mojBanner");
    pub const BUTTON_MENU: Component = Component::basic("mojButtonMenu");
    pub const CARD_GROUP: Component = Component::basic("mojCardGroup");
    pub const CARD: Component = Component::basic("mojCard");
    pub const DATE_PICKER: Component = Component::field("mojDatePicker");
    pub const FILTER: Component = Component::basic("mojFilter");
    pub const IDENTITY_BAR: Component = Component::basic("mojIdentityBar");
    pub const INTERRUPTION_CARD: Component = Component::basic("mojInterruptionCard");
    pub const MESSAGES: Component = Component::basic("mojMessages");
    pub const MULTI_SELECT: Component = Component::basic("mojMultiSelect");
    pub const NOTIFICATION_BADGE: Component = Component::basic("mojNotificationBadge");
    pub const PAGE_HEADER_ACTIONS: Component = Component::basic("mojPageHeaderActions");
    pub const PROGRESS_BAR: Component = Component::basic("mojProgressBar");
    pub const SIDE_NAVIGATION: Component = Component::basic("mojSideNavigation");
    pub const SORTABLE_TABLE: Component = Component::basic("mojSortableTable");
    pub const SUB_NAVIGATION: Component = Component::basic("mojSubNavigation");
    pub const TICKET_PANEL: Component = Component::basic("mojTicketPanel");
    pub const TIMELINE: Component = Component::basic("mojTimeline");
}
