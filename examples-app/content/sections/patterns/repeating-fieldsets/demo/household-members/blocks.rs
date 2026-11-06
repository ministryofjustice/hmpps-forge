use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;
use forge_govuk_components::classes;
use forge_core::builtins::components as core_blocks;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "Household members",
        "size": "l",
    })
}

// TODO: TemplateWrapper version kept for comparison — remove once array approach is confirmed
// export const memberRows = CollectionBlock({
//   collection: Data('members').each(
//     Iterator.Map(
//       TemplateWrapper({
//         template: '<div>{{slot:name}}{{slot:age}}{{slot:remove}}{{slot:break}}</div>',
//         slots: {
//           name: [
//             GovUKTextInput({
//               code: Format('memberName_%1', Loop.Index0()),
//               label: { text: 'Name' },
//               defaultValue: Item().path('memberName'),
//               classes: GovUKUtilityClasses.Input.Width20,
//               formatters: [Transformer.String.Trim()],
//               validWhen: [
//                 validation({
//                   condition: Self().match(Condition.IsRequired()),
//                   message: 'Enter a name',
//                 }),
//               ],
//             }),
//           ],
//           age: [
//             GovUKTextInput({
//               code: Format('memberAge_%1', Loop.Index0()),
//               label: { text: 'Age' },
//               defaultValue: Item().path('memberAge'),
//               classes: GovUKUtilityClasses.Input.Width5,
//               inputMode: 'numeric',
//               validWhen: [
//                 validation({
//                   condition: Self().match(Condition.IsRequired()),
//                   message: 'Enter an age',
//                 }),
//                 validation({
//                   condition: Self().match(Condition.Number.IsNumber()),
//                   message: 'Enter a number',
//                 }),
//               ],
//             }),
//           ],
//           remove: [
//             GovUKButton({
//               text: 'Remove',
//               name: 'action',
//               value: Format('remove_%1', Loop.Index0()),
//               classes: 'govuk-button--warning',
//             }),
//           ],
//           break: [GovUKSectionBreak({ size: 'l', visible: true })],
//         },
//       }),
//     ),
//   ),
//   fallback: [GovUKInsetText({ text: 'You have not added any household members yet.' })],
// })
pub fn member_rows() -> Value {
    core_blocks::COLLECTION_BLOCK.build(obj! {
        "collection": data("members").each(iterator::map([
            govuk::TEXT_INPUT.build(obj! {
                "code": format("memberName_%1", [Loop.index0().into()]),
                "label": obj! { "text": "Name" },
                "defaultValue": item().path("memberName"),
                "classes": classes::input::WIDTH_20,
                "formatters": [transformer::string::trim()],
                "validWhen": [
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter a name",
                    }),
                ],
            }),
            govuk::TEXT_INPUT.build(obj! {
                "code": format("memberAge_%1", [Loop.index0().into()]),
                "label": obj! { "text": "Age" },
                "formatters": [transformer::string::to_int()],
                "defaultValue": item().path("memberAge"),
                "classes": classes::input::WIDTH_5,
                "inputMode": "numeric",
                "validWhen": [
                    validation(obj! {
                        "condition": self_().matches(condition::is_required()),
                        "message": "Enter an age",
                    }),
                    validation(obj! {
                        "condition": self_().matches(condition::number::is_number()),
                        "message": "Enter a number",
                    }),
                ],
            }),
            govuk::BUTTON.build(obj! {
                "text": "Remove",
                "name": "action",
                "value": format("remove_%1", [Loop.index0().into()]),
                "classes": "govuk-button--warning",
            }),
            govuk::SECTION_BREAK.build(obj! { "size": "l", "visible": true }),
        ])),
        "fallback": [govuk::INSET_TEXT.build(obj! { "text": "You have not added any household members yet." })],
    })
}

pub fn button_group() -> Value {
    govuk::BUTTON_GROUP.build(obj! {
        "buttons": [
            govuk::BUTTON.build(obj! {
                "text": "Add another person",
                "name": "action",
                "value": "add-another",
                "classes": "govuk-button--secondary",
            }),
            govuk::BUTTON.build(obj! {
                "text": "Continue",
                "name": "action",
                "value": "continue",
            }),
        ],
    })
}
