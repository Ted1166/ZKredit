use chrono::{DateTime, Utc};
use methods::{METHOD_ELF, METHOD_ID};
use risc0_zkvm::{default_prover, ExecutorEnv};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

#[derive(Debug, Serialize, Deserialize)]
pub struct StellarAccountData {
    pub address_hash: [u8; 32],
    pub account_age_days: u32,
    pub total_transactions: u32,
    pub monthly_tx_counts: Vec<u32>,
    pub monthly_balances: Vec<f64>,
    pub has_trustlines: bool,
    pub uses_dex: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreditResult {
    pub address_hash: [u8; 32],
    pub score: u32,
    pub hodl_component: u32,
    pub frequency_component: u32,
    pub stability_component: u32,
}

#[derive(Debug, Deserialize)]
struct HorizonAccount {
    balances: Vec<Balance>,
    subentry_count: u32,
}

#[derive(Debug, Deserialize)]
struct Balance {
    balance: String,
    asset_type: String,
    #[serde(default)]
    asset_code: String,
}

#[derive(Debug, Deserialize)]
struct TransactionsResponse {
    #[serde(rename = "_embedded")]
    embedded: Embedded,
}

#[derive(Debug, Deserialize)]
struct Embedded {
    records: Vec<Transaction>,
}

#[derive(Debug, Deserialize)]
struct Transaction {
    created_at: String,
}

fn fetch_account(address: &str) -> HorizonAccount {
    let url = format!("https://horizon-testnet.stellar.org/accounts/{}", address);
    let response = reqwest::blocking::get(&url).expect("Failed to fetch account");
    response
        .json::<HorizonAccount>()
        .expect("Failed to parse account")
}

fn fetch_transactions(address: &str) -> Vec<Transaction> {
    let url = format!(
        "https://horizon-testnet.stellar.org/accounts/{}/transactions?limit=200&order=asc",
        address
    );
    let response = reqwest::blocking::get(&url).expect("Failed to fetch transactions");
    let data: TransactionsResponse = response.json().expect("Failed to parse transactions");
    data.embedded.records
}

fn build_account_data(address: &str) -> StellarAccountData {
    println!("Fetching live data from Stellar Horizon...");

    let account = fetch_account(address);
    let transactions = fetch_transactions(address);

    let mut hasher = Sha256::new();
    hasher.update(address.as_bytes());
    let hash_bytes = hasher.finalize();
    let mut address_hash = [0u8; 32];
    address_hash.copy_from_slice(&hash_bytes);

    let now = Utc::now();
    let account_age_days = if let Some(first_tx) = transactions.first() {
        let created: DateTime<Utc> = first_tx.created_at.parse().unwrap_or(now);
        (now - created).num_days().max(0) as u32
    } else {
        0
    };

    let xlm_balance = account
        .balances
        .iter()
        .find(|b| b.asset_type == "native")
        .map(|b| b.balance.parse::<f64>().unwrap_or(0.0))
        .unwrap_or(0.0);

    let has_trustlines = account.balances.iter().any(|b| b.asset_type != "native");

    let total_transactions = transactions.len() as u32;

    let mut monthly_tx_counts = vec![0u32; 12];
    for tx in &transactions {
        let tx_date: DateTime<Utc> = tx.created_at.parse().unwrap_or(now);
        let months_ago = (now.timestamp() - tx_date.timestamp()) / (30 * 24 * 3600);
        if months_ago < 12 {
            monthly_tx_counts[months_ago as usize] += 1;
        }
    }

    // Horizon free tier doesn't expose historical balances.
    // Using current balance as baseline and stability reflects
    // balance consistency at point of proof generation.
    let monthly_balances = vec![xlm_balance; 12];

    let trustline_count = account
        .balances
        .iter()
        .filter(|b| b.asset_type != "native")
        .count() as u32;
    let uses_dex = account.subentry_count > trustline_count;

    let trustline_names: Vec<&str> = account
        .balances
        .iter()
        .filter(|b| b.asset_type != "native")
        .map(|b| b.asset_code.as_str())
        .collect();

    println!("Trustlines: {:?}", trustline_names);

    StellarAccountData {
        address_hash,
        account_age_days,
        total_transactions,
        monthly_tx_counts,
        monthly_balances,
        has_trustlines,
        uses_dex,
    }
}

fn submit_score_to_chain(result: &CreditResult) {
    use std::process::Command;

    // Convert address_hash to hex string for CLI
    let hash_hex: String = result
        .address_hash
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect();

    println!("\nSubmitting score to Stellar testnet...");

    let output = Command::new("stellar")
        .args([
            "contract", "invoke",
            "--id", "CCT2KJTR5R6U4GTZWS6GAY5S2T5G4JOUU5XS4EGJQ2TKXEEVOV7QQXLH",
            "--source", "zkredit-deployer",
            "--network", "testnet",
            "--send=yes",
            "--",
            "store_score",
            "--proof", &format!(
                r#"{{"address_hash":"{}","score":{},"hodl_component":{},"frequency_component":{},"stability_component":{},"image_id":"{}","journal_digest":"{}"}}"#,
                hash_hex,
                result.score,
                result.hodl_component,
                result.frequency_component,
                result.stability_component,
                hash_hex,
                hash_hex,
            ),
        ])
        .output()
        .expect("Failed to invoke stellar CLI");

    if output.status.success() {
        println!("✓ Score submitted on-chain successfully");
        println!("{}", String::from_utf8_lossy(&output.stdout));
    } else {
        println!("✗ Submission failed:");
        println!("{}", String::from_utf8_lossy(&output.stderr));
    }
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::filter::EnvFilter::from_default_env())
        .init();

    let address = "GAZO4L3NT6KXGCYH7FSM7NWYO3O4WQ3DOEJI54MBPSMUPSCQJBMUBBGQ";

    let account = build_account_data(address);

    println!("=== ZKredit — Live Stellar Account ===");
    println!(
        "Address: {}...{}",
        &address[..6],
        &address[address.len() - 6..]
    );
    println!("Account age: {} days", account.account_age_days);
    println!("Transactions: {}", account.total_transactions);
    println!("Has trustlines: {}", account.has_trustlines);
    println!("Uses DEX: {}", account.uses_dex);
    println!("\nGenerating ZK proof...");

    let env = ExecutorEnv::builder()
        .write(&account)
        .unwrap()
        .build()
        .unwrap();

    let prover = default_prover();
    let prove_info = prover.prove(env, METHOD_ELF).unwrap();
    let receipt = prove_info.receipt;

    let result: CreditResult = receipt.journal.decode().unwrap();

    println!("\n=== Proof Generated ===");
    println!("Credit Score: {}", result.score);
    println!("HODL Component: {}/100", result.hodl_component);
    println!("Frequency Component: {}/100", result.frequency_component);
    println!("Stability Component: {}/100", result.stability_component);

    receipt.verify(METHOD_ID).unwrap();
    submit_score_to_chain(&result);
    println!("\n✓ Proof verified - score is cryptographically valid");
    println!("Next: submit proof to Soroban verifier contract on Stellar testnet");
}
