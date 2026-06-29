#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, BytesN, Env, Map, Symbol};

// Stored on-chain for each verified address
#[contracttype]
#[derive(Clone)]
pub struct CreditRecord {
    pub address_hash: BytesN<32>,
    pub score: u32,
    pub hodl_component: u32,
    pub frequency_component: u32,
    pub stability_component: u32,
    pub verified_at: u64,
}

// What the host submits to store a verified score
#[contracttype]
#[derive(Clone)]
pub struct ProofInput {
    pub address_hash: BytesN<32>,
    pub score: u32,
    pub hodl_component: u32,
    pub frequency_component: u32,
    pub stability_component: u32,
    pub image_id: BytesN<32>,
    pub journal_digest: BytesN<32>,
}

const SCORES: Symbol = symbol_short!("SCORES");

#[contracttype]
pub struct ScoreSetEvent {
    pub score: u32,
    pub verified_at: u64,
}

#[contract]
pub struct ZKreditVerifier;

#[contractimpl]
impl ZKreditVerifier {
    // Store a verified credit score on-chain
    // In production: this would verify the RISC Zero Groth16 proof
    // using BN254 host functions before storing
    pub fn store_score(env: Env, proof: ProofInput) -> CreditRecord {
        // Validate score is in valid range
        if proof.score < 650 || proof.score > 850 {
            panic!("Score out of valid range 650-850");
        }

        let record = CreditRecord {
            address_hash: proof.address_hash.clone(),
            score: proof.score,
            hodl_component: proof.hodl_component,
            frequency_component: proof.frequency_component,
            stability_component: proof.stability_component,
            verified_at: env.ledger().timestamp(),
        };

        // Store indexed by address_hash
        let mut scores: Map<BytesN<32>, CreditRecord> = env
            .storage()
            .persistent()
            .get(&SCORES)
            .unwrap_or(Map::new(&env));

        scores.set(proof.address_hash, record.clone());
        env.storage().persistent().set(&SCORES, &scores);

        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("zkredit"), symbol_short!("score")),
            ScoreSetEvent {
                score: record.score,
                verified_at: record.verified_at,
            },
        );

        record
    }

    // Retrieve a stored credit record by address hash
    pub fn get_score(env: Env, address_hash: BytesN<32>) -> Option<CreditRecord> {
        let scores: Map<BytesN<32>, CreditRecord> = env
            .storage()
            .persistent()
            .get(&SCORES)
            .unwrap_or(Map::new(&env));

        scores.get(address_hash)
    }

    // Check if an address meets a minimum score threshold
    pub fn meets_threshold(env: Env, address_hash: BytesN<32>, min_score: u32) -> bool {
        match Self::get_score(env, address_hash) {
            Some(record) => record.score >= min_score,
            None => false,
        }
    }
}

mod test;
