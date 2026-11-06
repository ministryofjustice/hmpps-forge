use forge_core::authoring::*;
use forge_core::{Value, obj};
use forge_govuk_components::blocks as govuk;

pub fn heading() -> Value {
    govuk::HEADING.build(obj! {
        "text": "CMS content",
        "size": "l",
        "caption": "Pattern",
    })
}

pub fn intro() -> Value {
    govuk::BODY.build(obj! {
        "text": "A simple blog-style CMS where users write posts using a rich text\n  editor and view them on a separate page. Content is stored in the\n  session and rendered as HTML. This pattern shows how to integrate a\n  third-party editor component with Forge's form submission flow.",
    })
}

pub fn shows() -> Value {
    govuk::HEADING.build(obj! { "text": "What this pattern shows", "size": "s" })
}

pub fn shows_list() -> Value {
    govuk::LIST.build(obj! {
        "items": literal([
            "A custom rich text editor component wrapping the MOJ Rich Text Editor",
            "Saving user-generated HTML content via effects",
            "Rendering dynamic HTML content with CollectionBlock and HtmlBlock",
            "Session-based content storage for a multi-step authoring flow",
        ]),
        "style": "bullet",
    })
}

pub fn start_button() -> Value {
    govuk::LINK_BUTTON.build(obj! {
        "text": "Start the pattern",
        "href": "/forge-developer-guide/patterns/demos/cms-content/posts",
        "isStartButton": true,
    })
}
