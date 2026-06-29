import { exec } from "child_process";
import { NextResponse } from "next/server";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function POST(request: Request) {
    const { address } = await request.json();

    if (!address || !address.startsWith("G") || address.length !== 56) {
        return NextResponse.json({ error: "Invalid Stellar address" }, { status: 400 });
    }

    try {
        // Run the Rust host with the address as argument
        const { stdout, stderr } = await execAsync(
            `cd /home/adams/hack/ZKredit/zkredit && STELLAR_ADDRESS=${address} cargo run --manifest-path host/Cargo.toml 2>&1`,
            { timeout: 300000 } // 5 min timeout for proof generation
        );

        // Parse the score from stdout
        const scoreMatch = stdout.match(/Credit Score:\s+(\d+)/);
        const hodlMatch = stdout.match(/HODL Component:\s+(\d+)/);
        const freqMatch = stdout.match(/Frequency Component:\s+(\d+)/);
        const stabMatch = stdout.match(/Stability Component:\s+(\d+)/);
        const hashMatch = stdout.match(/"address_hash":"([a-f0-9]+)"/);
        const timestampMatch = stdout.match(/"verified_at":(\d+)/);

        if (!scoreMatch) {
            return NextResponse.json({ error: "Proof generation failed", details: stdout }, { status: 500 });
        }

        return NextResponse.json({
            score: parseInt(scoreMatch[1]),
            hodl_component: parseInt(hodlMatch?.[1] ?? "0"),
            frequency_component: parseInt(freqMatch?.[1] ?? "0"),
            stability_component: parseInt(stabMatch?.[1] ?? "0"),
            address_hash: hashMatch?.[1],
            verified_at: parseInt(timestampMatch?.[1] ?? "0"),
            contract_id: "CCT2KJTR5R6U4GTZWS6GAY5S2T5G4JOUU5XS4EGJQ2TKXEEVOV7QQXLH",
            raw_output: stdout,
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}