"use client";

import { useState } from "react";

type ProofResult = {
  score: number;
  hodl_component: number;
  frequency_component: number;
  stability_component: number;
  address_hash: string;
  verified_at: number;
  contract_id: string;
};

type Step = {
  label: string;
  done: boolean;
  active: boolean;
};

const STEPS = [
  "Fetching Stellar account data",
  "Building ZK circuit inputs",
  "Generating RISC Zero proof",
  "Verifying proof locally",
  "Submitting score on-chain",
];

function ScoreGauge({ score }: { score: number }) {
  const min = 650;
  const max = 850;
  const pct = (score - min) / (max - min);
  const angle = -140 + pct * 280;
  const color = score >= 750 ? "#00D4FF" : score >= 700 ? "#FFB800" : "#FF6B6B";

  return (
    <div className="relative flex flex-col items-center">
      <svg width="220" height="130" viewBox="0 0 220 130">
        <path
          d="M 20 120 A 90 90 0 0 1 200 120"
          fill="none"
          stroke="#243044"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <path
          d="M 20 120 A 90 90 0 0 1 200 120"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${pct * 283} 283`}
          style={{ transition: "stroke-dasharray 1.5s ease" }}
        />
        <line
          x1="110"
          y1="120"
          x2={110 + 70 * Math.cos(((angle - 90) * Math.PI) / 180)}
          y2={120 + 70 * Math.sin(((angle - 90) * Math.PI) / 180)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{ transition: "all 1.5s ease" }}
        />
        <circle cx="110" cy="120" r="6" fill={color} />
      </svg>
      <div className="mono text-6xl font-bold -mt-4" style={{ color }}>
        {score}
      </div>
      <div className="flex justify-between w-full px-4 mt-1">
        <span className="mono text-xs" style={{ color: "var(--text-dim)" }}>650</span>
        <span className="text-xs" style={{ color: "var(--text-dim)" }}>Credit Score</span>
        <span className="mono text-xs" style={{ color: "var(--text-dim)" }}>850</span>
      </div>
    </div>
  );
}

function Component({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span style={{ color: "var(--text-dim)" }}>{label}</span>
        <span className="mono" style={{ color: "var(--cyan)" }}>{value}/100</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--navy-border)" }}>
        <div
          className="h-1.5 rounded-full"
          style={{
            width: `${value}%`,
            background: "var(--cyan)",
            transition: "width 1s ease",
          }}
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [state, setState] = useState<"idle" | "proving" | "done" | "error">("idle");
  const [steps, setSteps] = useState<Step[]>(
    STEPS.map((label, i) => ({ label, done: false, active: i === 0 }))
  );
  const [result, setResult] = useState<ProofResult | null>(null);
  const [error, setError] = useState("");

  const runProof = async () => {
    if (!address.startsWith("G") || address.length !== 56) {
      setError("Enter a valid Stellar address (starts with G, 56 characters)");
      return;
    }

    setError("");
    setState("proving");

    let currentStep = 0;
    const stepInterval = setInterval(() => {
      if (currentStep < STEPS.length - 1) {
        currentStep++;
        setSteps(
          STEPS.map((label, i) => ({
            label,
            done: i < currentStep,
            active: i === currentStep,
          }))
        );
      }
    }, 15000);

    try {
      const res = await fetch("/api/prove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      clearInterval(stepInterval);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Proof generation failed");
      }

      const data = await res.json();
      setSteps(STEPS.map((label) => ({ label, done: true, active: false })));
      setResult(data);
      setState("done");
    } catch (err: unknown) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  };

  const reset = () => {
    setState("idle");
    setResult(null);
    setError("");
    setAddress("");
    setSteps(STEPS.map((label, i) => ({ label, done: false, active: i === 0 })));
  };

  return (
    <main style={{ minHeight: "100vh", padding: "0 1rem" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between mx-auto py-6"
        style={{ maxWidth: 900, borderBottom: "1px solid var(--navy-border)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="mono text-sm font-bold px-2 py-1 rounded"
            style={{
              background: "var(--cyan-dim)",
              color: "var(--cyan)",
              border: "1px solid #00D4FF20",
            }}
          >
            ZK
          </div>
          <span className="font-semibold text-lg">ZKredit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: "#00FF88" }} />
          <span className="text-xs mono" style={{ color: "var(--text-dim)" }}>
            Stellar Testnet
          </span>
        </div>
      </header>

      <div className="mx-auto py-16" style={{ maxWidth: 900 }}>
        {/* Idle state */}
        {state === "idle" && (
          <div className="flex flex-col items-center text-center gap-8">
            <div>
              <div
                className="mono text-xs font-medium mb-4 inline-block px-3 py-1 rounded-full"
                style={{
                  background: "var(--cyan-dim)",
                  color: "var(--cyan)",
                  border: "1px solid #00D4FF30",
                }}
              >
                Zero-Knowledge Credit Scoring on Stellar
              </div>
              <h1 className="text-5xl font-bold mb-4" style={{ lineHeight: 1.1 }}>
                Prove your financial
                <br />
                <span style={{ color: "var(--cyan)" }}>reputation.</span>{" "}
                <span style={{ color: "var(--text-dim)", fontWeight: 300 }}>
                  Without revealing it.
                </span>
              </h1>
              <p
                className="text-lg max-w-xl mx-auto"
                style={{ color: "var(--text-dim)", lineHeight: 1.6 }}
              >
                ZKredit analyzes your Stellar on-chain history and generates a
                cryptographic proof that your credit score was computed correctly
                - no trust in a backend required.
              </p>
            </div>

            <div className="w-full max-w-lg flex flex-col gap-3">
              <input
                type="text"
                placeholder="GAZO4L3NT6KXGCYH7FSM7NWYO3O4WQ3..."
                value={address}
                onChange={(e) => setAddress(e.target.value.trim())}
                className="mono w-full px-4 py-4 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--navy-card)",
                  border: "1px solid var(--navy-border)",
                  color: "var(--text)",
                  fontSize: "0.8rem",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--cyan)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--navy-border)")}
              />
              {error && (
                <p className="text-sm text-left px-1" style={{ color: "#FF6B6B" }}>
                  {error}
                </p>
              )}
              <button
                onClick={runProof}
                className="w-full py-4 rounded-xl font-semibold text-sm transition-all"
                style={{
                  background: "var(--cyan)",
                  color: "var(--navy)",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                Generate ZK Proof
              </button>
            </div>

            <div
              className="w-full max-w-lg rounded-xl p-6 text-left mt-4"
              style={{
                background: "var(--navy-card)",
                border: "1px solid var(--navy-border)",
              }}
            >
              <p className="text-xs font-medium mb-4" style={{ color: "var(--text-dim)" }}>
                HOW IT WORKS
              </p>
              <div className="flex flex-col gap-3">
                {[
                  ["01", "Your Stellar account history is fetched from Horizon"],
                  ["02", "A RISC Zero zkVM computes your credit score off-chain"],
                  ["03", "A cryptographic proof verifies the computation was correct"],
                  ["04", "Your verified score is stored in a Soroban smart contract"],
                ].map(([num, text]) => (
                  <div key={num} className="flex items-start gap-3">
                    <span
                      className="mono text-xs font-bold mt-0.5"
                      style={{ color: "var(--cyan)" }}
                    >
                      {num}
                    </span>
                    <span className="text-sm" style={{ color: "var(--text-dim)" }}>
                      {text}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Proving state */}
        {state === "proving" && (
          <div className="flex flex-col items-center gap-8 py-8">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Generating your ZK proof</h2>
              <p className="text-sm" style={{ color: "var(--text-dim)" }}>
                This takes 1–3 minutes. The proof is being computed inside a RISC Zero zkVM.
              </p>
            </div>

            <div
              className="w-full max-w-md rounded-xl p-6 flex flex-col gap-4"
              style={{
                background: "var(--navy-card)",
                border: "1px solid var(--navy-border)",
              }}
            >
              {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{
                      background: step.done
                        ? "var(--cyan)"
                        : step.active
                          ? "var(--cyan-dim)"
                          : "var(--navy-border)",
                      border: step.active ? "1px solid var(--cyan)" : "none",
                    }}
                  >
                    {step.done && (
                      <span style={{ color: "var(--navy)", fontSize: 10, fontWeight: 700 }}>
                        ✓
                      </span>
                    )}
                    {step.active && (
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ background: "var(--cyan)", animation: "pulse 1s infinite" }}
                      />
                    )}
                  </div>
                  <span
                    className="text-sm"
                    style={{
                      color: step.done
                        ? "var(--text)"
                        : step.active
                          ? "var(--cyan)"
                          : "var(--text-dim)",
                    }}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mono text-xs" style={{ color: "var(--text-dim)" }}>
              {address.slice(0, 6)}...{address.slice(-6)}
            </p>
          </div>
        )}

        {/* Result state */}
        {state === "done" && result && (
          <div className="flex flex-col items-center gap-6">
            <div className="text-center">
              <div
                className="mono text-xs font-medium mb-3 inline-block px-3 py-1 rounded-full"
                style={{
                  background: "#00FF8820",
                  color: "#00FF88",
                  border: "1px solid #00FF8830",
                }}
              >
                ✓ Proof verified on Stellar testnet
              </div>
              <h2 className="text-2xl font-semibold">Your ZKredit Score</h2>
            </div>

            <div
              className="w-full max-w-md rounded-2xl p-8 flex flex-col gap-6"
              style={{
                background: "var(--navy-card)",
                border: "1px solid var(--navy-border)",
              }}
            >
              <ScoreGauge score={result.score} />

              <div
                className="flex flex-col gap-3 pt-2"
                style={{ borderTop: "1px solid var(--navy-border)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>
                  SCORE BREAKDOWN
                </p>
                <Component label="HODL Duration (40%)" value={result.hodl_component} />
                <Component
                  label="Transaction Frequency (30%)"
                  value={result.frequency_component}
                />
                <Component label="Balance Stability (30%)" value={result.stability_component} />
              </div>

              <div
                className="flex flex-col gap-2 pt-2"
                style={{ borderTop: "1px solid var(--navy-border)" }}
              >
                <p className="text-xs font-medium" style={{ color: "var(--text-dim)" }}>
                  ON-CHAIN RECORD
                </p>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-dim)" }}>Contract</span>
                  <a
                    href={`https://stellar.expert/explorer/testnet/contract/${result.contract_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mono"
                    style={{ color: "var(--cyan)" }}
                  >{result.contract_id.slice(0, 8)}...{result.contract_id.slice(-8)}</a>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-dim)" }}>Verified at</span>
                  <span className="mono" style={{ color: "var(--text-dim)" }}>
                    {new Date(result.verified_at * 1000).toUTCString()}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span style={{ color: "var(--text-dim)" }}>Address hash</span>
                  <span className="mono" style={{ color: "var(--text-dim)" }}>
                    {result.address_hash.slice(0, 8)}...{result.address_hash.slice(-8)}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={reset}
              className="text-sm px-6 py-3 rounded-xl"
              style={{
                background: "var(--navy-card)",
                border: "1px solid var(--navy-border)",
                color: "var(--text-dim)",
                cursor: "pointer",
              }}
            >
              Score another address
            </button>
          </div>
        )}

        {/* Error state */}
        {state === "error" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <p style={{ color: "#FF6B6B" }}>Proof generation failed</p>
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              {error}
            </p>
            <button
              onClick={reset}
              className="text-sm px-6 py-3 rounded-xl"
              style={{
                background: "var(--navy-card)",
                border: "1px solid var(--navy-border)",
                color: "var(--text)",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.3;
          }
        }
      `}</style>
    </main>
  );
}