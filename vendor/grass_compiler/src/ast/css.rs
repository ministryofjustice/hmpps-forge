use codemap::Span;

use crate::selector::ExtendedSelector;

use super::{MediaRule, Style, UnknownAtRule};

#[derive(Debug, Clone)]
pub(crate) enum CssStmt {
    RuleSet {
        selector: ExtendedSelector,
        body: Vec<Self>,
        is_group_end: bool,
    },
    Style(Style),
    Media(MediaRule, bool),
    UnknownAtRule(UnknownAtRule, bool),
    Supports(SupportsRule, bool),
    Comment(String, Span),
    KeyframesRuleSet(KeyframesRuleSet),
    /// A plain import such as `@import "foo.css";` or
    /// `@import url(https://fonts.google.com/foo?bar);`
    // todo: named fields, 0: url, 1: modifiers
    Import(String, Option<String>),
}

impl CssStmt {
    pub fn is_style_rule(&self) -> bool {
        matches!(self, CssStmt::RuleSet { .. })
    }

    pub fn set_group_end(&mut self) {
        match self {
            CssStmt::Media(_, is_group_end)
            | CssStmt::UnknownAtRule(_, is_group_end)
            | CssStmt::Supports(_, is_group_end)
            | CssStmt::RuleSet { is_group_end, .. } => *is_group_end = true,
            CssStmt::Style(_)
            | CssStmt::Comment(_, _)
            | CssStmt::KeyframesRuleSet(_)
            | CssStmt::Import(_, _) => {}
        }
    }

    pub fn is_group_end(&self) -> bool {
        match self {
            CssStmt::Media(_, is_group_end)
            | CssStmt::UnknownAtRule(_, is_group_end)
            | CssStmt::Supports(_, is_group_end)
            | CssStmt::RuleSet { is_group_end, .. } => *is_group_end,
            _ => false,
        }
    }

    pub fn is_invisible(&self) -> bool {
        self.is_invisible_with(false)
    }

    /// dart-sass's `IsInvisibleVisitor(includeComments: compressed)`: in compressed output,
    /// comments other than preserved `/*!` ones are invisible, so a rule holding only comments
    /// is dropped and they never count as a rule's last child.
    pub fn is_invisible_with(&self, compressed: bool) -> bool {
        let all = |body: &[CssStmt]| body.iter().all(|s| s.is_invisible_with(compressed));
        match self {
            CssStmt::RuleSet { selector, body, .. } => selector.is_invisible() || all(body),
            CssStmt::Style(style) => style.value.node.is_blank(),
            CssStmt::Media(media_rule, ..) => all(&media_rule.body),
            CssStmt::Comment(comment, ..) => compressed && !comment.starts_with("/*!"),
            CssStmt::UnknownAtRule(..) | CssStmt::Import(..) => false,
            CssStmt::Supports(supports_rule, ..) => all(&supports_rule.body),
            CssStmt::KeyframesRuleSet(kf) => all(&kf.body),
        }
    }

    pub fn copy_without_children(&self) -> Self {
        match self {
            CssStmt::RuleSet {
                selector,
                is_group_end,
                ..
            } => CssStmt::RuleSet {
                selector: selector.clone(),
                body: Vec::new(),
                is_group_end: *is_group_end,
            },
            CssStmt::Style(..) | CssStmt::Comment(..) | CssStmt::Import(..) => unreachable!(),
            CssStmt::Media(media, is_group_end) => CssStmt::Media(
                MediaRule {
                    query: media.query.clone(),
                    body: Vec::new(),
                },
                *is_group_end,
            ),
            CssStmt::UnknownAtRule(at_rule, is_group_end) => CssStmt::UnknownAtRule(
                UnknownAtRule {
                    name: at_rule.name.clone(),
                    params: at_rule.params.clone(),
                    body: Vec::new(),
                    has_body: at_rule.has_body,
                },
                *is_group_end,
            ),
            CssStmt::Supports(supports, is_group_end) => CssStmt::Supports(
                SupportsRule {
                    params: supports.params.clone(),
                    body: Vec::new(),
                },
                *is_group_end,
            ),
            CssStmt::KeyframesRuleSet(keyframes) => CssStmt::KeyframesRuleSet(KeyframesRuleSet {
                selector: keyframes.selector.clone(),
                body: Vec::new(),
            }),
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct KeyframesRuleSet {
    pub selector: Vec<KeyframesSelector>,
    pub body: Vec<CssStmt>,
}

#[derive(Debug, Clone)]
pub(crate) enum KeyframesSelector {
    To,
    From,
    Percent(Box<str>),
}

#[derive(Debug, Clone)]
pub(crate) struct SupportsRule {
    pub params: String,
    pub body: Vec<CssStmt>,
}
