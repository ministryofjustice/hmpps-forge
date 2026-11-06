use forge_core::authoring::Component;
use forge_core::{ComponentEntry, Value};

/// A lottery ball.
///
/// Props:
/// - `number` - the number on the ball.
/// - `color` - `"blue"` (the default) or `"green"` (optional).
/// - `classes` - extra classes (optional).
pub const LOTTERY_BALL: Component = Component::basic("lotteryBall");

pub fn lottery_ball_component() -> ComponentEntry {
    ComponentEntry::new("lotteryBall").with_render(|block, _engine| {
        let num = match block.get("number") {
            Value::Undefined | Value::Null => String::new(),
            n => n.to_js_string(),
        };
        let color_class = match block.get("color") {
            Value::Undefined | Value::Null => "lottery-ball--blue".to_string(),
            c => format!("lottery-ball--{}", c.to_js_string()),
        };
        let extra_classes = match block.get("classes") {
            c if c.truthy() => format!(" {}", c.to_js_string()),
            _ => String::new(),
        };

        Ok(Value::from(format!(
            r#"<div class="lottery-ball {color_class}{extra_classes}">
    <span class="lottery-ball__number">{num}</span>
  </div>"#
        )))
    })
}
