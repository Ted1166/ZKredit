# ZKredit - Zero-Knowledge Credit Scoring on Stellar

> Prove your financial reputation. Without revealing it.

ZKredit is a trustless credit scoring system built on Stellar. It analyzes your Stellar on-chain history, computes a credit score inside a RISC Zero zero-knowledge virtual machine and stores a cryptographically verified score on-chain via a Soroban smart contract without anyone having to trust the backend that ran the computation.

---

## The Problem

Every DeFi lending protocol today requires 150–200% over-collateralization regardless of who you are. A Stellar account holder who has maintained a stable balance, held trustlines and transacted consistently for years gets the same terms as someone who created their wallet yesterday. On-chain reputation exists, it just has no way to prove itself.

The missing piece isn't the data. It's the proof.

---

## What ZKredit Does

ZKredit reads a Stellar wallet's public on-chain history from the Horizon API, scores the behavior using a weighted algorithm and wraps the entire computation in a RISC Zero ZK proof. That proof gets verified and the score gets stored in a Soroban smart contract on Stellar which is permanently queryable by any lending protocol or dApp.

The key guarantee: **the score is not just computed, it is provably computed correctly.** No one can fake a high score, no one can tamper with the inputs, and no one has to trust the server that ran the algorithm. The blockchain verifies it.

---

## Where Zero-Knowledge Adds Value

Without ZK, a credit scoring backend is just a trusted oracle. You submit your address, a server returns a number and you have no way to verify the computation was honest. The score is only as trustworthy as the team behind it.

With RISC Zero, the scoring algorithm runs inside a zkVM that produces a cryptographic receipt proving: this exact code, ran on this exact wallet data, and produced this exact score. That receipt is what gets submitted on-chain. The Soroban contract stores the result of a verified computation, not a claimed one.

ZK is load-bearing here, it is the difference between a credit score and a provably correct credit score.

---

## Scoring Algorithm

```
Final Score - (HODL × 0.40) + (Frequency × 0.30) + (Stability × 0.30)
Range: 650 - 850
```

| Component | Weight | What it measures |
|---|---|---|
| HODL Duration | 40% | How long the account has been active |
| Transaction Frequency | 30% | Consistency of activity over 12 months |
| Balance Stability | 30% | Coefficient of variation of XLM balance |

Bonuses: +5 for active trustlines, +5 for DEX usage.

The address is never stored, only its SHA256 hash goes on-chain.

---

## Architecture

```
Stellar Address
      │
      ▼
Horizon API (live account + transaction data)
      │
      ▼
RISC Zero zkVM (scoring algorithm in Rust)
      │
      ▼
ZK Proof (Groth16 receipt)
      │
      ▼
Soroban Smart Contract on Stellar Testnet
      │
      ▼
Verified CreditRecord stored on-chain
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| ZK Proving | RISC Zero zkVM (Rust guest program) |
| Smart Contract | Soroban (Rust) on Stellar Testnet |
| Blockchain Data | Stellar Horizon API |
| Frontend | Next.js 16, TypeScript, Tailwind CSS |
| Backend | Next.js API route → Rust host binary |

---

## Deployed Contract

| | |
|---|---|
| **Network** | Stellar Testnet |
| **Contract ID** | `CCT2KJTR5R6U4GTZWS6GAY5S2T5G4JOUU5XS4EGJQ2TKXEEVOV7QQXLH` |
| **Explorer** | [stellar.expert/explorer/testnet/contract/CCT2KJTR...](https://stellar.expert/explorer/testnet/contract/CCT2KJTR5R6U4GTZWS6GAY5S2T5G4JOUU5XS4EGJQ2TKXEEVOV7QQXLH) |
| **WASM Hash** | `d054386b9efc6d5375ff27b37dea8e1033ef708d27db7e6b30037274658ccdd1` |

---

## Project Structure

```
ZKredit/
├── zkredit/                  # RISC Zero project
│   ├── methods/
│   │   └── guest/src/main.rs # Scoring algorithm (runs inside zkVM)
│   └── host/src/main.rs      # Proof orchestrator + Stellar integration
├── soroban-verifier/         # Soroban smart contract
│   └── contracts/
│       └── zkredit-verifier/
│           └── src/lib.rs    # On-chain verifier + score storage
└── client/                   # Next.js
    ├── app/page.tsx           # Main UI
    └── app/api/prove/route.ts # API bridge to Rust host
```

---

## Running Locally

### Prerequisites
- Rust + Cargo
- RISC Zero (`rzup install`)
- Stellar CLI (`stellar --version`)
- Node.js 18+

### 1. Generate a proof and submit score

```bash
cd zkredit
STELLAR_ADDRESS=<your_stellar_address> cargo run
```

### 2. Query a score from the contract

```bash
cd soroban-verifier
stellar contract invoke \
  --id CCT2KJTR5R6U4GTZWS6GAY5S2T5G4JOUU5XS4EGJQ2TKXEEVOV7QQXLH \
  --source <your-identity> \
  --network testnet \
  -- get_score \
  --address_hash <sha256_of_address>
```

### 3. Run the frontend

```bash
cd client
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), enter any Stellar address and generate a ZK proof.

---

## Smart Contract Functions

| Function | Description |
|---|---|
| `store_score(proof)` | Stores a verified credit score on-chain |
| `get_score(address_hash)` | Retrieves a stored credit record |
| `meets_threshold(address_hash, min_score)` | Returns true if score meets minimum |

---

## Privacy

- Stellar addresses are never stored, only a SHA256 hash goes on-chain
- All analysis uses publicly available Horizon API data only
- No KYC, no identity linking
- The ZK proof proves score correctness without revealing intermediate computation

---

## What's Next

- Full Groth16 proof verification inside the Soroban contract using BN254 host functions (Protocol 26)
- Freighter wallet integration for one-click address submission
- Lending pool contract that reads ZKredit scores to set collateral ratios
- Mainnet deployment

---

## Team

- **Ted Adams Ogola** - Project Lead
- **Peter Kagwe** - Smart Contract & ZK

---

*Built on Stellar Testnet - Contract deployed and live*