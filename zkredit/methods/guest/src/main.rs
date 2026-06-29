use risc0_zkvm::guest::env;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Serialize)]
pub struct StellarAccountData {
    pub address_hash: [u8; 32],
    pub account_age_days: u32,
    pub total_transactions: u32,
    pub monthly_tx_counts: Vec<u32>,
    pub monthly_balances: Vec<f64>,
    pub has_trustlines: bool,
    pub uses_dex: bool,
}

#[derive(Debug, Serialize)]
pub struct CreditResult {
    pub address_hash: [u8; 32],
    pub score: u32,
    pub hodl_component: u32,
    pub frequency_component: u32,
    pub stability_component: u32,
}

fn score_hodl(age_days: u32) -> u32 {
    match age_days {
        0..=89 => 0,
        90..=179 => 40,
        180..=364 => 60,
        365..=729 => 80,
        _ => 100,
    }
}

fn score_frequency(monthly_counts: &[u32]) -> u32 {
    if monthly_counts.is_empty() {
        return 0;
    }
    let avg = monthly_counts.iter().sum::<u32>() / monthly_counts.len() as u32;
    match avg {
        0 => 0,
        1 => 30,
        2..=8 => 100,
        9..=15 => 70,
        _ => 40,
    }
}

fn score_stability(balances: &[f64]) -> u32 {
    if balances.len() < 2 {
        return 0;
    }
    let mean = balances.iter().sum::<f64>() / balances.len() as f64;
    if mean == 0.0 {
        return 0;
    }
    let variance = balances.iter().map(|b| (b - mean).powi(2)).sum::<f64>() / balances.len() as f64;
    let std_dev = variance.sqrt();
    let cv = std_dev / mean;

    if cv < 0.1 {
        100
    } else if cv < 0.25 {
        85
    } else if cv < 0.5 {
        65
    } else if cv < 1.0 {
        40
    } else {
        15
    }
}

fn compute_score(data: &StellarAccountData) -> CreditResult {
    let hodl = score_hodl(data.account_age_days);
    let frequency = score_frequency(&data.monthly_tx_counts);
    let stability = score_stability(&data.monthly_balances);

    let raw = (hodl * 40 + frequency * 30 + stability * 30) / 100;

    let bonus = if data.has_trustlines { 5 } else { 0 } + if data.uses_dex { 5 } else { 0 };

    let score = 650 + ((raw + bonus).min(100) * 200 / 100);

    CreditResult {
        address_hash: data.address_hash,
        score,
        hodl_component: hodl,
        frequency_component: frequency,
        stability_component: stability,
    }
}

fn main() {
    let account: StellarAccountData = env::read();
    let result = compute_score(&account);
    env::commit(&result);
}
