#![cfg(test)]

use super::*;
use soroban_sdk::{BytesN, Env};

fn mock_hash(env: &Env, seed: u8) -> BytesN<32> {
    let mut bytes = [0u8; 32];
    bytes[0] = seed;
    BytesN::from_array(env, &bytes)
}

#[test]
fn test_store_and_retrieve_score() {
    let env = Env::default();
    let contract_id = env.register(ZKreditVerifier, ());
    let client = ZKreditVerifierClient::new(&env, &contract_id);

    let address_hash = mock_hash(&env, 1);
    let image_id = mock_hash(&env, 2);
    let journal_digest = mock_hash(&env, 3);

    let proof = ProofInput {
        address_hash: address_hash.clone(),
        score: 720,
        hodl_component: 0,
        frequency_component: 0,
        stability_component: 100,
        image_id,
        journal_digest,
    };

    let record = client.store_score(&proof);
    assert_eq!(record.score, 720);
    assert_eq!(record.hodl_component, 0);
    assert_eq!(record.stability_component, 100);

    let fetched = client.get_score(&address_hash).unwrap();
    assert_eq!(fetched.score, 720);
}

#[test]
fn test_meets_threshold() {
    let env = Env::default();
    let contract_id = env.register(ZKreditVerifier, ());
    let client = ZKreditVerifierClient::new(&env, &contract_id);

    let address_hash = mock_hash(&env, 1);
    let image_id = mock_hash(&env, 2);
    let journal_digest = mock_hash(&env, 3);

    let proof = ProofInput {
        address_hash: address_hash.clone(),
        score: 720,
        hodl_component: 0,
        frequency_component: 0,
        stability_component: 100,
        image_id,
        journal_digest,
    };

    client.store_score(&proof);

    assert_eq!(client.meets_threshold(&address_hash, &700), true);
    assert_eq!(client.meets_threshold(&address_hash, &750), false);
}

#[test]
#[should_panic]
fn test_invalid_score_rejected() {
    let env = Env::default();
    let contract_id = env.register(ZKreditVerifier, ());
    let client = ZKreditVerifierClient::new(&env, &contract_id);

    let proof = ProofInput {
        address_hash: mock_hash(&env, 1),
        score: 900, // out of range
        hodl_component: 0,
        frequency_component: 0,
        stability_component: 100,
        image_id: mock_hash(&env, 2),
        journal_digest: mock_hash(&env, 3),
    };

    client.store_score(&proof);
}
