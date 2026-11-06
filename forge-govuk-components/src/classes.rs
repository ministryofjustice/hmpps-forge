//! GOV.UK Frontend utility classes as constants (`GovUKUtilityClasses`), e.g.
//! `classes::input::WIDTH_20` or `classes::label::LARGE`. Generated from `utility_classes.json`,
//! the same data `utility_classes()` returns.

/// `govuk-visually-hidden`
pub const VISUALLY_HIDDEN: &str = "govuk-visually-hidden";
/// `govuk-visually-hidden-focusable`
pub const VISUALLY_HIDDEN_FOCUSABLE: &str = "govuk-visually-hidden-focusable";
pub mod input {
    /// `govuk-input--width-2`
    pub const WIDTH_2: &str = "govuk-input--width-2";
    /// `govuk-input--width-3`
    pub const WIDTH_3: &str = "govuk-input--width-3";
    /// `govuk-input--width-4`
    pub const WIDTH_4: &str = "govuk-input--width-4";
    /// `govuk-input--width-5`
    pub const WIDTH_5: &str = "govuk-input--width-5";
    /// `govuk-input--width-10`
    pub const WIDTH_10: &str = "govuk-input--width-10";
    /// `govuk-input--width-20`
    pub const WIDTH_20: &str = "govuk-input--width-20";
    /// `govuk-input--width-30`
    pub const WIDTH_30: &str = "govuk-input--width-30";
    /// `govuk-input--extra-letter-spacing`
    pub const EXTRA_LETTER_SPACING: &str = "govuk-input--extra-letter-spacing";
}
pub mod label {
    /// `govuk-label--xl`
    pub const EXTRA_LARGE: &str = "govuk-label--xl";
    /// `govuk-label--l`
    pub const LARGE: &str = "govuk-label--l";
    /// `govuk-label--m`
    pub const MEDIUM: &str = "govuk-label--m";
    /// `govuk-label--s`
    pub const SMALL: &str = "govuk-label--s";
}
pub mod fieldset {
    /// `govuk-fieldset__legend--xl`
    pub const EXTRA_LARGE_LABEL: &str = "govuk-fieldset__legend--xl";
    /// `govuk-fieldset__legend--l`
    pub const LARGE_LABEL: &str = "govuk-fieldset__legend--l";
    /// `govuk-fieldset__legend--m`
    pub const MEDIUM_LABEL: &str = "govuk-fieldset__legend--m";
    /// `govuk-fieldset__legend--s`
    pub const SMALL_LABEL: &str = "govuk-fieldset__legend--s";
}
pub mod radios {
    /// `govuk-radios--inline`
    pub const INLINE: &str = "govuk-radios--inline";
    /// `govuk-radios--small`
    pub const SMALL: &str = "govuk-radios--small";
}
pub mod checkboxes {
    /// `govuk-checkboxes--small`
    pub const SMALL: &str = "govuk-checkboxes--small";
}
pub mod tag {
    /// `govuk-tag--blue`
    pub const BLUE: &str = "govuk-tag--blue";
    /// `govuk-tag--green`
    pub const GREEN: &str = "govuk-tag--green";
    /// `govuk-tag--grey`
    pub const GREY: &str = "govuk-tag--grey";
    /// `govuk-tag--red`
    pub const RED: &str = "govuk-tag--red";
    /// `govuk-tag--orange`
    pub const ORANGE: &str = "govuk-tag--orange";
    /// `govuk-tag--yellow`
    pub const YELLOW: &str = "govuk-tag--yellow";
    /// `govuk-tag--purple`
    pub const PURPLE: &str = "govuk-tag--purple";
    /// `govuk-tag--teal`
    pub const TEAL: &str = "govuk-tag--teal";
    /// `govuk-tag--magenta`
    pub const MAGENTA: &str = "govuk-tag--magenta";
}
pub mod width {
    /// `govuk-!-width-full`
    pub const FULL: &str = "govuk-!-width-full";
    /// `govuk-!-width-three-quarters`
    pub const THREE_QUARTERS: &str = "govuk-!-width-three-quarters";
    /// `govuk-!-width-two-thirds`
    pub const TWO_THIRDS: &str = "govuk-!-width-two-thirds";
    /// `govuk-!-width-one-half`
    pub const ONE_HALF: &str = "govuk-!-width-one-half";
    /// `govuk-!-width-one-third`
    pub const ONE_THIRD: &str = "govuk-!-width-one-third";
    /// `govuk-!-width-one-quarter`
    pub const ONE_QUARTER: &str = "govuk-!-width-one-quarter";
}
pub mod display {
    /// `govuk-!-display-inline`
    pub const INLINE: &str = "govuk-!-display-inline";
    /// `govuk-!-display-inline-block`
    pub const INLINE_BLOCK: &str = "govuk-!-display-inline-block";
    /// `govuk-!-display-block`
    pub const BLOCK: &str = "govuk-!-display-block";
    /// `govuk-!-display-none`
    pub const NONE: &str = "govuk-!-display-none";
    /// `govuk-!-display-none-print`
    pub const NONE_PRINT: &str = "govuk-!-display-none-print";
}
pub mod font_size {
    /// `govuk-!-font-size-16`
    pub const SIZE_16: &str = "govuk-!-font-size-16";
    /// `govuk-!-font-size-19`
    pub const SIZE_19: &str = "govuk-!-font-size-19";
    /// `govuk-!-font-size-24`
    pub const SIZE_24: &str = "govuk-!-font-size-24";
    /// `govuk-!-font-size-27`
    pub const SIZE_27: &str = "govuk-!-font-size-27";
    /// `govuk-!-font-size-36`
    pub const SIZE_36: &str = "govuk-!-font-size-36";
    /// `govuk-!-font-size-48`
    pub const SIZE_48: &str = "govuk-!-font-size-48";
    /// `govuk-!-font-size-80`
    pub const SIZE_80: &str = "govuk-!-font-size-80";
}
pub mod font_weight {
    /// `govuk-!-font-weight-regular`
    pub const REGULAR: &str = "govuk-!-font-weight-regular";
    /// `govuk-!-font-weight-bold`
    pub const BOLD: &str = "govuk-!-font-weight-bold";
}
pub mod text_align {
    /// `govuk-!-text-align-left`
    pub const LEFT: &str = "govuk-!-text-align-left";
    /// `govuk-!-text-align-centre`
    pub const CENTRE: &str = "govuk-!-text-align-centre";
    /// `govuk-!-text-align-right`
    pub const RIGHT: &str = "govuk-!-text-align-right";
}
pub mod margin {
    /// `govuk-!-margin-0`
    pub const ALL_0: &str = "govuk-!-margin-0";
    /// `govuk-!-margin-1`
    pub const ALL_1: &str = "govuk-!-margin-1";
    /// `govuk-!-margin-2`
    pub const ALL_2: &str = "govuk-!-margin-2";
    /// `govuk-!-margin-3`
    pub const ALL_3: &str = "govuk-!-margin-3";
    /// `govuk-!-margin-4`
    pub const ALL_4: &str = "govuk-!-margin-4";
    /// `govuk-!-margin-5`
    pub const ALL_5: &str = "govuk-!-margin-5";
    /// `govuk-!-margin-6`
    pub const ALL_6: &str = "govuk-!-margin-6";
    /// `govuk-!-margin-7`
    pub const ALL_7: &str = "govuk-!-margin-7";
    /// `govuk-!-margin-8`
    pub const ALL_8: &str = "govuk-!-margin-8";
    /// `govuk-!-margin-9`
    pub const ALL_9: &str = "govuk-!-margin-9";
    /// `govuk-!-margin-top-0`
    pub const TOP_0: &str = "govuk-!-margin-top-0";
    /// `govuk-!-margin-top-1`
    pub const TOP_1: &str = "govuk-!-margin-top-1";
    /// `govuk-!-margin-top-2`
    pub const TOP_2: &str = "govuk-!-margin-top-2";
    /// `govuk-!-margin-top-3`
    pub const TOP_3: &str = "govuk-!-margin-top-3";
    /// `govuk-!-margin-top-4`
    pub const TOP_4: &str = "govuk-!-margin-top-4";
    /// `govuk-!-margin-top-5`
    pub const TOP_5: &str = "govuk-!-margin-top-5";
    /// `govuk-!-margin-top-6`
    pub const TOP_6: &str = "govuk-!-margin-top-6";
    /// `govuk-!-margin-top-7`
    pub const TOP_7: &str = "govuk-!-margin-top-7";
    /// `govuk-!-margin-top-8`
    pub const TOP_8: &str = "govuk-!-margin-top-8";
    /// `govuk-!-margin-top-9`
    pub const TOP_9: &str = "govuk-!-margin-top-9";
    /// `govuk-!-margin-right-0`
    pub const RIGHT_0: &str = "govuk-!-margin-right-0";
    /// `govuk-!-margin-right-1`
    pub const RIGHT_1: &str = "govuk-!-margin-right-1";
    /// `govuk-!-margin-right-2`
    pub const RIGHT_2: &str = "govuk-!-margin-right-2";
    /// `govuk-!-margin-right-3`
    pub const RIGHT_3: &str = "govuk-!-margin-right-3";
    /// `govuk-!-margin-right-4`
    pub const RIGHT_4: &str = "govuk-!-margin-right-4";
    /// `govuk-!-margin-right-5`
    pub const RIGHT_5: &str = "govuk-!-margin-right-5";
    /// `govuk-!-margin-right-6`
    pub const RIGHT_6: &str = "govuk-!-margin-right-6";
    /// `govuk-!-margin-right-7`
    pub const RIGHT_7: &str = "govuk-!-margin-right-7";
    /// `govuk-!-margin-right-8`
    pub const RIGHT_8: &str = "govuk-!-margin-right-8";
    /// `govuk-!-margin-right-9`
    pub const RIGHT_9: &str = "govuk-!-margin-right-9";
    /// `govuk-!-margin-bottom-0`
    pub const BOTTOM_0: &str = "govuk-!-margin-bottom-0";
    /// `govuk-!-margin-bottom-1`
    pub const BOTTOM_1: &str = "govuk-!-margin-bottom-1";
    /// `govuk-!-margin-bottom-2`
    pub const BOTTOM_2: &str = "govuk-!-margin-bottom-2";
    /// `govuk-!-margin-bottom-3`
    pub const BOTTOM_3: &str = "govuk-!-margin-bottom-3";
    /// `govuk-!-margin-bottom-4`
    pub const BOTTOM_4: &str = "govuk-!-margin-bottom-4";
    /// `govuk-!-margin-bottom-5`
    pub const BOTTOM_5: &str = "govuk-!-margin-bottom-5";
    /// `govuk-!-margin-bottom-6`
    pub const BOTTOM_6: &str = "govuk-!-margin-bottom-6";
    /// `govuk-!-margin-bottom-7`
    pub const BOTTOM_7: &str = "govuk-!-margin-bottom-7";
    /// `govuk-!-margin-bottom-8`
    pub const BOTTOM_8: &str = "govuk-!-margin-bottom-8";
    /// `govuk-!-margin-bottom-9`
    pub const BOTTOM_9: &str = "govuk-!-margin-bottom-9";
    /// `govuk-!-margin-left-0`
    pub const LEFT_0: &str = "govuk-!-margin-left-0";
    /// `govuk-!-margin-left-1`
    pub const LEFT_1: &str = "govuk-!-margin-left-1";
    /// `govuk-!-margin-left-2`
    pub const LEFT_2: &str = "govuk-!-margin-left-2";
    /// `govuk-!-margin-left-3`
    pub const LEFT_3: &str = "govuk-!-margin-left-3";
    /// `govuk-!-margin-left-4`
    pub const LEFT_4: &str = "govuk-!-margin-left-4";
    /// `govuk-!-margin-left-5`
    pub const LEFT_5: &str = "govuk-!-margin-left-5";
    /// `govuk-!-margin-left-6`
    pub const LEFT_6: &str = "govuk-!-margin-left-6";
    /// `govuk-!-margin-left-7`
    pub const LEFT_7: &str = "govuk-!-margin-left-7";
    /// `govuk-!-margin-left-8`
    pub const LEFT_8: &str = "govuk-!-margin-left-8";
    /// `govuk-!-margin-left-9`
    pub const LEFT_9: &str = "govuk-!-margin-left-9";
}
pub mod padding {
    /// `govuk-!-padding-0`
    pub const ALL_0: &str = "govuk-!-padding-0";
    /// `govuk-!-padding-1`
    pub const ALL_1: &str = "govuk-!-padding-1";
    /// `govuk-!-padding-2`
    pub const ALL_2: &str = "govuk-!-padding-2";
    /// `govuk-!-padding-3`
    pub const ALL_3: &str = "govuk-!-padding-3";
    /// `govuk-!-padding-4`
    pub const ALL_4: &str = "govuk-!-padding-4";
    /// `govuk-!-padding-5`
    pub const ALL_5: &str = "govuk-!-padding-5";
    /// `govuk-!-padding-6`
    pub const ALL_6: &str = "govuk-!-padding-6";
    /// `govuk-!-padding-7`
    pub const ALL_7: &str = "govuk-!-padding-7";
    /// `govuk-!-padding-8`
    pub const ALL_8: &str = "govuk-!-padding-8";
    /// `govuk-!-padding-9`
    pub const ALL_9: &str = "govuk-!-padding-9";
    /// `govuk-!-padding-top-0`
    pub const TOP_0: &str = "govuk-!-padding-top-0";
    /// `govuk-!-padding-top-1`
    pub const TOP_1: &str = "govuk-!-padding-top-1";
    /// `govuk-!-padding-top-2`
    pub const TOP_2: &str = "govuk-!-padding-top-2";
    /// `govuk-!-padding-top-3`
    pub const TOP_3: &str = "govuk-!-padding-top-3";
    /// `govuk-!-padding-top-4`
    pub const TOP_4: &str = "govuk-!-padding-top-4";
    /// `govuk-!-padding-top-5`
    pub const TOP_5: &str = "govuk-!-padding-top-5";
    /// `govuk-!-padding-top-6`
    pub const TOP_6: &str = "govuk-!-padding-top-6";
    /// `govuk-!-padding-top-7`
    pub const TOP_7: &str = "govuk-!-padding-top-7";
    /// `govuk-!-padding-top-8`
    pub const TOP_8: &str = "govuk-!-padding-top-8";
    /// `govuk-!-padding-top-9`
    pub const TOP_9: &str = "govuk-!-padding-top-9";
    /// `govuk-!-padding-right-0`
    pub const RIGHT_0: &str = "govuk-!-padding-right-0";
    /// `govuk-!-padding-right-1`
    pub const RIGHT_1: &str = "govuk-!-padding-right-1";
    /// `govuk-!-padding-right-2`
    pub const RIGHT_2: &str = "govuk-!-padding-right-2";
    /// `govuk-!-padding-right-3`
    pub const RIGHT_3: &str = "govuk-!-padding-right-3";
    /// `govuk-!-padding-right-4`
    pub const RIGHT_4: &str = "govuk-!-padding-right-4";
    /// `govuk-!-padding-right-5`
    pub const RIGHT_5: &str = "govuk-!-padding-right-5";
    /// `govuk-!-padding-right-6`
    pub const RIGHT_6: &str = "govuk-!-padding-right-6";
    /// `govuk-!-padding-right-7`
    pub const RIGHT_7: &str = "govuk-!-padding-right-7";
    /// `govuk-!-padding-right-8`
    pub const RIGHT_8: &str = "govuk-!-padding-right-8";
    /// `govuk-!-padding-right-9`
    pub const RIGHT_9: &str = "govuk-!-padding-right-9";
    /// `govuk-!-padding-bottom-0`
    pub const BOTTOM_0: &str = "govuk-!-padding-bottom-0";
    /// `govuk-!-padding-bottom-1`
    pub const BOTTOM_1: &str = "govuk-!-padding-bottom-1";
    /// `govuk-!-padding-bottom-2`
    pub const BOTTOM_2: &str = "govuk-!-padding-bottom-2";
    /// `govuk-!-padding-bottom-3`
    pub const BOTTOM_3: &str = "govuk-!-padding-bottom-3";
    /// `govuk-!-padding-bottom-4`
    pub const BOTTOM_4: &str = "govuk-!-padding-bottom-4";
    /// `govuk-!-padding-bottom-5`
    pub const BOTTOM_5: &str = "govuk-!-padding-bottom-5";
    /// `govuk-!-padding-bottom-6`
    pub const BOTTOM_6: &str = "govuk-!-padding-bottom-6";
    /// `govuk-!-padding-bottom-7`
    pub const BOTTOM_7: &str = "govuk-!-padding-bottom-7";
    /// `govuk-!-padding-bottom-8`
    pub const BOTTOM_8: &str = "govuk-!-padding-bottom-8";
    /// `govuk-!-padding-bottom-9`
    pub const BOTTOM_9: &str = "govuk-!-padding-bottom-9";
    /// `govuk-!-padding-left-0`
    pub const LEFT_0: &str = "govuk-!-padding-left-0";
    /// `govuk-!-padding-left-1`
    pub const LEFT_1: &str = "govuk-!-padding-left-1";
    /// `govuk-!-padding-left-2`
    pub const LEFT_2: &str = "govuk-!-padding-left-2";
    /// `govuk-!-padding-left-3`
    pub const LEFT_3: &str = "govuk-!-padding-left-3";
    /// `govuk-!-padding-left-4`
    pub const LEFT_4: &str = "govuk-!-padding-left-4";
    /// `govuk-!-padding-left-5`
    pub const LEFT_5: &str = "govuk-!-padding-left-5";
    /// `govuk-!-padding-left-6`
    pub const LEFT_6: &str = "govuk-!-padding-left-6";
    /// `govuk-!-padding-left-7`
    pub const LEFT_7: &str = "govuk-!-padding-left-7";
    /// `govuk-!-padding-left-8`
    pub const LEFT_8: &str = "govuk-!-padding-left-8";
    /// `govuk-!-padding-left-9`
    pub const LEFT_9: &str = "govuk-!-padding-left-9";
}
