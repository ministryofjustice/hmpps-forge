//! Comma splitting at paren depth 0 (respects quoted regions).

/// Split on top-level commas for argument / parameter lists.
///
/// Tracks `()`, `[]`, and `{}` nesting so commas inside literals (e.g. `["a","b"]`) do not split.
pub(crate) fn split_top_level_commas(s: &str) -> Vec<&str> {
    if s.is_empty() {
        return Vec::new();
    }
    let bytes = s.as_bytes();
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut i = 0usize;
    let mut paren = 0i32;
    let mut bracket = 0i32;
    let mut brace = 0i32;
    let mut in_string: Option<u8> = None;
    let mut escaped = false;
    while i < bytes.len() {
        let c = bytes[i];
        if let Some(q) = in_string {
            if escaped {
                escaped = false;
                i += 1;
                continue;
            }
            if c == b'\\' {
                escaped = true;
                i += 1;
                continue;
            }
            if c == q {
                in_string = None;
            }
            i += 1;
            continue;
        }
        if c == b'"' || c == b'\'' {
            in_string = Some(c);
            i += 1;
            continue;
        }
        match c {
            b'(' => paren += 1,
            b')' => paren = (paren - 1).max(0),
            b'[' => bracket += 1,
            b']' => bracket = (bracket - 1).max(0),
            b'{' => brace += 1,
            b'}' => brace = (brace - 1).max(0),
            b',' if paren == 0 && bracket == 0 && brace == 0 => {
                out.push(s[start..i].trim());
                start = i + 1;
            }
            _ => {}
        }
        i += 1;
    }
    out.push(s[start..].trim());
    out
}

#[cfg(test)]
mod tests {
    use super::split_top_level_commas;

    #[test]
    fn commas_inside_brackets_do_not_split_segments() {
        assert_eq!(
            split_top_level_commas(r#"["a","b"], c"#),
            vec![r#"["a","b"]"#, "c"]
        );
    }

    #[test]
    fn commas_inside_braces_do_not_split_segments() {
        assert_eq!(
            split_top_level_commas(r#"{"a": 1, "b": 2}, x"#),
            vec![r#"{"a": 1, "b": 2}"#, "x"]
        );
    }
}
