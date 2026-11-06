//! One-time auth codes (port of `auth/authCode.ts`).

use std::time::{Duration, SystemTime, UNIX_EPOCH};

const CODE_LENGTH: usize = 5;
const CODE_CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
pub const CODE_EXPIRY: Duration = Duration::from_millis(300_000);
pub const MAX_ATTEMPTS: u32 = 3;

/// Milliseconds since the epoch (`Date.now()`).
pub fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or_default()
}

/// Random bytes from the OS (`crypto.randomBytes`).
pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut bytes = vec![0; n];
    getrandom::fill(&mut bytes).expect("OS randomness");
    bytes
}

pub fn random_hex(n: usize) -> String {
    random_bytes(n).iter().map(|b| format!("{b:02x}")).collect()
}

#[derive(Clone, Debug)]
pub struct PendingCode {
    pub code: String,
    pub expires_at: u64,
    pub attempts: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CodeValidation {
    Valid,
    Invalid,
    Expired,
    MaxAttempts,
}

/// `generateCode`.
pub fn generate_code() -> PendingCode {
    generate_code_at(now_ms())
}

pub fn generate_code_at(now: u64) -> PendingCode {
    let code = random_bytes(CODE_LENGTH).iter().map(|b| CODE_CHARSET[*b as usize % CODE_CHARSET.len()] as char).collect();
    PendingCode { code, expires_at: now + CODE_EXPIRY.as_millis() as u64, attempts: 0 }
}

/// `validateCode`.
pub fn validate_code(pending: &mut PendingCode, submitted: &str) -> CodeValidation {
    validate_code_at(pending, submitted, now_ms())
}

pub fn validate_code_at(pending: &mut PendingCode, submitted: &str, now: u64) -> CodeValidation {
    if now > pending.expires_at {
        return CodeValidation::Expired;
    }
    if pending.attempts >= MAX_ATTEMPTS {
        return CodeValidation::MaxAttempts;
    }
    pending.attempts += 1;
    if submitted.to_uppercase() == pending.code {
        return CodeValidation::Valid;
    }
    if pending.attempts >= MAX_ATTEMPTS {
        return CodeValidation::MaxAttempts;
    }
    CodeValidation::Invalid
}
