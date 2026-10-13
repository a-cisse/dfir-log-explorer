use chrono::DateTime;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ParserMode {
    #[default]
    Auto,
    Apache,
    Text,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ParseStatus {
    Parsed,
    Partial,
    #[default]
    Unparsed,
}

impl ParseStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Parsed => "parsed",
            Self::Partial => "partial",
            Self::Unparsed => "unparsed",
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParsedFields {
    pub parser: String,
    pub parse_status: ParseStatus,
    pub timestamp: Option<String>,
    pub timestamp_ms: Option<i64>,
    pub source_ip: Option<String>,
    pub method: Option<String>,
    pub path: Option<String>,
    pub protocol: Option<String>,
    pub status: Option<i32>,
    pub response_bytes: Option<i64>,
    pub referrer: Option<String>,
    pub user_agent: Option<String>,
    pub parse_error: Option<String>,
}

fn apache_pattern() -> &'static Regex {
    static PATTERN: OnceLock<Regex> = OnceLock::new();
    PATTERN.get_or_init(|| {
        Regex::new(r#"^(?P<host>\S+) \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<request>(?:\\.|[^"\\])*)" (?P<status>\d{3}) (?P<bytes>\d+|-)(?: "(?P<referrer>(?:\\.|[^"\\])*)" "(?P<agent>(?:\\.|[^"\\])*)")?\s*$"#)
            .expect("the built-in Apache pattern is valid")
    })
}

pub fn parse_line(line: &str, mode: ParserMode) -> ParsedFields {
    let mut fields = ParsedFields {
        parser: "text".into(),
        ..Default::default()
    };
    if mode == ParserMode::Text {
        fields.parse_status = ParseStatus::Parsed;
        return fields;
    }
    let Some(captures) = apache_pattern().captures(line) else {
        if mode == ParserMode::Apache {
            fields.parser = "unparsed".into();
            fields.parse_error =
                Some("Line does not match Apache Common or Combined format.".into());
        }
        return fields;
    };
    // Validate independently so a bad required field cannot erase valid evidence.
    fields.parser = "apache".into();
    fields.source_ip = Some(captures["host"].into());
    fields.referrer = captures.name("referrer").map(|v| v.as_str().into());
    fields.user_agent = captures.name("agent").map(|v| v.as_str().into());
    let mut errors = Vec::new();
    match DateTime::parse_from_str(&captures["time"], "%d/%b/%Y:%H:%M:%S %z") {
        Ok(timestamp) => {
            fields.timestamp = Some(timestamp.to_rfc3339());
            fields.timestamp_ms = Some(timestamp.timestamp_millis());
        }
        Err(_) => errors.push("Invalid Apache timestamp or timezone."),
    }
    match captures["status"].parse::<i32>() {
        Ok(status) if (100..=599).contains(&status) => fields.status = Some(status),
        _ => errors.push("HTTP status must be between 100 and 599."),
    }
    if &captures["bytes"] != "-" {
        match captures["bytes"].parse::<i64>() {
            Ok(bytes) => fields.response_bytes = Some(bytes),
            Err(_) => errors.push("Response byte count is too large."),
        }
    }
    let request = &captures["request"];
    if request != "-" {
        let parts: Vec<_> = request.split_whitespace().collect();
        if parts.len() == 3 && parts[2].starts_with("HTTP/") {
            fields.method = Some(parts[0].into());
            fields.path = Some(parts[1].into());
            fields.protocol = Some(parts[2].into());
        } else {
            errors.push("Invalid Apache HTTP request field.");
        }
    }
    fields.parse_status = if errors.is_empty() {
        ParseStatus::Parsed
    } else {
        ParseStatus::Partial
    };
    if !errors.is_empty() {
        fields.parse_error = Some(errors.join(" "));
    }
    fields
}

#[cfg(test)]
mod tests {
    use super::*;

    const COMMON: &str =
        r#"192.0.2.10 - - [10/Oct/2000:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326"#;

    #[test]
    fn parses_common_and_preserves_timezone() {
        let fields = parse_line(COMMON, ParserMode::Auto);
        assert_eq!(fields.parser, "apache");
        assert_eq!(
            fields.timestamp.as_deref(),
            Some("2000-10-10T13:55:36-07:00")
        );
        assert_eq!(fields.timestamp_ms, Some(971211336000));
        assert_eq!(fields.path.as_deref(), Some("/index.html"));
        assert_eq!(fields.status, Some(200));
        assert_eq!(fields.response_bytes, Some(2326));
    }

    #[test]
    fn parses_combined_ipv6_and_escaped_agent() {
        let line = r#"2001:db8::1 - user [13/Oct/2026:10:00:00 +0200] "POST /login HTTP/2.0" 401 - "-" "Agent\"quoted""#;
        let fields = parse_line(line, ParserMode::Apache);
        assert_eq!(fields.source_ip.as_deref(), Some("2001:db8::1"));
        assert_eq!(fields.user_agent.as_deref(), Some(r#"Agent\"quoted"#));
        assert_eq!(fields.response_bytes, None);
        assert!(fields.parse_error.is_none());
    }

    #[test]
    fn keeps_unrecognized_text_and_marks_forced_parse_failure() {
        assert_eq!(
            parse_line("unstructured text", ParserMode::Auto).parser,
            "text"
        );
        assert!(parse_line("unstructured text", ParserMode::Apache)
            .parse_error
            .is_some());
        assert_eq!(parse_line(COMMON, ParserMode::Text).parser, "text");
    }

    #[test]
    fn rejects_ambiguous_or_invalid_dates_and_statuses() {
        assert!(parse_line(&COMMON.replace("-0700", ""), ParserMode::Apache)
            .parse_error
            .is_some());
        assert!(
            parse_line(&COMMON.replace("200 2326", "999 2326"), ParserMode::Auto)
                .parse_error
                .is_some()
        );
    }
    #[test]
    fn partial_retains_valid_fields_and_optional_absences_are_not_failures() {
        let bad = COMMON
            .replace("10/Oct/2000:13:55:36 -0700", "invalid date")
            .replace("200 2326", "999 2326");
        let fields = parse_line(&bad, ParserMode::Apache);
        assert_eq!(fields.parse_status, ParseStatus::Partial);
        assert_eq!(fields.source_ip.as_deref(), Some("192.0.2.10"));
        assert_eq!(fields.path.as_deref(), Some("/index.html"));
        assert_eq!(fields.response_bytes, Some(2326));
        assert_eq!(fields.timestamp, None);
        assert_eq!(fields.status, None);
        assert!(fields.parse_error.unwrap().contains("HTTP status"));
        let optional = parse_line(
            &COMMON
                .replace("GET /index.html HTTP/1.1", "-")
                .replace("2326", "-"),
            ParserMode::Apache,
        );
        assert_eq!(optional.parse_status, ParseStatus::Parsed);
        assert!(optional.parse_error.is_none());
        assert_eq!(optional.method, None);
        assert_eq!(optional.response_bytes, None);
        assert_eq!(optional.referrer, None);
        let malformed = parse_line(
            &COMMON.replace("GET /index.html HTTP/1.1", "GET /index.html"),
            ParserMode::Apache,
        );
        assert_eq!(malformed.parse_status, ParseStatus::Partial);
        assert_eq!(malformed.timestamp_ms, Some(971211336000));
        assert_eq!(malformed.method, None);
        assert_eq!(
            parse_line(&COMMON[..COMMON.len() / 2], ParserMode::Apache).parse_status,
            ParseStatus::Unparsed
        );
        assert_eq!(
            parse_line("unexpected format", ParserMode::Auto).parse_status,
            ParseStatus::Unparsed
        );
        assert_eq!(
            parse_line("raw text", ParserMode::Text).parse_status,
            ParseStatus::Parsed
        );
    }
}
